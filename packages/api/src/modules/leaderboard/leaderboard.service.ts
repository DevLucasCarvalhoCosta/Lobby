import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Glicko2Service } from '../../services/rating/glicko2.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    private glicko2: Glicko2Service,
  ) {}

  async getLeaderboard(limit: number = 50, minMatches: number = 0) {
    // Get players with match counts
    const players = await this.prisma.player.findMany({
      orderBy: { rating: 'desc' },
      take: limit * 2, // Get more to filter
    });

    // Get match counts for each player
    const playerIds = players.map((p) => p.id);
    const matchCounts = await this.prisma.matchPlayer.groupBy({
      by: ['playerId'],
      where: { playerId: { in: playerIds } },
      _count: true,
    });

    const countMap = new Map(matchCounts.map((mc) => [mc.playerId, mc._count]));

    // Get recent form (last 5 matches)
    const recentMatches = await this.prisma.matchPlayer.findMany({
      where: { playerId: { in: playerIds } },
      include: {
        match: {
          select: { radiantWin: true },
        },
      },
      orderBy: {
        match: { startTime: 'desc' },
      },
    });

    // Group by player and get last 5 results
    const formMap = new Map<string, ('W' | 'L')[]>();
    for (const mp of recentMatches) {
      if (!formMap.has(mp.playerId)) {
        formMap.set(mp.playerId, []);
      }
      const form = formMap.get(mp.playerId)!;
      if (form.length < 5) {
        const won = mp.isRadiant === mp.match.radiantWin;
        form.push(won ? 'W' : 'L');
      }
    }

    // Build leaderboard
    const leaderboard = players
      .filter((p) => (countMap.get(p.id) || 0) >= minMatches)
      .slice(0, limit)
      .map((player, index) => {
        const totalMatches = countMap.get(player.id) || 0;
        const winRate = totalMatches > 0
          ? Math.round((player.wins / totalMatches) * 100 * 10) / 10
          : 0;

        return {
          rank: index + 1,
          player: {
            id: player.id,
            personaName: player.personaName,
            avatar: player.avatar,
            steamId: player.steamId,
          },
          rating: Math.round(player.rating),
          ratingDeviation: Math.round(player.ratingDeviation),
          confidenceLevel: this.glicko2.getConfidenceLevel(player.ratingDeviation),
          wins: player.wins,
          losses: player.losses,
          totalMatches,
          winRate,
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
          recentForm: formMap.get(player.id) || [],
          lastMatchAt: player.lastMatchAt,
        };
      });

    return leaderboard;
  }

  async getLeagueStats() {
    const totalPlayers = await this.prisma.player.count();
    const totalMatches = await this.prisma.leagueMatch.count();
    
    const avgRating = await this.prisma.player.aggregate({
      _avg: { rating: true },
    });

    const avgDuration = await this.prisma.leagueMatch.aggregate({
      _avg: { duration: true },
    });

    const radiantWins = await this.prisma.leagueMatch.count({
      where: { radiantWin: true },
    });

    // Get matches in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const matchesThisWeek = await this.prisma.leagueMatch.count({
      where: { startTime: { gte: weekAgo } },
    });

    // Most active players this week
    const activePlayersThisWeek = await this.prisma.matchPlayer.groupBy({
      by: ['playerId'],
      where: {
        match: { startTime: { gte: weekAgo } },
      },
      _count: true,
      orderBy: { _count: { playerId: 'desc' } },
      take: 5,
    });

    return {
      totalPlayers,
      totalMatches,
      avgRating: Math.round(avgRating._avg.rating || 1500),
      avgMatchDuration: Math.round((avgDuration._avg.duration || 0) / 60), // minutes
      radiantWinRate: totalMatches > 0
        ? Math.round((radiantWins / totalMatches) * 100 * 10) / 10
        : 50,
      matchesThisWeek,
      activePlayersCount: activePlayersThisWeek.length,
    };
  }

  async getTopPerformers() {
    // Highest rating
    const highestRated = await this.prisma.player.findFirst({
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        personaName: true,
        avatar: true,
        rating: true,
      },
    });

    // Most wins
    const mostWins = await this.prisma.player.findFirst({
      orderBy: { wins: 'desc' },
      select: {
        id: true,
        personaName: true,
        avatar: true,
        wins: true,
      },
    });

    // Highest win streak
    const highestWinStreak = await this.prisma.player.findFirst({
      orderBy: { winStreak: 'desc' },
      where: { winStreak: { gt: 0 } },
      select: {
        id: true,
        personaName: true,
        avatar: true,
        winStreak: true,
      },
    });

    // Most matches
    const matchCounts = await this.prisma.matchPlayer.groupBy({
      by: ['playerId'],
      _count: true,
      orderBy: { _count: { playerId: 'desc' } },
      take: 1,
    });

    let mostActive = null;
    if (matchCounts.length > 0) {
      const player = await this.prisma.player.findUnique({
        where: { id: matchCounts[0].playerId },
        select: {
          id: true,
          personaName: true,
          avatar: true,
        },
      });
      if (player) {
        mostActive = { ...player, matches: matchCounts[0]._count };
      }
    }

    // Best KDA (min 5 matches)
    const kdaStats = await this.prisma.matchPlayer.groupBy({
      by: ['playerId'],
      _avg: {
        kills: true,
        deaths: true,
        assists: true,
      },
      _count: true,
      having: {
        playerId: { _count: { gte: 5 } },
      },
    });

    let bestKda = null;
    let bestKdaValue = 0;
    for (const stat of kdaStats) {
      const kda = stat._avg.deaths && stat._avg.deaths > 0
        ? ((stat._avg.kills || 0) + (stat._avg.assists || 0)) / stat._avg.deaths
        : (stat._avg.kills || 0) + (stat._avg.assists || 0);
      
      if (kda > bestKdaValue) {
        bestKdaValue = kda;
        const player = await this.prisma.player.findUnique({
          where: { id: stat.playerId },
          select: { id: true, personaName: true, avatar: true },
        });
        if (player) {
          bestKda = { ...player, kda: Math.round(kda * 100) / 100 };
        }
      }
    }

    return {
      highestRated,
      mostWins,
      highestWinStreak,
      mostActive,
      bestKda,
    };
  }

  async getRecentActivity(limit: number = 10) {
    const recentMatches = await this.prisma.leagueMatch.findMany({
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                personaName: true,
                avatar: true,
              },
            },
          },
          orderBy: { ratingChange: 'desc' },
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    return recentMatches.map((match) => ({
      id: match.id,
      matchId: match.matchId.toString(),
      startTime: match.startTime,
      duration: match.duration,
      radiantWin: match.radiantWin,
      radiantScore: match.radiantScore,
      direScore: match.direScore,
      topRatingGain: match.players[0] ? {
        player: match.players[0].player,
        change: match.players[0].ratingChange,
      } : null,
      playerCount: match.players.length,
    }));
  }
}
