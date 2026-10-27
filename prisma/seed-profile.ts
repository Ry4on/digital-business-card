import { createHash } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PROFILE_ID } from '../src/profile/profile.constants';
import { ProfileData } from './profile-data';

function id(kind: string, value: string): string {
  return `${kind}_${createHash('sha256').update(`${PROFILE_ID}:${value}`).digest('hex').slice(0, 24)}`;
}

export async function seedProfile(client: PrismaClient, data: ProfileData): Promise<void> {
  await client.$transaction(async tx => {
    // Serialize repeated startup/seed processes for this single profile.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${PROFILE_ID}))`;
    await tx.profile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, name: data.name, description: data.description },
      update: { name: data.name, description: data.description },
    });
    // This read-only card is fully managed by the JSON file. Replace only its collections.
    await tx.professionalLink.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.skill.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.experience.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.project.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.professionalLink.createMany({ data: data.links.map((v, sortOrder) => ({
      ...v, id: id('link', v.label), profileId: PROFILE_ID, sortOrder,
    })) });
    await tx.skill.createMany({ data: data.skills.map((name, sortOrder) => ({
      id: id('skill', name), name, profileId: PROFILE_ID, sortOrder,
    })) });
    await tx.experience.createMany({ data: data.experience.map((v, sortOrder) => ({
      ...v,
      id: id('experience', `${v.company}:${v.position}:${v.startDate}`),
      profileId: PROFILE_ID,
      startDate: new Date(`${v.startDate}T00:00:00.000Z`),
      endDate: v.endDate === null ? null : new Date(`${v.endDate}T00:00:00.000Z`),
      sortOrder,
    })) });
    await tx.project.createMany({ data: data.projects.map((v, sortOrder) => ({
      ...v, id: id('project', v.name), profileId: PROFILE_ID, sortOrder,
    })) });
  });
}
