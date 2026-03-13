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
    @Query('limit') limit: number = 50,
    @Query('minMatches') minMatches: number = 0,
  ) {
    return this.leaderboardService.getLeaderboard(limit, minMatches);
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
  async getRecentActivity(@Query('limit') limit: number = 10) {
    return this.leaderboardService.getRecentActivity(limit);
  }
}
