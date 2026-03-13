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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { MatchesService } from './matches.service';

class ReportMatchDto {
  reporterAccountId!: number;
  matchId?: number;
}

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all league matches' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  async getAllMatches(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.matchesService.getAllMatches(
      limit ? parseInt(limit, 10) : 20,
      skip ? parseInt(skip, 10) : 0
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent matches' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentMatches(@Query('limit') limit?: string) {
    return this.matchesService.getRecentMatches(limit ? parseInt(limit, 10) : 10);
  }

  @Get('detect')
  @ApiOperation({ summary: 'Detect potential league matches for current session user' })
  @ApiQuery({ name: 'accountId', required: true, type: Number })
  @ApiQuery({ name: 'hoursBack', required: false, type: Number })
  async detectMatchesForUser(
    @Query('accountId') accountId: string,
    @Query('hoursBack') hoursBack?: string,
  ) {
    const candidates = await this.matchesService.findPotentialMatches(
      parseInt(accountId, 10),
      hoursBack ? parseInt(hoursBack, 10) : 2
    );
    return { candidates };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  async getMatch(@Param('id') id: string) {
    const match = await this.matchesService.getMatchById(id);
    if (!match) {
      throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
    }
    return match;
  }

  @Get('dota/:matchId')
  @ApiOperation({ summary: 'Get match by Dota 2 match ID' })
  async getMatchByDotaId(@Param('matchId') matchId: string) {
    const match = await this.matchesService.getMatchByDotaId(BigInt(matchId));
    if (!match) {
      throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
    }
    return match;
  }

  @Post('report')
  @ApiOperation({ summary: 'Report/register a match' })
  @ApiBody({ type: ReportMatchDto })
  @ApiResponse({ status: 201, description: 'Match registered or candidates returned' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async reportMatch(@Body() body: ReportMatchDto) {
    if (!body.reporterAccountId) {
      throw new HttpException(
        'Reporter account ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // If match ID provided, register directly
    if (body.matchId) {
      const result = await this.matchesService.registerMatch(
        body.matchId,
        'manual',
        undefined,
      );

      if (!result.success) {
        throw new HttpException(
          result.message,
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    }

    // Otherwise, try auto-detection
    return this.matchesService.autoDetectMatch(body.reporterAccountId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a match (body: { matchId })' })
  @ApiBody({ schema: { properties: { matchId: { type: 'string' } } } })
  async registerMatchFromBody(@Body('matchId') matchId: string) {
    if (!matchId) {
      throw new HttpException('Match ID is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.matchesService.registerMatch(
      parseInt(matchId, 10),
      'manual',
      undefined,
    );

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return result;
  }

  @Post('register/:matchId')
  @ApiOperation({ summary: 'Register a specific match by Dota 2 match ID (path param)' })
  async registerMatch(
    @Param('matchId') matchId: string,
    @Body('reporterPlayerId') reporterPlayerId?: string,
  ) {
    const result = await this.matchesService.registerMatch(
      parseInt(matchId, 10),
      'manual',
      reporterPlayerId,
    );

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return result;
  }

  @Get('detect/:accountId')
  @ApiOperation({ summary: 'Find potential league matches for a player' })
  @ApiQuery({ name: 'hoursBack', required: false, type: Number })
  async detectMatches(
    @Param('accountId') accountId: string,
    @Query('hoursBack') hoursBack: number = 2,
  ) {
    return this.matchesService.findPotentialMatches(
      parseInt(accountId, 10),
      hoursBack,
    );
  }
}
