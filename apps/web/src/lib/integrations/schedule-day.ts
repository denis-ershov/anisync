import type { LibraryStatus } from '@/lib/integrations/provider-types';
import { isCatchingUpImportStatus, isScheduleImportStatus } from '@/lib/integrations/library-schedule-import';

/** Серия, вышедшая недавно, ещё показывается в «Сегодня» (не уезжает в catching-up). */
export const RECENTLY_AIRED_TODAY_HOURS = 24;

export type ScheduleAnimeDateFields = {
  watchStatus: LibraryStatus;
  nextEpisodeDate?: string | null;
  airedOn?: string | null;
};

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Календарный день эфира в локальной TZ (next episode, для planned — aired_on). */
export function getScheduleReleaseDate(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date()
): Date | null {
  void now;
  if (anime.nextEpisodeDate) {
    const date = new Date(anime.nextEpisodeDate);
    if (!Number.isNaN(date.getTime())) {
      return startOfLocalDay(date);
    }
  }

  if (anime.watchStatus === 'planned' && anime.airedOn) {
    const date = new Date(anime.airedOn);
    if (!Number.isNaN(date.getTime())) {
      return startOfLocalDay(date);
    }
  }

  return null;
}

export function getRawScheduleInstant(anime: ScheduleAnimeDateFields): Date | null {
  if (anime.nextEpisodeDate) {
    const date = new Date(anime.nextEpisodeDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (anime.watchStatus === 'planned' && anime.airedOn) {
    const date = new Date(anime.airedOn);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Момент последнего (уже вышедшего) эфира.
 *
 * Shikimori после выхода серии сразу двигает `nextEpisodeAt` на следующий слот (+7д).
 * Тогда «сегодняшний» эфир исчезает из UI, если смотреть только на next.
 * Для недельного цикла восстанавливаем предыдущий слот: next − 7 дней.
 */
export function getLatestAiredInstant(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date()
): Date | null {
  const next = getRawScheduleInstant(anime);
  if (!next) {
    return null;
  }

  // next ещё указывает на уже прошедший эфир
  if (next.getTime() <= now.getTime()) {
    return next;
  }

  const today = startOfLocalDay(now);
  const nextDay = startOfLocalDay(next);
  const daysUntil = Math.round((nextDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Типичный TV weekly: next уже на следующей неделе в тот же weekday
  if (daysUntil >= 5 && daysUntil <= 9) {
    const previous = new Date(next);
    previous.setDate(previous.getDate() - 7);
    return previous;
  }

  // Реже: biweekly
  if (daysUntil >= 12 && daysUntil <= 16) {
    const previous = new Date(next);
    previous.setDate(previous.getDate() - 14);
    return previous;
  }

  return null;
}

/** Эфир уже был сегодня / за окно часов (в т.ч. после сдвига next на +7д). */
export function isRecentlyAiredForToday(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  windowHours: number = RECENTLY_AIRED_TODAY_HOURS
): boolean {
  const instant = getLatestAiredInstant(anime, now);
  if (!instant) {
    return false;
  }

  const todayKey = toDateKey(startOfLocalDay(now));
  if (toDateKey(startOfLocalDay(instant)) === todayKey) {
    return true;
  }

  const hoursAgo = (now.getTime() - instant.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= 0 && hoursAgo < windowHours;
}

/**
 * Попадает ли тайтл в день недели schedule (0 = сегодня … 6).
 * Уже вышедшие сегодня остаются в «Сегодня», даже если next уже на +7 дней.
 */
export function belongsToScheduleDay(
  anime: ScheduleAnimeDateFields,
  dayIndex: number,
  now: Date = new Date()
): boolean {
  if (!isScheduleImportStatus(anime.watchStatus)) {
    return false;
  }

  const today = startOfLocalDay(now);
  const dayDate = new Date(today);
  dayDate.setDate(today.getDate() + dayIndex);

  const releaseDate = getScheduleReleaseDate(anime, now);
  const dayKey = toDateKey(dayDate);

  if (releaseDate && toDateKey(releaseDate) === dayKey) {
    const daysUntil = Math.round((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    // Будущие дни недели (0..6). Ровно +7 — это уже «следующая неделя», не этот грид;
    // такой слот обрабатывается через implied previous → «Сегодня».
    if (daysUntil >= 0 && daysUntil <= 6) {
      return true;
    }
  }

  // Сегодня: эфир был (в т.ч. next уже прыгнул на следующую неделю).
  if (dayIndex === 0 && isRecentlyAiredForToday(anime, now)) {
    return true;
  }

  return false;
}

/** Catching-up: watching без слота в ближайшие 7 дней и не «только что вышло». */
export function belongsToCatchingUp(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date()
): boolean {
  if (!isCatchingUpImportStatus(anime.watchStatus)) {
    return false;
  }

  // Уже в «Сегодня» как недавно вышедшее — не дублируем.
  if (isRecentlyAiredForToday(anime, now) || belongsToScheduleDay(anime, 0, now)) {
    return false;
  }

  // Есть слот в гриде недели (завтра…+6) — не catching-up.
  for (let dayIndex = 1; dayIndex <= 6; dayIndex += 1) {
    if (belongsToScheduleDay(anime, dayIndex, now)) {
      return false;
    }
  }

  if (!anime.nextEpisodeDate) {
    return true;
  }

  const releaseDate = getScheduleReleaseDate(anime, now);
  if (!releaseDate) {
    return true;
  }

  const today = startOfLocalDay(now);
  const daysUntil = Math.round((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Прошлые эфиры или next на следующей неделе и дальше (не попали в грид 0..6).
  return daysUntil < 0 || daysUntil >= 7;
}
