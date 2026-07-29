import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNextEpisodeDate } from '../src/lib/services/catalog-next-episode';

test('fill-gaps keeps existing nextEpisodeDate when already set', () => {
  assert.equal(
    resolveNextEpisodeDate('2026-07-24T09:00:00.000Z', '2026-07-25T12:00:00.000Z', 'fill-gaps'),
    '2026-07-24T09:00:00.000Z'
  );
});

test('fill-gaps uses incoming when existing is blank', () => {
  assert.equal(
    resolveNextEpisodeDate(null, '2026-07-25T12:00:00.000Z', 'fill-gaps'),
    '2026-07-25T12:00:00.000Z'
  );
  assert.equal(
    resolveNextEpisodeDate('  ', '2026-07-25T12:00:00.000Z', 'fill-gaps'),
    '2026-07-25T12:00:00.000Z'
  );
});

test('fill-gaps-next-date overrides existing with AniList incoming', () => {
  assert.equal(
    resolveNextEpisodeDate('2026-07-24T09:00:00.000Z', '2026-07-25T12:00:00.000Z', 'fill-gaps-next-date'),
    '2026-07-25T12:00:00.000Z'
  );
});

test('fill-gaps-next-date keeps existing when incoming is empty', () => {
  assert.equal(
    resolveNextEpisodeDate('2026-07-24T09:00:00.000Z', null, 'fill-gaps-next-date'),
    '2026-07-24T09:00:00.000Z'
  );
  assert.equal(
    resolveNextEpisodeDate('2026-07-24T09:00:00.000Z', '', 'fill-gaps-next-date'),
    '2026-07-24T09:00:00.000Z'
  );
});

test('replace prefers incoming when present', () => {
  assert.equal(
    resolveNextEpisodeDate('2026-07-24T09:00:00.000Z', '2026-07-31T17:00:00.000Z', 'replace'),
    '2026-07-31T17:00:00.000Z'
  );
});
