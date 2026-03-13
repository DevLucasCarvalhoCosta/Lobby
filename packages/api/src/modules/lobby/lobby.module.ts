import { Module } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlayersModule } from '../players/players.module';
import { MatchDetectionModule } from '../../services/match-detection/match-detection.module';

@Module({
  imports: [PrismaModule, PlayersModule, MatchDetectionModule],
  controllers: [LobbyController],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
