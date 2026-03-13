import { Module } from '@nestjs/common';
import { OpenDotaService } from './opendota.service';

@Module({
  providers: [OpenDotaService],
  exports: [OpenDotaService],
})
export class OpenDotaModule {}
