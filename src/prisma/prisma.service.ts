import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  [key: string]: any;

  constructor() {
    super({
      errorFormat: 'minimal',
      datasources: {
        db: {
          url: process.env.MONGO_DB_URL,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
