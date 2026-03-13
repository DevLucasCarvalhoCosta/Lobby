import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LobbyService, LobbyResponse } from './lobby.service';
import { LobbyStatus, LobbyTeam } from '@prisma/client';

// DTOs
class CreateLobbyDto {
  name: string;
  password?: string;
  serverRegion?: number;
  gameMode?: number;
  playerSteamIds: string[];
}

class WebhookDto {
  lobbyId: string;
  dotaLobbyId?: string;
  matchId?: string;
  status?: string;
  playerJoined?: {
    accountId: number;
    team?: LobbyTeam;
    slot?: number;
  };
}

@Controller('lobby')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  /**
   * Create a new lobby
   */
  @Post()
  async createLobby(@Body() dto: CreateLobbyDto, @Req() req: any) {
    // Get player ID from session
    const playerId = req.session?.player?.id;
    if (!playerId) {
      throw new Error('Not authenticated');
    }

    return this.lobbyService.createLobby({
      ...dto,
      createdById: playerId,
    });
  }

  /**
   * Get all active lobbies
   */
  @Get()
  async getActiveLobbies() {
    return this.lobbyService.getActiveLobbies();
  }

  /**
   * Get lobby by ID
   */
  @Get(':id')
  async getLobby(@Param('id') id: string) {
    return this.lobbyService.getLobby(id);
  }

  /**
   * Get lobbies for current player
   */
  @Get('my/lobbies')
  async getMyLobbies(@Req() req: any) {
    const playerId = req.session?.player?.id;
    if (!playerId) {
      throw new Error('Not authenticated');
    }
    return this.lobbyService.getPlayerLobbies(playerId);
  }

  /**
   * Launch a lobby
   */
  @Post(':id/launch')
  @HttpCode(HttpStatus.OK)
  async launchLobby(@Param('id') id: string) {
    await this.lobbyService.launchLobby(id);
    return { success: true };
  }

  /**
   * Cancel a lobby
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancelLobby(@Param('id') id: string, @Body() body: { reason?: string }) {
    await this.lobbyService.cancelLobby(id, body.reason);
    return { success: true };
  }

  /**
   * Webhook endpoint for GC service updates
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() dto: WebhookDto) {
    await this.lobbyService.handleGCWebhook(dto.lobbyId, dto);
    return { success: true };
  }

  /**
   * Get GC service status
   */
  @Get('gc/status')
  async getGCStatus() {
    const gcUrl = process.env.DOTA_GC_SERVICE_URL || 'http://localhost:8080';
    try {
      const response = await fetch(`${gcUrl}/status`);
      if (!response.ok) {
        return { connected: false, error: `HTTP ${response.status}` };
      }
      return await response.json();
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}
