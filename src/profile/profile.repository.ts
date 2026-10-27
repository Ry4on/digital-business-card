import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PROFILE_ID } from './profile.constants';

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfile() {
    // Load each collection once, rather than querying inside per-item field resolvers.
    // A single profile keeps the total bounded regardless of collection sizes.
    const orderBy = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];
    return this.prisma.client.profile.findUnique({
      where: { id: PROFILE_ID },
      include: {
        links: { orderBy },
        skills: { orderBy },
        experience: { orderBy },
        projects: { orderBy },
      },
    });
  }
}
