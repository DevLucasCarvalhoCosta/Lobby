import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LobbyStatus, LobbyTeam, Prisma } from '@prisma/client';
import { PlayersService } from '../players/players.service';
import { MatchDetectionService } from '../../services/match-detection/match-detection.service';

// Types for gRPC client (will be generated from proto)
interface LobbyState {
  inLobby: boolean;
  lobbyId: bigint;
  name: string;
  password: string;
  status: string;
  serverRegion: number;
  gameMode: number;
  matchId: bigint;
  members: LobbyMember[];
  radiantCount: number;
  direCount: number;
}

interface LobbyMember {
  steamId: bigint;
  accountId: number;
  name: string;
  team: string;
  slot: number;
}

export interface CreateLobbyDto {
  name: string;
  password?: string;
  serverRegion?: number;
  gameMode?: number;
  playerSteamIds: string[];
  createdById: string;
}

export interface LobbyResponse {
  id: string;
  dotaLobbyId: bigint | null;
  name: string;
  password: string;
  serverRegion: number;
  gameMode: number;
  status: LobbyStatus;
  createdAt: Date;
  players: {
    id: string;
    steamId: string;
    personaName: string;
    team: LobbyTeam;
    slot: number | null;
    joined: boolean;
  }[];
}

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private gcServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private playersService: PlayersService,
    private matchDetection: MatchDetectionService,
  ) {
    this.gcServiceUrl = process.env.DOTA_GC_SERVICE_URL || 'http://localhost:8080';
  }

  /**
   * Create a new lobby
   */
  async createLobby(dto: CreateLobbyDto): Promise<LobbyResponse> {
    const { name, password, serverRegion, gameMode, playerSteamIds, createdById } = dto;

    // Validate creator exists
    const creator = await this.prisma.player.findUnique({ where: { id: createdById } });
    if (!creator) {
      throw new BadRequestException('Creator player not found');
    }

    // Validate all players exist
    const players = await this.prisma.player.findMany({
      where: { steamId: { in: playerSteamIds } },
    });

    if (players.length !== playerSteamIds.length) {
      const foundIds = players.map(p => p.steamId);
      const missing = playerSteamIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Players not found: ${missing.join(', ')}`);
    }

    // Generate password if not provided
    const lobbyPassword = password || this.generatePassword();

    // Create lobby in database
    const lobby = await this.prisma.lobby.create({
      data: {
        name,
        password: lobbyPassword,
        serverRegion: serverRegion || 10, // Default: Brazil
        gameMode: gameMode || 1, // Default: All Pick
        status: LobbyStatus.CREATED,
        createdById,
        players: {
          create: players.map((player, index) => ({
            playerId: player.id,
            team: LobbyTeam.UNASSIGNED,
            isHost: player.id === createdById,
          })),
        },
      },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    this.logger.log(`Lobby created: ${lobby.id} - ${lobby.name}`);

    // Try to create lobby in Dota 2 GC (async, don't wait)
    this.createLobbyInGC(lobby.id, {
      name: lobby.name,
      password: lobbyPassword,
      serverRegion: lobby.serverRegion,
      gameMode: lobby.gameMode,
      playerSteamIds: players.map(p => p.steamId),
    }).catch(err => {
      this.logger.error(`Failed to create lobby in GC: ${err.message}`);
    });

    return this.formatLobbyResponse(lobby);
  }

  /**
   * Get lobby by ID
   */
  async getLobby(id: string): Promise<LobbyResponse> {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    return this.formatLobbyResponse(lobby);
  }

  /**
   * Get all active lobbies
   */
  async getActiveLobbies(): Promise<LobbyResponse[]> {
    const lobbies = await this.prisma.lobby.findMany({
      where: {
        status: {
          in: [
            LobbyStatus.CREATED,
            LobbyStatus.INVITES_SENT,
            LobbyStatus.PLAYERS_JOINING,
            LobbyStatus.READY,
            LobbyStatus.LAUNCHING,
          ],
        },
      },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return lobbies.map(l => this.formatLobbyResponse(l));
  }

  /**
   * Get lobbies for a specific player
   */
  async getPlayerLobbies(playerId: string): Promise<LobbyResponse[]> {
    const lobbies = await this.prisma.lobby.findMany({
      where: {
        players: {
          some: { playerId },
        },
      },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return lobbies.map(l => this.formatLobbyResponse(l));
  }

  /**
   * Update lobby status
   */
  async updateLobbyStatus(id: string, status: LobbyStatus): Promise<LobbyResponse> {
    const updateData: Prisma.LobbyUpdateInput = { status };

    // Add timestamps based on status
    if (status === LobbyStatus.IN_GAME) {
      updateData.launchedAt = new Date();
    } else if (status === LobbyStatus.FINISHED) {
      updateData.finishedAt = new Date();
    } else if (status === LobbyStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    const lobby = await this.prisma.lobby.update({
      where: { id },
      data: updateData,
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    this.logger.log(`Lobby ${id} status updated to ${status}`);
    return this.formatLobbyResponse(lobby);
  }

  /**
   * Mark player as joined
   */
  async markPlayerJoined(lobbyId: string, playerId: string, team?: LobbyTeam, slot?: number): Promise<void> {
    await this.prisma.lobbyPlayer.update({
      where: {
        lobbyId_playerId: { lobbyId, playerId },
      },
      data: {
        joined: true,
        joinedAt: new Date(),
        team: team || undefined,
        slot: slot !== undefined ? slot : undefined,
      },
    });

    // Check if all players have joined
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: true },
    });

    if (lobby && lobby.players.every(p => p.joined)) {
      await this.updateLobbyStatus(lobbyId, LobbyStatus.READY);
    }
  }

  /**
   * Cancel a lobby
   */
  async cancelLobby(id: string, reason?: string): Promise<void> {
    const lobby = await this.prisma.lobby.findUnique({ where: { id } });
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    // Can only cancel if not in game
    if (lobby.status === LobbyStatus.IN_GAME || lobby.status === LobbyStatus.FINISHED) {
      throw new BadRequestException('Cannot cancel lobby that is in game or finished');
    }

    await this.updateLobbyStatus(id, LobbyStatus.CANCELLED);

    // Try to destroy lobby in GC
    this.destroyLobbyInGC(id).catch(err => {
      this.logger.error(`Failed to destroy lobby in GC: ${err.message}`);
    });

    this.logger.log(`Lobby ${id} cancelled: ${reason || 'No reason provided'}`);
  }

  /**
   * Launch the lobby game
   */
  async launchLobby(id: string): Promise<void> {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id },
      include: { players: true },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.status !== LobbyStatus.READY) {
      throw new BadRequestException('Lobby is not ready to launch');
    }

    // Check minimum players (5v5 = 10)
    const joinedPlayers = lobby.players.filter(p => p.joined);
    if (joinedPlayers.length < 6) {
      throw new BadRequestException('Need at least 6 players to launch');
    }

    await this.updateLobbyStatus(id, LobbyStatus.LAUNCHING);

    // Launch in GC
    this.launchLobbyInGC(id).catch(err => {
      this.logger.error(`Failed to launch lobby in GC: ${err.message}`);
    });
  }

  /**
   * Handle webhook from GC service
   */
  async handleGCWebhook(lobbyId: string, data: any): Promise<void> {
    this.logger.log(`GC Webhook for lobby ${lobbyId}: ${JSON.stringify(data)}`);

    if (data.dotaLobbyId) {
      await this.prisma.lobby.update({
        where: { id: lobbyId },
        data: { dotaLobbyId: BigInt(data.dotaLobbyId) },
      });
    }

    if (data.matchId) {
      await this.prisma.lobby.update({
        where: { id: lobbyId },
        data: { matchId: BigInt(data.matchId) },
      });
    }

    if (data.status) {
      const statusMap: Record<string, LobbyStatus> = {
        'CREATED': LobbyStatus.CREATED,
        'INVITES_SENT': LobbyStatus.INVITES_SENT,
        'PLAYERS_JOINING': LobbyStatus.PLAYERS_JOINING,
        'READY': LobbyStatus.READY,
        'LAUNCHING': LobbyStatus.LAUNCHING,
        'IN_GAME': LobbyStatus.IN_GAME,
        'FINISHED': LobbyStatus.FINISHED,
        'CANCELLED': LobbyStatus.CANCELLED,
        'FAILED': LobbyStatus.FAILED,
      };

      if (statusMap[data.status]) {
        await this.updateLobbyStatus(lobbyId, statusMap[data.status]);

        // Trigger match registration when lobby finishes
        if (data.status === 'FINISHED' && data.matchId) {
          this.registerCompletedLobbyMatch(lobbyId, Number(data.matchId))
            .catch(err => this.logger.error(`Failed to register match for lobby ${lobbyId}: ${err.message}`));
        }
      }
    }

    if (data.playerJoined) {
      const player = await this.prisma.player.findUnique({
        where: { accountId: data.playerJoined.accountId },
      });
      if (player) {
        await this.markPlayerJoined(lobbyId, player.id, data.playerJoined.team, data.playerJoined.slot);
      }
    }
  }

  /**
   * Register a completed lobby match to the league
   */
  private async registerCompletedLobbyMatch(lobbyId: string, matchId: number): Promise<void> {
    this.logger.log(`Registering match ${matchId} from lobby ${lobbyId}`);

    // Wait for OpenDota to parse the match (usually takes 5-10 minutes)
    // We'll try immediately and retry a few times if not found
    const maxAttempts = 3;
    const delayMs = 60000; // 1 minute between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.matchDetection.registerMatch(matchId, 'automatic', undefined);
        
        if (result.success) {
          this.logger.log(`Match ${matchId} registered successfully from lobby ${lobbyId}`);
          // The Lobby.leagueMatch relation is automatically established through the matching matchId
          return;
        }

        if (result.error === 'MATCH_NOT_FOUND' && attempt < maxAttempts) {
          this.logger.log(`Match ${matchId} not found in OpenDota yet (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        this.logger.warn(`Failed to register match ${matchId}: ${result.message}`);
        return;
      } catch (error) {
        this.logger.error(`Error registering match ${matchId}: ${error}`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  // ======= GC Communication Methods =======

  private async createLobbyInGC(lobbyId: string, options: {
    name: string;
    password: string;
    serverRegion: number;
    gameMode: number;
    playerSteamIds: string[];
  }): Promise<void> {
    try {
      const response = await fetch(`${this.gcServiceUrl}/lobby/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error(`GC returned ${response.status}`);
      }

      const result = await response.json();
      this.logger.log(`Lobby created in GC: ${JSON.stringify(result)}`);

      // Update status
      await this.updateLobbyStatus(lobbyId, LobbyStatus.INVITES_SENT);
    } catch (error) {
      this.logger.error(`GC createLobby failed: ${error}`);
      await this.updateLobbyStatus(lobbyId, LobbyStatus.FAILED);
      throw error;
    }
  }

  private async launchLobbyInGC(lobbyId: string): Promise<void> {
    try {
      const response = await fetch(`${this.gcServiceUrl}/lobby/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId }),
      });

      if (!response.ok) {
        throw new Error(`GC returned ${response.status}`);
      }

      await this.updateLobbyStatus(lobbyId, LobbyStatus.IN_GAME);
    } catch (error) {
      this.logger.error(`GC launchLobby failed: ${error}`);
      throw error;
    }
  }

  private async destroyLobbyInGC(lobbyId: string): Promise<void> {
    try {
      const response = await fetch(`${this.gcServiceUrl}/lobby/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId }),
      });

      if (!response.ok) {
        throw new Error(`GC returned ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`GC destroyLobby failed: ${error}`);
      throw error;
    }
  }

  // ======= Helper Methods =======

  private formatLobbyResponse(lobby: any): LobbyResponse {
    return {
      id: lobby.id,
      dotaLobbyId: lobby.dotaLobbyId,
      name: lobby.name,
      password: lobby.password,
      serverRegion: lobby.serverRegion,
      gameMode: lobby.gameMode,
      status: lobby.status,
      createdAt: lobby.createdAt,
      players: lobby.players.map((lp: any) => ({
        id: lp.player.id,
        steamId: lp.player.steamId,
        personaName: lp.player.personaName,
        team: lp.team,
        slot: lp.slot,
        joined: lp.joined,
      })),
    };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
