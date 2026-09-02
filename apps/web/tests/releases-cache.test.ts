import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUpcomingCacheKey,
  UPCOMING_PRECOMPUTE_COMBOS,
} from '../src/lib/integrations/tmdb/cache-keys';
import {
  ReleaseWatchlistRefreshService,
  WATCHLIST_SCHEDULE_STALE_MS,
} from '../src/lib/services/release-watchlist-refresh-service';

test('buildUpcomingCacheKey encodes catalog filters', () => {
  assert.equal(
    buildUpcomingCacheKey('en', {
      page: 1,
      pageSize: 25,
      type: 'all',
      sort: 'popularity',
      genreId: null,
    }),
    'tmdb:upcoming:v3:en:all:popularity:0:1:25:default'
  );
  assert.equal(
    buildUpcomingCacheKey('ru', {
      page: 2,
      pageSize: 50,
      type: 'movie',
      sort: 'releaseDate',
      genreId: 28,
      from: '2026-08-01',
      toExclusive: '2026-10-01',
    }),
    'tmdb:upcoming:v3:ru:movie:releaseDate:28:2:50:2026-08-01:2026-10-01'
  );
});

test('precompute combos cover both locales and core filters', () => {
  const langs = new Set(UPCOMING_PRECOMPUTE_COMBOS.map((combo) => combo.lang));
  assert.equal(langs.has('en'), true);
  assert.equal(langs.has('ru'), true);
  assert.ok(UPCOMING_PRECOMPUTE_COMBOS.length >= 6);
});

test('isScheduleStale treats missing timestamps as stale', () => {
  const now = Date.now();
  assert.equal(ReleaseWatchlistRefreshService.isScheduleStale(null, now), true);
  assert.equal(
    ReleaseWatchlistRefreshService.isScheduleStale(new Date(now - WATCHLIST_SCHEDULE_STALE_MS - 1), now),
    true
  );
  assert.equal(
    ReleaseWatchlistRefreshService.isScheduleStale(new Date(now - 60_000), now),
    false
  );
});
