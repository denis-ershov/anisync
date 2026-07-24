import test from 'node:test';
import assert from 'node:assert/strict';

import {
  belongsToCatchingUp,
  belongsToScheduleDay,
  isRecentlyAiredForToday,
} from '@/lib/integrations/schedule-day';

test('today keeps same-calendar-day episode after it aired', () => {
  const now = new Date('2026-07-24T18:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-24T09:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 0, now), true);
  assert.equal(belongsToCatchingUp(anime, now), false);
});

test('today keeps episode aired a few hours ago even if calendar day shifted', () => {
  const now = new Date('2026-07-24T03:00:00+03:00');
  // Эфир «сегодня утром по JST» → предыдущий календарный день в UTC+3
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-23T21:00:00+03:00',
  };

  assert.equal(isRecentlyAiredForToday(anime, now), true);
  assert.equal(belongsToScheduleDay(anime, 0, now), true);
  assert.equal(belongsToCatchingUp(anime, now), false);
});

test('older aired episode goes to catching up, not today', () => {
  const now = new Date('2026-07-24T18:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-20T12:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 0, now), false);
  assert.equal(belongsToCatchingUp(anime, now), true);
});

test('future day match still works for tomorrow', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-25T15:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 1, now), true);
  assert.equal(belongsToScheduleDay(anime, 0, now), false);
});
