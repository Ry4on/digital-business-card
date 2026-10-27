import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readConfig } from '../config';
import { createPrismaClient } from './create-prisma-client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = createPrismaClient(readConfig().databaseUrl);

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
