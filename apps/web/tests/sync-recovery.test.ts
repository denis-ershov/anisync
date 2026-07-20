import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRefreshIntegrationToken } from '../src/lib/services/integration-service';
import { isRunningSyncJobStale } from '../src/lib/services/sync-service';

test('refreshes provider tokens even when they expired more than one day ago', () => {
  const now = new Date('2026-04-12T12:00:00.000Z');
  const expiredAt = new Date('2026-04-01T15:41:00.732Z');

  assert.equal(shouldRefreshIntegrationToken(expiredAt, now), true);
});

test('treats long-running sync jobs as stale after the timeout window', () => {
  const now = new Date('2026-04-12T12:00:00.000Z');
  const startedAt = new Date('2026-04-12T11:00:00.000Z');

  assert.equal(isRunningSyncJobStale(startedAt, now), true);
});

test('does not treat recently started sync jobs as stale', () => {
  const now = new Date('2026-04-12T12:00:00.000Z');
  const startedAt = new Date('2026-04-12T11:45:00.000Z');

  assert.equal(isRunningSyncJobStale(startedAt, now), false);
});
