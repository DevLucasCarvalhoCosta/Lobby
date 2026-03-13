import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { OpenDotaModule } from '../../services/opendota/opendota.module';
import { RatingModule } from '../../services/rating/rating.module';

@Module({
  imports: [OpenDotaModule, RatingModule],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
