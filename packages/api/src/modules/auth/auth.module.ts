import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SteamStrategy } from './steam.strategy';
import { OpenDotaModule } from '../../services/opendota/opendota.module';
import { RatingModule } from '../../services/rating/rating.module';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    OpenDotaModule,
    RatingModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SteamStrategy],
  exports: [AuthService],
})
export class AuthModule {}
