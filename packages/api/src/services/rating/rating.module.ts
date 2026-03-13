import { Module } from '@nestjs/common';
import { Glicko2Service } from './glicko2.service';

@Module({
  providers: [Glicko2Service],
  exports: [Glicko2Service],
})
export class RatingModule {}
