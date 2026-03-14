import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenDotaService } from '../../services/opendota/opendota.service';
import { Glicko2Service } from '../../services/rating/glicko2.service';
import { steamId64ToAccountId, accountIdToSteamId64 } from '@dota-league/shared';

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    private prisma: PrismaService,
    private openDota: OpenDotaService,
    private glicko2: Glicko2Service,
  ) {}

  async getAllPlayers(sortBy: string = 'rating', limit: number = 100) {
    const orderBy: any = {};
    
    switch (sortBy) {
      case 'wins':
        orderBy.wins = 'desc';
        break;
      case 'recentActivity':
        orderBy.lastMatchAt = 'desc';
        break;
      case 'rating':
      default:
        orderBy.rating = 'desc';
        break;
    }

    return this.prisma.player.findMany({
      take: limit,
      orderBy,
      select: {
        id: true,
        steamId: true,
        accountId: true,
        personaName: true,
        avatar: true,
        avatarFull: true,
        rating: true,
        ratingDeviation: true,
        wins: true,
        losses: true,
        winStreak: true,
        lastMatchAt: true,
      },
    });
  }

  async searchPlayers(query: string) {
    // Search by personaName, steamId, or accountId
    const isNumeric = /^\d+$/.test(query);
    
    return this.prisma.player.findMany({
      where: {
        OR: [
          { personaName: { contains: query, mode: 'insensitive' } },
          { steamId: { contains: query } },
          ...(isNumeric ? [{ accountId: parseInt(query, 10) }] : []),
        ],
      },
      take: 10,
      select: {
        steamId: true,
        personaName: true,
        avatar: true,
      },
    });
  }

  async getPlayerById(id: string) {
    return this.getPlayerProfile({ id });
  }

  async getPlayerBySteamId(steamId: string) {
    return this.getPlayerProfile({ steamId });
  }

  async getPlayerByAccountId(accountId: number) {
    return this.prisma.player.findUnique({
      where: { accountId },
    });
  }

  private async getPlayerProfile(where: { id?: string; steamId?: string }) {
    const player = await this.prisma.player.findUnique({
      where: where as any,
      include: {
        ratingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!player) return null;

    // Get recent match participations with match data
    const recentMatchPlayers = await this.prisma.matchPlayer.findMany({
      where: { playerId: player.id },
      include: {
        match: {
          select: {
            id: true,
            matchId: true,
            radiantWin: true,
            duration: true,
            startTime: true,
          },
        },
      },
      orderBy: { match: { startTime: 'desc' } },
      take: 10,
    });

    const recentMatches = recentMatchPlayers.map((mp) => ({
      id: mp.id,
      matchId: mp.match.matchId.toString(),
      radiantWin: mp.match.radiantWin,
      duration: mp.match.duration,
      playedAt: mp.match.startTime.toISOString(),
      team: mp.isRadiant ? 'radiant' : 'dire',
      hero: mp.heroId.toString(),
      kills: mp.kills,
      deaths: mp.deaths,
      assists: mp.assists,
      ratingChange: mp.ratingAfter - mp.ratingBefore,
    }));

    return {
      ...player,
      recentMatches,
      ratingHistory: player.ratingHistory.map((rh) => ({
        rating: rh.ratingAfter,
        ratingDeviation: rh.rdAfter,
        createdAt: rh.createdAt.toISOString(),
      })),
    };
  }

  async getPlayerStats(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) return null;

    // Get aggregated stats from matches
    const matchStats = await this.prisma.matchPlayer.aggregate({
      where: { playerId },
      _avg: {
        kills: true,
        deaths: true,
        assists: true,
        gpm: true,
        xpm: true,
        lastHits: true,
        denies: true,
      },
      _max: {
        kills: true,
        deaths: true,
        assists: true,
        gpm: true,
        xpm: true,
      },
      _count: true,
    });

    const totalMatches = matchStats._count;
    const winRate = totalMatches > 0
      ? Math.round((player.wins / totalMatches) * 100 * 10) / 10
      : 0;

    return {
      player,
      stats: {
        totalMatches,
        wins: player.wins,
        losses: player.losses,
        winRate,
        avgKills: Math.round((matchStats._avg.kills || 0) * 10) / 10,
        avgDeaths: Math.round((matchStats._avg.deaths || 0) * 10) / 10,
        avgAssists: Math.round((matchStats._avg.assists || 0) * 10) / 10,
        avgGpm: Math.round(matchStats._avg.gpm || 0),
        avgXpm: Math.round(matchStats._avg.xpm || 0),
        avgLastHits: Math.round(matchStats._avg.lastHits || 0),
        avgDenies: Math.round(matchStats._avg.denies || 0),
        maxKills: matchStats._max.kills || 0,
        maxDeaths: matchStats._max.deaths || 0,
        maxAssists: matchStats._max.assists || 0,
        maxGpm: matchStats._max.gpm || 0,
        maxXpm: matchStats._max.xpm || 0,
        confidenceLevel: this.glicko2.getConfidenceLevel(player.ratingDeviation),
      },
    };
  }

  async getPlayerMatches(playerId: string, limit: number = 20, offset: number = 0) {
    const matches = await this.prisma.matchPlayer.findMany({
      where: { playerId },
      include: {
        match: true,
      },
      orderBy: {
        match: {
          startTime: 'desc',
        },
      },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.matchPlayer.count({
      where: { playerId },
    });

    return {
      matches,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPlayerHeroes(playerId: string) {
    const heroStats = await this.prisma.matchPlayer.groupBy({
      by: ['heroId'],
      where: { playerId },
      _count: true,
      _avg: {
        kills: true,
        deaths: true,
        assists: true,
      },
    });

    // Get wins per hero
    const heroWins = await this.prisma.matchPlayer.groupBy({
      by: ['heroId'],
      where: {
        playerId,
        match: { radiantWin: true },
        isRadiant: true,
      },
      _count: true,
    });

    const heroWinsDire = await this.prisma.matchPlayer.groupBy({
      by: ['heroId'],
      where: {
        playerId,
        match: { radiantWin: false },
        isRadiant: false,
      },
      _count: true,
    });

    // Combine win counts
    const winsMap = new Map<number, number>();
    for (const hw of [...heroWins, ...heroWinsDire]) {
      winsMap.set(hw.heroId, (winsMap.get(hw.heroId) || 0) + hw._count);
    }

    return heroStats
      .map((hs) => ({
        heroId: hs.heroId,
        matches: hs._count,
        wins: winsMap.get(hs.heroId) || 0,
        losses: hs._count - (winsMap.get(hs.heroId) || 0),
        winRate: Math.round(((winsMap.get(hs.heroId) || 0) / hs._count) * 100 * 10) / 10,
        avgKills: Math.round((hs._avg.kills || 0) * 10) / 10,
        avgDeaths: Math.round((hs._avg.deaths || 0) * 10) / 10,
        avgAssists: Math.round((hs._avg.assists || 0) * 10) / 10,
      }))
      .sort((a, b) => b.matches - a.matches);
  }

  async getPlayerRatingHistory(playerId: string, limit: number = 50) {
    return this.prisma.ratingHistory.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async registerPlayer(steamId: string) {
    // Convert Steam ID to account ID
    let accountId: number;
    try {
      accountId = steamId64ToAccountId(steamId);
    } catch {
      throw new Error('Invalid Steam ID format');
    }

    // Check if already exists
    const existing = await this.prisma.player.findUnique({
      where: { steamId },
    });

    if (existing) {
      throw new Error('Player already registered');
    }

    // Fetch profile from OpenDota
    const profile = await this.openDota.getPlayer(accountId);
    
    if (!profile || !profile.profile) {
      throw new Error('Could not fetch player profile. Make sure the Steam profile is public.');
    }

    // Create with default Glicko-2 rating
    const defaultRating = this.glicko2.createPlayer();

    const player = await this.prisma.player.create({
      data: {
        steamId,
        accountId,
        personaName: profile.profile.personaname || 'Unknown',
        avatar: profile.profile.avatar || '',
        avatarFull: profile.profile.avatarfull || '',
        profileUrl: profile.profile.profileurl || '',
        rating: defaultRating.rating,
        ratingDeviation: defaultRating.rd,
        volatility: defaultRating.volatility,
      },
    });

    this.logger.log(`Registered new player: ${player.personaName} (${steamId})`);
    return player;
  }

  async syncPlayerProfile(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new Error('Player not found');
    }

    // Refresh on OpenDota first
    await this.openDota.refreshPlayer(player.accountId);

    // Wait a bit for OpenDota to update
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Fetch updated profile
    const profile = await this.openDota.getPlayer(player.accountId);

    if (!profile || !profile.profile) {
      throw new Error('Could not fetch updated profile');
    }

    // Update player
    const updated = await this.prisma.player.update({
      where: { id: playerId },
      data: {
        personaName: profile.profile.personaname || player.personaName,
        avatar: profile.profile.avatar || player.avatar,
        avatarFull: profile.profile.avatarfull || player.avatarFull,
        profileUrl: profile.profile.profileurl || player.profileUrl,
      },
    });

    return updated;
  }
}
