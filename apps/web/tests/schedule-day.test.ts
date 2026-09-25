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

test('anime with next episode in 7 days (same weekday) does not go to today, goes to catching-up', () => {
  const now = new Date('2026-07-24T19:30:00+03:00'); // Пятница
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-31T17:00:00+03:00', // Следующая пятница (+7 дней)
  };

  const latest = getLatestAiredInstant(anime, now, TZ);
  assert.equal(latest, null);
  assert.equal(isRecentlyAiredForToday(anime, now, TZ), false);
  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), false);
  for (let dayIndex = 1; dayIndex <= 6; dayIndex += 1) {
    assert.equal(belongsToScheduleDay(anime, dayIndex, now, TZ), false);
  }
  assert.equal(belongsToCatchingUp(anime, now, TZ), true);
});

test('episode in +6 days matches day 6 (last day of 7-day schedule)', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-30T12:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 6, now, TZ), true);
  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), false);
  assert.equal(belongsToCatchingUp(anime, now, TZ), false);
});

test('episode airing later today is in today schedule, not catching-up', () => {
  const now = new Date('2026-07-24T12:00:00+03:00');
  const anime = {
    watchStatus: 'watching' as const,
    nextEpisodeDate: '2026-07-24T18:00:00+03:00',
  };

  assert.equal(belongsToScheduleDay(anime, 0, now, TZ), true);
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

test('formatNextEpisodeShort stays compact and distinguishes today vs tomorrow', () => {
  const now = new Date('2026-07-24T12:00:00+03:00'); // Пятница 12:00

  // Меньше часа
  assert.equal(
    formatNextEpisodeShort(new Date('2026-07-24T12:40:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    'через 40 мин'
  );

  // В пределах 6 часов сегодня
  assert.equal(
    formatNextEpisodeShort(new Date('2026-07-24T15:00:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    'через 3 ч'
  );

  // Сегодня, но больше 6 часов
  assert.equal(
    formatNextEpisodeShort(new Date('2026-07-24T21:30:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    'сегодня 21:30'
  );

  // Завтра (больше 6 часов): должно быть «завтра 16:30», а НЕ «сегодня»!
  const tomorrowAfternoon = new Date('2026-07-25T16:30:00+03:00');
  const formattedTomorrow = formatNextEpisodeShort(tomorrowAfternoon, now, {
    timeZone: 'Europe/Moscow',
    locale: 'ru',
  });
  assert.equal(formattedTomorrow, 'завтра 16:30');
  assert.doesNotMatch(formattedTomorrow, /сегодня/);

  // Английская локаль для завтра
  assert.equal(
    formatNextEpisodeShort(tomorrowAfternoon, now, {
      timeZone: 'Europe/Moscow',
      locale: 'en',
    }),
    'tomorrow 16:30'
  );

  // Через 6 дней
  assert.equal(
    formatNextEpisodeShort(new Date('2026-07-30T12:00:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    'через 6 дн.'
  );

  // Через 7 дней
  assert.equal(
    formatNextEpisodeShort(new Date('2026-07-31T12:00:00+03:00'), now, {
      timeZone: 'Europe/Moscow',
      locale: 'ru',
    }),
    'через 7 дн.'
  );
});
