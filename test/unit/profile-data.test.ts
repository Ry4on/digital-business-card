import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProfileData, ProfileData } from '../../prisma/profile-data';

function fixture(): ProfileData {
  return {
    name: 'Developer',
    description: 'Builds useful software.',
    links: [{ label: 'GitHub', url: 'https://github.com/example' }],
    skills: ['TypeScript', 'SQL'],
    experience: [{
      company: 'Example', position: 'Developer', startDate: '2024-02-29',
      endDate: null, achievements: ['Delivered an API.'],
    }],
    projects: [{ name: 'API', description: 'A GraphQL service.', url: 'https://example.com/api' }],
  };
}

test('profile parsing trims display text without mutating its source', () => {
  const input = fixture();
  input.name = '  Developer  ';
  input.skills[0] = ' TypeScript ';
  const result = parseProfileData(input);
  assert.equal(result.name, 'Developer');
  assert.equal(result.skills[0], 'TypeScript');
  assert.equal(result.experience[0]?.startDate, '2024-02-29');
  assert.equal(result.experience[0]?.endDate, null);
  assert.equal(input.name, '  Developer  ');
  assert.equal(input.skills[0], ' TypeScript ');
});

test('profile parsing rejects impossible calendar dates and reversed periods', () => {
  for (const invalid of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-2-01', 'invalid']) {
    const input = fixture();
    input.experience[0]!.startDate = invalid;
    assert.throws(() => parseProfileData(input), /experience\[0\]\.startDate/);
  }
  const input = fixture();
  input.experience[0]!.endDate = '2024-02-28';
  assert.throws(() => parseProfileData(input), /ends before it starts/);
});

test('profile parsing rejects duplicate collection identities after trimming', () => {
  const cases: [string, (input: ProfileData) => void][] = [
    ['skills', input => input.skills.push(' TypeScript ')],
    ['links', input => input.links.push({ label: 'GitHub', url: 'https://example.com' })],
    ['projects', input => input.projects.push({ ...input.projects[0]! })],
    ['experience', input => input.experience.push({ ...input.experience[0]! })],
  ];
  for (const [collection, mutate] of cases) {
    const input = fixture();
    mutate(input);
    assert.throws(() => parseProfileData(input), new RegExp(`${collection} contains duplicates`));
  }
});

test('profile parsing rejects credential-bearing and non-HTTP URLs without echoing secrets', () => {
  for (const url of ['https://user:private-token@example.com', 'javascript:alert(1)', 'file:///tmp/cv', 'invalid']) {
    for (const field of ['links', 'projects'] as const) {
      const input = fixture();
      input[field][0]!.url = url;
      assert.throws(() => parseProfileData(input), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /must be an HTTP\(S\) URL without credentials/);
        assert.ok(!error.message.includes('private-token'));
        return true;
      });
    }
  }
});

test('profile parsing rejects missing content instead of silently publishing an empty card', () => {
  assert.throws(() => parseProfileData(null), /profile must be an object/);
  const input = fixture();
  input.description = '  ';
  assert.throws(() => parseProfileData(input), /description must be a non-empty string/);
  for (const field of ['skills', 'links', 'projects', 'experience'] as const) {
    const empty = { ...fixture(), [field]: [] };
    assert.throws(() => parseProfileData(empty), new RegExp(`${field} must be a non-empty array`));
  }
});
