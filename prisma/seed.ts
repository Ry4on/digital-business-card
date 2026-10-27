import 'dotenv/config';
import { createPrismaClient } from '../src/database/create-prisma-client';
import { readConfig } from '../src/config';
import { loadProfileData } from './profile-data';
import { seedProfile } from './seed-profile';

async function main(): Promise<void> {
  // Validate before opening a transaction so invalid JSON cannot replace existing data.
  const data = loadProfileData();
  const client = createPrismaClient(readConfig().databaseUrl);
  try {
    await seedProfile(client, data);
    process.stdout.write('Profile initialized.\n');
  } finally {
    await client.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write('Profile initialization failed. Check data/profile.json and database availability.\n');
  process.exitCode = 1;
});
