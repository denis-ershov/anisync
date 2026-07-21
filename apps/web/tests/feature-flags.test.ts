import test from 'node:test';
import assert from 'node:assert/strict';

import { isFeatureEnabled } from '@/lib/feature-flags.shared';
import { isQueuesEnabled, parseEnv } from '@/lib/config';

const baseEnv = {
  APP_BASE_URL: 'http://localhost:9002',
  NEXT_PUBLIC_BASE_URL: 'http://localhost:9002',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anisync',
  JWT_SECRET: 'super-secret-key-123',
};

test('isQueuesEnabled is false without REDIS_URL', () => {
  const parsed = parseEnv(baseEnv);
  assert.equal(isQueuesEnabled(parsed), false);
});

test('isQueuesEnabled is true when REDIS_URL is set', () => {
  const parsed = parseEnv({
    ...baseEnv,
    REDIS_URL: 'redis://localhost:6379',
  });
  assert.equal(isQueuesEnabled(parsed), true);
});

test('feature flags read env defaults', () => {
  const parsed = parseEnv({
    ...baseEnv,
    RELEASES_MODULE_ENABLED: 'true',
    TORRENTS_MODULE_ENABLED: 'false',
    MAINTENANCE_MODE: 'true',
  });

  assert.equal(isFeatureEnabled('releases', parsed), true);
  assert.equal(isFeatureEnabled('torrents', parsed), false);
  assert.equal(isFeatureEnabled('maintenance', parsed), true);
  assert.equal(isFeatureEnabled('registration', parsed), true);
});
