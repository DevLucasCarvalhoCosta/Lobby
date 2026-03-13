import { Module } from '@nestjs/common';
import { MatchDetectionService } from './match-detection.service';
import { OpenDotaModule } from '../opendota/opendota.module';
import { RatingModule } from '../rating/rating.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, OpenDotaModule, RatingModule],
  providers: [MatchDetectionService],
  exports: [MatchDetectionService],
})
export class MatchDetectionModule {}
