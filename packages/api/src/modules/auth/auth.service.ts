import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenDotaService } from '../../services/opendota/opendota.service';
import { Glicko2Service } from '../../services/rating/glicko2.service';
import { steamId64ToAccountId } from '@dota-league/shared';

export interface SteamProfile {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private openDota: OpenDotaService,
    private glicko2: Glicko2Service,
  ) {}

  async validateSteamUser(profile: SteamProfile) {
    const steamId = profile.steamid;
    const accountId = steamId64ToAccountId(steamId);

    // Check if player exists
    let player = await this.prisma.player.findUnique({
      where: { steamId },
    });

    if (!player) {
      // Auto-register new player
      const defaultRating = this.glicko2.createPlayer();

      player = await this.prisma.player.create({
        data: {
          steamId,
          accountId,
          personaName: profile.personaname,
          avatar: profile.avatar,
          avatarFull: profile.avatarfull,
          profileUrl: profile.profileurl,
          rating: defaultRating.rating,
          ratingDeviation: defaultRating.rd,
          volatility: defaultRating.volatility,
        },
      });

      this.logger.log(`New player registered via Steam login: ${player.personaName}`);
    } else {
      // Update profile info
      player = await this.prisma.player.update({
        where: { steamId },
        data: {
          personaName: profile.personaname,
          avatar: profile.avatar,
          avatarFull: profile.avatarfull,
          profileUrl: profile.profileurl,
        },
      });
    }

    return player;
  }

  async getUser(playerId: string) {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        steamId: true,
        accountId: true,
        personaName: true,
        avatar: true,
        avatarFull: true,
        rating: true,
        ratingDeviation: true,
        wins: true,
        losses: true,
        winStreak: true,
        lastMatchAt: true,
        createdAt: true,
      },
    });
  }
}
