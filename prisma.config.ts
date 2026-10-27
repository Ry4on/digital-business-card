import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/prisma/seed.js' },
  // Generation/build do not need a live database; migrations still require DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/business_card' },
});
