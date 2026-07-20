import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEnv } from '@/lib/config';

test('parseEnv accepts APP_BASE_URL fallback from NEXT_PUBLIC_BASE_URL', () => {
  const env = parseEnv({
    NEXT_PUBLIC_BASE_URL: 'http://localhost:9002',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anisync',
    JWT_SECRET: 'super-secret-key-123',
  });

  assert.equal(env.APP_BASE_URL, 'http://localhost:9002');
  assert.equal(env.NEXT_PUBLIC_BASE_URL, 'http://localhost:9002');
  assert.equal(env.SHIKIMORI_BASE_URL, 'https://shikimori.one');
});

test('parseEnv rejects invalid JWT secret', () => {
  assert.throws(
    () =>
      parseEnv({
        APP_BASE_URL: 'http://localhost:9002',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:9002',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anisync',
        JWT_SECRET: 'short-secret',
      }),
    /Invalid environment configuration/
  );
});
