import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenDotaService } from '../opendota/opendota.service';
import { Glicko2Service, GlickoPlayer } from '../rating/glicko2.service';
import {
  OpenDotaMatch,
  OpenDotaMatchDetails,
  LobbyType,
  isRadiant,
} from '@dota-league/shared';

export interface DetectedMatch {
  matchId: number;
  startTime: Date;
  duration: number;
  heroId: number;
  radiantWin: boolean;
  leagueMembersCount: number;
  leagueMemberIds: number[];
}

export interface MatchRegistrationResult {
  success: boolean;
  message: string;
  match?: any; // LeagueMatch from Prisma
  error?: string;
}

@Injectable()
export class MatchDetectionService {
  private readonly logger = new Logger(MatchDetectionService.name);

  constructor(
    private prisma: PrismaService,
    private openDota: OpenDotaService,
    private glicko2: Glicko2Service,
  ) {}

  /**
   * Get all registered player account IDs
   */
  async getLeagueMemberIds(): Promise<Set<number>> {
    const players = await this.prisma.player.findMany({
      select: { accountId: true },
    });
    return new Set(players.map((p) => p.accountId));
  }

  /**
   * Find recent custom lobby matches for a player that might be league matches
   */
  async findPotentialLeagueMatches(
    reporterAccountId: number,
    hoursBack: number = 2
  ): Promise<DetectedMatch[]> {
    // Get recent custom lobby matches for the reporter
    const matches = await this.openDota.getPlayerCustomLobbyMatches(
      reporterAccountId,
      hoursBack
    );

    if (matches.length === 0) {
      return [];
    }

    // Get all league member IDs
    const memberIds = await this.getLeagueMemberIds();

    // For each match, check how many players are league members
    const potentialMatches: DetectedMatch[] = [];

    for (const match of matches) {
      // Check if already registered
      const existing = await this.prisma.leagueMatch.findUnique({
        where: { matchId: BigInt(match.match_id) },
      });

      if (existing) {
        continue; // Skip already registered matches
      }

      // Get full match details to see all players
      const details = await this.openDota.getMatchDetails(match.match_id);
      
      if (!details || details.human_players < 10) {
        continue; // Skip incomplete matches
      }

      // Count league members in this match
      const matchMemberIds = details.players
        .filter((p) => p.account_id && memberIds.has(p.account_id))
        .map((p) => p.account_id!);

      if (matchMemberIds.length >= 6) {
        // At least 6 league members to be considered
        potentialMatches.push({
          matchId: match.match_id,
          startTime: new Date(match.start_time * 1000),
          duration: match.duration,
          heroId: match.hero_id,
          radiantWin: match.radiant_win,
          leagueMembersCount: matchMemberIds.length,
          leagueMemberIds: matchMemberIds,
        });
      }
    }

    // Sort by most league members first
    return potentialMatches.sort(
      (a, b) => b.leagueMembersCount - a.leagueMembersCount
    );
  }

  /**
   * Register a match to the league
   */
  async registerMatch(
    matchId: number,
    registeredBy: 'automatic' | 'manual' | 'discord',
    reporterPlayerId?: string
  ): Promise<MatchRegistrationResult> {
    // Check if already exists
    const existing = await this.prisma.leagueMatch.findUnique({
      where: { matchId: BigInt(matchId) },
    });

    if (existing) {
      return {
        success: false,
        message: 'Match already registered',
        error: 'DUPLICATE_MATCH',
      };
    }

    // Get match details from OpenDota (with retry for fresh matches)
    const details = await this.openDota.getMatchDetailsWithRetry(matchId);

    if (!details) {
      return {
        success: false,
        message: 'Match not found in OpenDota. Try again in a few minutes.',
        error: 'MATCH_NOT_FOUND',
      };
    }

    // Verify it's a custom lobby
    if (details.lobby_type !== LobbyType.CUSTOM) {
      return {
        success: false,
        message: 'This is not a custom lobby match',
        error: 'INVALID_LOBBY_TYPE',
      };
    }

    // Get league members
    const memberIds = await this.getLeagueMemberIds();

    // Find which match players are league members
    const leaguePlayers = details.players.filter(
      (p) => p.account_id && memberIds.has(p.account_id)
    );

    if (leaguePlayers.length < 6) {
      return {
        success: false,
        message: `Only ${leaguePlayers.length}/10 players are league members. Minimum 6 required.`,
        error: 'INSUFFICIENT_MEMBERS',
      };
    }

    // Register the match in a transaction
    try {
      const match = await this.prisma.$transaction(async (tx) => {
        // Create the league match
        const leagueMatch = await tx.leagueMatch.create({
          data: {
            matchId: BigInt(matchId),
            startTime: new Date(details.start_time * 1000),
            duration: details.duration,
            radiantWin: details.radiant_win,
            radiantScore: details.radiant_score,
            direScore: details.dire_score,
            gameMode: details.game_mode,
            lobbyType: details.lobby_type,
            registeredBy,
            reportedByPlayerId: reporterPlayerId,
          },
        });

        // Get player records for rating calculation
        const playerRecords = await tx.player.findMany({
          where: {
            accountId: { in: leaguePlayers.map((p) => p.account_id!) },
          },
        });

        const playerMap = new Map(
          playerRecords.map((p) => [p.accountId, p])
        );

        // Build teams for Glicko calculation
        const radiantTeam: GlickoPlayer[] = [];
        const direTeam: GlickoPlayer[] = [];
        const playerTeamMap = new Map<number, 'radiant' | 'dire'>();

        for (const mp of details.players) {
          if (!mp.account_id || !playerMap.has(mp.account_id)) continue;
          
          const player = playerMap.get(mp.account_id)!;
          const glickoPlayer: GlickoPlayer = {
            rating: player.rating,
            rd: player.ratingDeviation,
            volatility: player.volatility,
          };

          if (isRadiant(mp.player_slot)) {
            radiantTeam.push(glickoPlayer);
            playerTeamMap.set(mp.account_id, 'radiant');
          } else {
            direTeam.push(glickoPlayer);
            playerTeamMap.set(mp.account_id, 'dire');
          }
        }

        // Calculate rating changes
        const ratingChanges = this.glicko2.calculateTeamMatch(
          radiantTeam,
          direTeam,
          details.radiant_win
        );

        // Create match player records and update ratings
        let radiantIndex = 0;
        let direIndex = 0;

        for (const mp of details.players) {
          if (!mp.account_id) continue;
          
          const player = playerMap.get(mp.account_id);
          if (!player) continue;

          const team = playerTeamMap.get(mp.account_id);
          const changeIndex = team === 'radiant' ? radiantIndex++ : 5 + direIndex++;
          const ratingChange = ratingChanges.get(changeIndex);

          const won = (team === 'radiant' && details.radiant_win) ||
                      (team === 'dire' && !details.radiant_win);

          // Create match player record
          await tx.matchPlayer.create({
            data: {
              matchId: leagueMatch.id,
              playerId: player.id,
              accountId: mp.account_id,
              heroId: mp.hero_id,
              playerSlot: mp.player_slot,
              isRadiant: team === 'radiant',
              kills: mp.kills,
              deaths: mp.deaths,
              assists: mp.assists,
              gpm: mp.gold_per_min,
              xpm: mp.xp_per_min,
              lastHits: mp.last_hits,
              denies: mp.denies,
              heroDamage: mp.hero_damage || 0,
              towerDamage: mp.tower_damage || 0,
              heroHealing: mp.hero_healing || 0,
              gold: mp.gold || 0,
              level: mp.level || 1,
              item0: mp.item_0 || 0,
              item1: mp.item_1 || 0,
              item2: mp.item_2 || 0,
              item3: mp.item_3 || 0,
              item4: mp.item_4 || 0,
              item5: mp.item_5 || 0,
              backpack0: mp.backpack_0 || 0,
              backpack1: mp.backpack_1 || 0,
              backpack2: mp.backpack_2 || 0,
              ratingBefore: player.rating,
              ratingAfter: ratingChange?.newRating || player.rating,
              ratingChange: ratingChange?.ratingChange || 0,
            },
          });

          // Update player rating and stats
          if (ratingChange) {
            await tx.player.update({
              where: { id: player.id },
              data: {
                rating: ratingChange.newRating,
                ratingDeviation: ratingChange.newRd,
                volatility: ratingChange.newVolatility,
                wins: won ? player.wins + 1 : player.wins,
                losses: won ? player.losses : player.losses + 1,
                winStreak: won ? player.winStreak + 1 : 0,
                lossStreak: won ? 0 : player.lossStreak + 1,
                lastMatchAt: new Date(),
              },
            });

            // Create rating history
            await tx.ratingHistory.create({
              data: {
                playerId: player.id,
                matchId: leagueMatch.id,
                ratingBefore: player.rating,
                ratingAfter: ratingChange.newRating,
                rdBefore: player.ratingDeviation,
                rdAfter: ratingChange.newRd,
              },
            });
          }
        }

        // Mark match as processed
        await tx.leagueMatch.update({
          where: { id: leagueMatch.id },
          data: { ratingProcessed: true },
        });

        return leagueMatch;
      });

      this.logger.log(`Registered match ${matchId} with ${leaguePlayers.length} league players`);

      return {
        success: true,
        message: `Match registered! ${leaguePlayers.length} players' ratings updated.`,
        match,
      };
    } catch (error) {
      this.logger.error(`Failed to register match ${matchId}:`, error);
      return {
        success: false,
        message: 'Failed to register match',
        error: 'DATABASE_ERROR',
      };
    }
  }

  /**
   * Smart auto-detection: Called when a player reports they finished a match
   * Returns single match if perfect match, or list of candidates if multiple
   */
  async autoDetectMatch(
    reporterAccountId: number
  ): Promise<{
    autoRegistered?: any;
    candidates?: DetectedMatch[];
    message: string;
  }> {
    const potentialMatches = await this.findPotentialLeagueMatches(
      reporterAccountId,
      2 // Look back 2 hours
    );

    if (potentialMatches.length === 0) {
      return {
        message: 'No custom lobby matches found in the last 2 hours. ' +
                 'Match may not be indexed yet. Try again in 1-2 minutes, ' +
                 'or submit the match ID manually.',
      };
    }

    // If exactly one match with 10/10 league members, auto-register
    if (
      potentialMatches.length === 1 &&
      potentialMatches[0].leagueMembersCount === 10
    ) {
      const result = await this.registerMatch(
        potentialMatches[0].matchId,
        'automatic'
      );

      if (result.success) {
        return {
          autoRegistered: result.match,
          message: 'Match auto-detected and registered!',
        };
      }
    }

    // Return candidates for user to choose
    return {
      candidates: potentialMatches,
      message: `Found ${potentialMatches.length} potential match(es). ` +
               'Please confirm which match to register.',
    };
  }
}
