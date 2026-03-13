import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchDetectionService } from '../../services/match-detection/match-detection.service';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private prisma: PrismaService,
    private matchDetection: MatchDetectionService,
  ) {}

  async getAllMatches(limit: number = 20, offset: number = 0) {
    const matches = await this.prisma.leagueMatch.findMany({
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                steamId: true,
                personaName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.leagueMatch.count();

    return {
      matches: matches.map((m) => ({
        id: m.id,
        matchId: m.matchId.toString(),
        radiantWin: m.radiantWin,
        duration: m.duration,
        playedAt: m.startTime.toISOString(),
        players: m.players.map((mp) => ({
          id: mp.id,
          steamId: mp.player.steamId,
          personaName: mp.player.personaName,
          team: mp.isRadiant ? 'radiant' : 'dire',
          hero: mp.heroId.toString(),
          kills: mp.kills,
          deaths: mp.deaths,
          assists: mp.assists,
        })),
      })),
      total,
    };
  }

  async getMatchById(id: string) {
    const match = await this.prisma.leagueMatch.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                personaName: true,
                avatar: true,
                avatarFull: true,
                rating: true,
              },
            },
          },
          orderBy: { playerSlot: 'asc' },
        },
        reportedByPlayer: {
          select: {
            id: true,
            personaName: true,
          },
        },
      },
    });

    if (!match) return null;

    // Separate teams
    const radiant = match.players.filter((p) => p.isRadiant);
    const dire = match.players.filter((p) => !p.isRadiant);

    return {
      ...match,
      matchId: match.matchId.toString(),
      radiant,
      dire,
    };
  }

  async getMatchByDotaId(dotaMatchId: bigint) {
    const match = await this.prisma.leagueMatch.findUnique({
      where: { matchId: dotaMatchId },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                personaName: true,
                avatar: true,
                avatarFull: true,
              },
            },
          },
          orderBy: { playerSlot: 'asc' },
        },
      },
    });

    if (!match) return null;

    return {
      ...match,
      matchId: match.matchId.toString(),
    };
  }

  async registerMatch(
    matchId: number,
    registeredBy: 'automatic' | 'manual' | 'discord',
    reporterPlayerId?: string,
  ) {
    return this.matchDetection.registerMatch(matchId, registeredBy, reporterPlayerId);
  }

  async autoDetectMatch(reporterAccountId: number) {
    return this.matchDetection.autoDetectMatch(reporterAccountId);
  }

  async findPotentialMatches(accountId: number, hoursBack: number = 2) {
    return this.matchDetection.findPotentialLeagueMatches(accountId, hoursBack);
  }

  async getRecentMatches(limit: number = 10) {
    const matches = await this.prisma.leagueMatch.findMany({
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                steamId: true,
                personaName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    return matches.map((m) => ({
      id: m.id,
      matchId: m.matchId.toString(),
      radiantWin: m.radiantWin,
      duration: m.duration,
      playedAt: m.startTime.toISOString(),
      players: m.players.map((mp) => ({
        id: mp.id,
        steamId: mp.player.steamId,
        personaName: mp.player.personaName,
        team: mp.isRadiant ? 'radiant' : 'dire',
        hero: mp.heroId.toString(),
        kills: mp.kills,
        deaths: mp.deaths,
        assists: mp.assists,
      })),
    }));
  }

  async getMatchStats() {
    const totalMatches = await this.prisma.leagueMatch.count();
    
    const avgDuration = await this.prisma.leagueMatch.aggregate({
      _avg: { duration: true },
    });

    const radiantWins = await this.prisma.leagueMatch.count({
      where: { radiantWin: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const matchesToday = await this.prisma.leagueMatch.count({
      where: {
        startTime: { gte: today },
      },
    });

    return {
      totalMatches,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      radiantWinRate: totalMatches > 0
        ? Math.round((radiantWins / totalMatches) * 100 * 10) / 10
        : 50,
      matchesToday,
    };
  }
}
