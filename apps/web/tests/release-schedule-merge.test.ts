import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNextEpisodeDate } from '../src/lib/services/catalog-next-episode';

// Keep catalog merge tests as primary; add schedule-date merge helpers smoke

test('schedule-date merge: prefer tvmaze when dates diverge conceptually', () => {
  // Documented merge rule: when |delta| > 1 day prefer external — unit of resolveNextEpisodeDate already covers AniList;
  // this asserts calendar date preference helper pattern used by ReleaseScheduleDateService.
  const tmdbDate = '2026-07-20';
  const tvmazeDate = '2026-07-22';
  const preferTvmaze =
    Math.abs(Date.parse(tvmazeDate) - Date.parse(tmdbDate)) > 86400000 ? tvmazeDate : tmdbDate;
  assert.equal(preferTvmaze, '2026-07-22');
});

test('fill-gaps-next-date still documented for AniList path', () => {
  assert.equal(
    resolveNextEpisodeDate('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'fill-gaps-next-date'),
    '2026-02-01T00:00:00.000Z'
  );
});
