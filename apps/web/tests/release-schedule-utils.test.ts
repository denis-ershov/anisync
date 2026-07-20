import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReleaseWatchlistItem } from '../src/lib/releases/types';
import { buildWeekSchedule, localDateKey, scheduleDateOf } from '../src/lib/releases/utils';

function makeItem(overrides: Partial<ReleaseWatchlistItem>): ReleaseWatchlistItem {
  return {
    id: 1,
    tmdbId: 100,
    type: 'movie',
    title: 'Test',
    titleRu: null,
    status: 'plan',
    rating: 7,
    popularity: 100,
    posterPath: null,
    genre: 'Drama',
    genreRu: null,
    year: 2026,
    releaseDate: '2026-06-16',
    nextEpisodeSeason: null,
    nextEpisodeNumber: null,
    nextEpisodeDate: null,
    addedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

test('uses release date for movies and next episode date for shows', () => {
  const movie = makeItem({ type: 'movie', releaseDate: '2026-06-16' });
  const show = makeItem({
    id: 2,
    type: 'show',
    releaseDate: null,
    nextEpisodeSeason: 2,
    nextEpisodeNumber: 5,
    nextEpisodeDate: '2026-06-18',
  });

  assert.equal(scheduleDateOf(movie), '2026-06-16');
  assert.equal(scheduleDateOf(show), '2026-06-18');
});

test('builds a 7-day schedule from watchlist items', () => {
  const today = new Date(2026, 5, 16);
  const todayKey = localDateKey(today);

  const schedule = buildWeekSchedule(
    [
      makeItem({ id: 1, releaseDate: todayKey }),
      makeItem({
        id: 2,
        type: 'show',
        releaseDate: null,
        nextEpisodeDate: '2026-06-18',
        nextEpisodeSeason: 1,
        nextEpisodeNumber: 3,
      }),
      makeItem({ id: 3, status: 'watching', releaseDate: '2026-06-20' }),
    ],
    today
  );

  assert.equal(schedule.days.length, 7);
  assert.equal(schedule.todayItems.length, 1);
  assert.equal(schedule.days[0]?.items.length, 1);
  assert.equal(schedule.days[2]?.items.length, 1);
  assert.equal(schedule.days[4]?.items.length, 1);
});
