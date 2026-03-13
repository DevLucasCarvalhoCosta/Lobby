import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all league players' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['rating', 'wins', 'winRate', 'recentActivity'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllPlayers(
    @Query('sortBy') sortBy: string = 'rating',
    @Query('limit') limit: number = 100,
  ) {
    return this.playersService.getAllPlayers(sortBy, limit);
  }

  @Get(':idOrSteamId')
  @ApiOperation({ summary: 'Get player by ID or Steam ID' })
  async getPlayer(@Param('idOrSteamId') idOrSteamId: string) {
    // Check if it looks like a Steam ID (17 digit number starting with 7656)
    const isSteamId = /^7656\d{13}$/.test(idOrSteamId);
    
    const player = isSteamId
      ? await this.playersService.getPlayerBySteamId(idOrSteamId)
      : await this.playersService.getPlayerById(idOrSteamId);
      
    if (!player) {
      throw new HttpException('Player not found', HttpStatus.NOT_FOUND);
    }
    return player;
  }

  @Get('steam/:steamId')
  @ApiOperation({ summary: 'Get player by Steam ID (explicit route)' })
  async getPlayerBySteamId(@Param('steamId') steamId: string) {
    const player = await this.playersService.getPlayerBySteamId(steamId);
    if (!player) {
      throw new HttpException('Player not found', HttpStatus.NOT_FOUND);
    }
    return player;
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get player statistics' })
  async getPlayerStats(@Param('id') id: string) {
    const stats = await this.playersService.getPlayerStats(id);
    if (!stats) {
      throw new HttpException('Player not found', HttpStatus.NOT_FOUND);
    }
    return stats;
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Get player match history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getPlayerMatches(
    @Param('id') id: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ) {
    return this.playersService.getPlayerMatches(id, limit, offset);
  }

  @Get(':id/heroes')
  @ApiOperation({ summary: 'Get player hero statistics' })
  async getPlayerHeroes(@Param('id') id: string) {
    return this.playersService.getPlayerHeroes(id);
  }

  @Get(':id/rating-history')
  @ApiOperation({ summary: 'Get player rating history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPlayerRatingHistory(
    @Param('id') id: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.playersService.getPlayerRatingHistory(id, limit);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new player (by Steam ID)' })
  @ApiResponse({ status: 201, description: 'Player registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid Steam ID or player already exists' })
  async registerPlayer(@Body('steamId') steamId: string) {
    if (!steamId) {
      throw new HttpException('Steam ID is required', HttpStatus.BAD_REQUEST);
    }
    
    try {
      return await this.playersService.registerPlayer(steamId);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to register player',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync player profile from Steam/OpenDota' })
  async syncPlayer(@Param('id') id: string) {
    return this.playersService.syncPlayerProfile(id);
  }
}
