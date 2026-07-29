import test from 'node:test';
import assert from 'node:assert/strict';

import {
  belongsToCatchingUp,
  belongsToScheduleDay,
  getLatestAiredInstant,
  isRecentlyAiredForToday,
} from '@/lib/integrations/schedule-day';
import { formatNextEpisodeShort, zonedDateKey } from '@/lib/timezone';

const TZ = { timeZone: 'Europe/Moscow' };

test('today keeps same-calendar-day episode after it aired', () => {
  const now = new Date('2026-07-24T18:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-24T09:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), true);
  assert.equal(belongsToCatchingUp(anime, now, TZ), false);
});

test('yesterday airing is not today even within 24h', () => {
  const now = new Date('2026-07-24T03:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-23T21:00:00+03:00',
  };

  assert.equal(isRecentlyAiredForToday(anime, now, TZ), false);
  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), false);
  assert.equal(belongsToCatchingUp(anime, now, TZ), true);
});

test('older aired episode goes to catching up, not today', () => {
  const now = new Date('2026-07-24T18:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-20T12:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), false);
  assert.equal(belongsToCatchingUp(anime, now, TZ), true);
});

test('future day match still works for tomorrow', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-25T15:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 1, now, TZ), true);
  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), false);
});

test('after Shiki moves next +7d, today still shows implied previous airing', () => {
  const now = new Date('2026-07-24T19:30:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-31T17:00:00+03:00',
  };

  const latest = getLatestAiredInstant(anime, now, TZ);
  assert.ok(latest);
  assert.equal(latest!.toISOString(), new Date('2026-07-24T17:00:00+03:00').toISOString());
  assert.equal(isRecentlyAiredForToday(anime, now, TZ), true);
  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), true);
  assert.equal(belongsToCatchingUp(anime, now, TZ), false);
  assert.equal(belongsToScheduleDay(anime, 6, now, TZ), false);
});

test('exactly +7 next without today implication goes to catching-up', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-30T12:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 6, now, TZ), true);
  assert.equal(belongsToCatchingUp(anime, now, TZ), false);
});

test('timezone shifts calendar day for UTC midnight airings', () => {
  const now = new Date('2026-07-24T22:00:00Z'); // 01:00 25 Jul Moscow
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-24T22:30:00Z', // 01:30 25 Jul Moscow
  };

  assert.equal(zonedDateKey(now, 'Europe/Moscow'), '2026-07-25');
  assert.equal(belongsToScheduleDay(anime, 0, now, { timeZone: 'Europe/Moscow' }), true);
  assert.equal(belongsToScheduleDay(anime, 0, now, { timeZone: 'UTC' }), true);
});

test('formatNextEpisodeShort stays compact', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  assert.match(
    formatNextEpisodeShort(new Date('2026-07-24T12:40:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    /мин/
  );
  assert.match(
    formatNextEpisodeShort(new Date('2026-07-24T15:00:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    /ч/
  );
  assert.match(
    formatNextEpisodeShort(new Date('2026-07-30T12:00:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    /дн/
  );
});
