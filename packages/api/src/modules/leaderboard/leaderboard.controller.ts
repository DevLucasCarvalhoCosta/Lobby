import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get the league leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max players to return' })
  @ApiQuery({ name: 'minMatches', required: false, type: Number, description: 'Minimum matches to be ranked' })
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('minMatches') minMatches?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedMinMatches = minMatches ? parseInt(minMatches, 10) : 0;
    return this.leaderboardService.getLeaderboard(parsedLimit, parsedMinMatches);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get league statistics' })
  async getLeagueStats() {
    return this.leaderboardService.getLeagueStats();
  }

  @Get('top-performers')
  @ApiOperation({ summary: 'Get top performers by category' })
  async getTopPerformers() {
    return this.leaderboardService.getTopPerformers();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent league activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.leaderboardService.getRecentActivity(limit ? parseInt(limit, 10) : 10);
  }
}
