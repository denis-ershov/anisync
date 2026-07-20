import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapLibraryStatusToAniList,
  mapLibraryStatusToMal,
  normalizeAniListStatus,
  normalizeMalStatus,
  normalizeShikimoriDate,
  toIsoOrNull,
} from '@/lib/integrations/provider-utils';

test('normalizeAniListStatus maps AniList statuses to local statuses', () => {
  assert.equal(normalizeAniListStatus('CURRENT'), 'watching');
  assert.equal(normalizeAniListStatus('REPEATING'), 'rewatching');
  assert.equal(normalizeAniListStatus('UNKNOWN'), 'planned');
});

test('normalizeMalStatus maps MAL statuses to local statuses', () => {
  assert.equal(normalizeMalStatus('plan_to_watch'), 'planned');
  assert.equal(normalizeMalStatus('completed'), 'completed');
  assert.equal(normalizeMalStatus('unexpected'), 'planned');
});

test('provider status mappers return expected provider values', () => {
  assert.equal(mapLibraryStatusToMal('planned'), 'plan_to_watch');
  assert.equal(mapLibraryStatusToMal('rewatching'), 'watching');
  assert.equal(mapLibraryStatusToAniList('not_interested'), 'DROPPED');
  assert.equal(mapLibraryStatusToAniList('rewatching'), 'REPEATING');
});

test('provider utility date helpers normalize values', () => {
  assert.equal(normalizeShikimoriDate({ date: '2024-01-15' }), '2024-01-15');
  assert.equal(normalizeShikimoriDate(null), null);
  assert.equal(toIsoOrNull(1700000000), new Date(1700000000 * 1000).toISOString());
  assert.equal(toIsoOrNull('2024-01-15T00:00:00Z'), '2024-01-15T00:00:00.000Z');
  assert.equal(toIsoOrNull('not-a-date'), null);
});
