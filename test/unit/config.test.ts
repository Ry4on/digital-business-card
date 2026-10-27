import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config';

const databaseUrl = 'postgresql://card:private-password@localhost:5432/card_test';

test('config accepts PostgreSQL URLs and defaults the application port', () => {
  assert.deepEqual(readConfig({ DATABASE_URL: databaseUrl }), { databaseUrl, port: 3000 });
  assert.equal(readConfig({ DATABASE_URL: databaseUrl, PORT: '4000' }).port, 4000);
  assert.equal(readConfig({ DATABASE_URL: 'postgres://localhost/card_test', PORT: '65535' }).port, 65535);
});

test('config rejects missing, malformed and unsupported database URLs without leaking values', () => {
  for (const value of [undefined, '', 'not-a-url-private-password', 'https://user:private-password@example.com']) {
    assert.throws(() => readConfig({ DATABASE_URL: value }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DATABASE_URL/);
      assert.ok(!error.message.includes('private-password'));
      return true;
    });
  }
});

test('config rejects ports outside the valid integer range without leaking the database URL', () => {
  for (const port of ['0', '-1', '65536', '3000.5', '', 'abc']) {
    assert.throws(() => readConfig({ DATABASE_URL: databaseUrl, PORT: port }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /PORT must be an integer/);
      assert.ok(!error.message.includes('private-password'));
      return true;
    });
  }
});
