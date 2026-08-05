import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUpcomingCacheKey } from '../src/lib/integrations/tmdb/cache-keys';
import { getCurrentCatalogWindow } from '../src/lib/integrations/tmdb/client';
import { resolveCatalogWindow } from '../src/lib/services/release-catalog-aggregator';

test('resolveCatalogWindow defaults to current+next calendar month (aligned with TMDB)', () => {
  const prev = process.env.RELEASES_CATALOG_WINDOW_DAYS;
  delete process.env.RELEASES_CATALOG_WINDOW_DAYS;

  try {
    const now = new Date(2026, 7, 5); // 5 Aug 2026
    const window = resolveCatalogWindow(now);
    const expected = getCurrentCatalogWindow(now);

    assert.equal(window.from, expected.from);
    assert.equal(window.toExclusive, expected.toExclusive);
    assert.equal(window.from, '2026-08-01');
    assert.equal(window.toExclusive, '2026-10-01');
    assert.ok(window.days >= 60);
  } finally {
    if (prev === undefined) {
      delete process.env.RELEASES_CATALOG_WINDOW_DAYS;
    } else {
      process.env.RELEASES_CATALOG_WINDOW_DAYS = prev;
    }
  }
});

test('resolveCatalogWindow respects RELEASES_CATALOG_WINDOW_DAYS rolling override', () => {
  const prev = process.env.RELEASES_CATALOG_WINDOW_DAYS;
  process.env.RELEASES_CATALOG_WINDOW_DAYS = '14';

  try {
    const now = new Date(2026, 7, 5); // 5 Aug 2026
    const window = resolveCatalogWindow(now);

    assert.equal(window.from, '2026-08-05');
    assert.equal(window.toExclusive, '2026-08-19');
    assert.equal(window.days, 14);
  } finally {
    if (prev === undefined) {
      delete process.env.RELEASES_CATALOG_WINDOW_DAYS;
    } else {
      process.env.RELEASES_CATALOG_WINDOW_DAYS = prev;
    }
  }
});

test('buildUpcomingCacheKey includes date window to avoid cross-window collisions', () => {
  const a = buildUpcomingCacheKey('ru', {
    page: 1,
    pageSize: 24,
    type: 'all',
    sort: 'popularity',
    genreId: null,
    from: '2026-08-01',
    toExclusive: '2026-10-01',
  });
  const b = buildUpcomingCacheKey('ru', {
    page: 1,
    pageSize: 24,
    type: 'all',
    sort: 'popularity',
    genreId: null,
    from: '2026-08-05',
    toExclusive: '2026-08-19',
  });

  assert.notEqual(a, b);
  assert.match(a, /2026-08-01:2026-10-01/);
});
