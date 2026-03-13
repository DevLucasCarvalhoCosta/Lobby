import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { ConfigService } from '@nestjs/config';
import { AuthService, SteamProfile } from './auth.service';

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      returnURL: `${configService.get('API_URL')}/auth/steam/callback`,
      realm: configService.get('API_URL'),
      apiKey: configService.get('STEAM_API_KEY'),
    });
  }

  async validate(
    identifier: string,
    profile: { _json: SteamProfile },
    done: (error: Error | null, user?: any) => void,
  ) {
    try {
      const user = await this.authService.validateSteamUser(profile._json);
      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }
}
