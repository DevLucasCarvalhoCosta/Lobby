import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { PlayersModule } from './modules/players/players.module';
import { MatchesModule } from './modules/matches/matches.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { LobbyModule } from './modules/lobby/lobby.module';
import { OpenDotaModule } from './services/opendota/opendota.module';
import { RatingModule } from './services/rating/rating.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    
    // Scheduling for cron jobs
    ScheduleModule.forRoot(),
    
    // Database
    PrismaModule,
    
    // External Services
    OpenDotaModule,
    RatingModule,
    
    // Feature Modules
    PlayersModule,
    MatchesModule,
    LeaderboardModule,
    AuthModule,
    LobbyModule,
  ],
})
export class AppModule {}
