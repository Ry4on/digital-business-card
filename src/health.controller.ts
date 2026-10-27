import { Controller, Get, Redirect, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Redirect('/graphql', 302)
  index(): void {}

  @Get('health')
  async health(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
