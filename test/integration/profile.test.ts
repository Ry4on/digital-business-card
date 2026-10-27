import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createPrismaClient } from '../../src/database/create-prisma-client';
import { PrismaService } from '../../src/database/prisma.service';
import { PROFILE_ID } from '../../src/profile/profile.constants';
import { ProfileRepository } from '../../src/profile/profile.repository';
import { loadProfileData, ProfileData } from '../../prisma/profile-data';
import { seedProfile } from '../../prisma/seed-profile';

// The seed synchronization cases modify data. Always point this at a disposable test database.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for integration tests; use a disposable PostgreSQL database');
process.env.DATABASE_URL = databaseUrl;

const fullQuery = `query BusinessCard {
  profile {
    name description
    links { label url }
    skills { name }
    experience { company position startDate endDate achievements }
    projects { name description url }
  }
}`;

function expectedProfile(data: ProfileData) {
  return {
    ...data,
    skills: data.skills.map(name => ({ name })),
    experience: data.experience.map(item => ({
      ...item,
      startDate: `${item.startDate}T00:00:00.000Z`,
      endDate: item.endDate === null ? null : `${item.endDate}T00:00:00.000Z`,
    })),
  };
}

test('PostgreSQL-backed business card', { timeout: 90_000 }, async t => {
  const source = loadProfileData();
  const client = createPrismaClient(databaseUrl);
  t.after(async () => {
    try {
      await seedProfile(client, source);
      await client.profile.deleteMany({ where: { id: 'integration-unrelated-profile' } });
    } finally {
      await client.$disconnect();
    }
  });
  await seedProfile(client, source);
  // AppModule is imported only after DATABASE_URL has been assigned to the explicit test database.
  const { AppModule } = await import('../../src/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();

  async function query(queryText = fullQuery): Promise<Record<string, unknown>> {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: queryText }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { data?: Record<string, unknown>; errors?: unknown };
    assert.equal(body.errors, undefined, JSON.stringify(body.errors));
    assert.ok(body.data);
    return body.data;
  }

  await t.test('full nested GraphQL query returns source data in source order', async () => {
    assert.deepEqual(await query(), { profile: expectedProfile(source) });
  });

  await t.test('root redirects to Sandbox, Sandbox is available, and readiness checks PostgreSQL', async () => {
    const root = await fetch(baseUrl, { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/graphql');
    const sandbox = await fetch(`${baseUrl}/graphql`, { headers: { accept: 'text/html' } });
    assert.equal(sandbox.status, 200);
    assert.match(sandbox.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await sandbox.text(), /Apollo|Sandbox/i);
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
  });

  await t.test('aliases, fragments and directives preserve nested selections', async () => {
    const result = await query(`query {
      card: profile {
        ...Header
        stack: skills { label: name }
        projects @skip(if: true) { name }
      }
    }
    fragment Header on Profile { name links { label url } }`);
    assert.deepEqual(result, {
      card: {
        name: source.name,
        links: source.links,
        stack: source.skills.map(label => ({ label })),
      },
    });
  });

  await t.test('repeated and concurrent seeds do not duplicate data or change stable identities', async () => {
    const before = await client.profile.findUniqueOrThrow({ where: { id: PROFILE_ID }, include: {
      links: true, skills: true, experience: true, projects: true,
    } });
    await seedProfile(client, source);
    await Promise.all([seedProfile(client, source), seedProfile(client, source)]);
    const after = await client.profile.findUniqueOrThrow({ where: { id: PROFILE_ID }, include: {
      links: true, skills: true, experience: true, projects: true,
    } });
    for (const field of ['links', 'skills', 'experience', 'projects'] as const) {
      assert.deepEqual(after[field].map(row => row.id).sort(), before[field].map(row => row.id).sort());
    }
    assert.deepEqual(await query(), { profile: expectedProfile(source) });
  });

  await t.test('seed synchronizes changed and removed rows while preserving unrelated profiles', async () => {
    await client.profile.create({ data: {
      id: 'integration-unrelated-profile', name: 'Other person', description: 'Keep me',
      skills: { create: { id: 'integration-unrelated-skill', name: 'Other skill', sortOrder: 0 } },
    } });
    const changed: ProfileData = {
      ...source,
      description: 'Updated profile',
      skills: ['SQL', 'Integration-only skill'],
      links: [{ label: 'Portfolio', url: 'https://example.com/portfolio' }],
      projects: [{ name: 'Changed project', description: 'Updated', url: 'https://example.com/project' }],
      experience: [{
        company: 'Changed company', position: 'Developer', startDate: '2025-01-01',
        endDate: null, achievements: ['Updated achievement'],
      }],
    };
    try {
      await seedProfile(client, changed);
      assert.deepEqual(await query(), { profile: expectedProfile(changed) });
      const other = await client.profile.findUniqueOrThrow({
        where: { id: 'integration-unrelated-profile' }, include: { skills: true },
      });
      assert.equal(other.name, 'Other person');
      assert.equal(other.skills[0]?.name, 'Other skill');
    } finally {
      await seedProfile(client, source);
      await client.profile.delete({ where: { id: 'integration-unrelated-profile' } });
    }
  });

  await t.test('a database constraint failure rolls back all seed changes', async () => {
    const invalid: ProfileData = {
      ...source, name: 'This update must roll back', skills: ['Duplicate', 'Duplicate'],
    };
    await assert.rejects(seedProfile(client, invalid));
    assert.deepEqual(await query(), { profile: expectedProfile(source) });
  });

  await t.test('actual SQL query count stays bounded when a collection grows to 100 items', async () => {
    const observedClient = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
      log: [{ emit: 'event', level: 'query' }],
    });
    let queryCount = 0;
    observedClient.$on('query', () => { queryCount += 1; });
    const repository = new ProfileRepository({ client: observedClient } as unknown as PrismaService);
    try {
      await observedClient.$connect();
      queryCount = 0;
      const initial = await repository.findProfile();
      assert.ok(initial);
      const initialQueryCount = queryCount;
      assert.ok(initialQueryCount > 0, 'Prisma must emit actual SQL query events for this assertion');
      assert.ok(initialQueryCount <= 5, `Expected at most five profile/relation reads, received ${initialQueryCount}`);
      const expanded = { ...source, skills: Array.from({ length: 100 }, (_, i) => `Skill ${i}`) };
      await seedProfile(client, expanded);
      queryCount = 0;
      const result = await repository.findProfile();
      assert.equal(result?.skills.length, 100);
      assert.equal(queryCount, initialQueryCount);
      assert.deepEqual(result.skills.map(item => item.name), expanded.skills);
      assert.deepEqual(await query(), { profile: expectedProfile(expanded) });
    } finally {
      await observedClient.$disconnect();
      await seedProfile(client, source);
    }
  });
});
