import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('📦 Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }
    
    // Delete in order respecting foreign keys
    await this.matchPlayer.deleteMany();
    await this.ratingHistory.deleteMany();
    await this.leagueMatch.deleteMany();
    await this.pendingMatch.deleteMany();
    await this.inviteCode.deleteMany();
    await this.player.deleteMany();
  }
}
