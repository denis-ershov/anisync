import type { LibraryStatus } from '@/lib/integrations/provider-types';
import { isCatchingUpImportStatus, isScheduleImportStatus } from '@/lib/integrations/library-schedule-import';
import {
  addDaysToDateKey,
  diffDateKeys,
  resolveTimeZone,
  zonedDateKey,
} from '@/lib/timezone';

export type ScheduleAnimeDateFields = {
  watchStatus: LibraryStatus;
  nextEpisodeDate?: string | null;
  airedOn?: string | null;
};

export type ScheduleDayOptions = {
  /** IANA timezone. Defaults to Europe/Moscow when omitted. */
  timeZone?: string | null;
};

function zone(options?: ScheduleDayOptions): string {
  return resolveTimeZone(options?.timeZone);
}

/** Календарный день эфира (YYYY-MM-DD) в TZ пользователя. */
export function getScheduleReleaseDateKey(
  anime: ScheduleAnimeDateFields,
  options?: ScheduleDayOptions
): string | null {
  const tz = zone(options);
  if (anime.nextEpisodeDate) {
    const date = new Date(anime.nextEpisodeDate);
    if (!Number.isNaN(date.getTime())) {
      return zonedDateKey(date, tz);
    }
  }

  if (anime.watchStatus === 'planned' && anime.airedOn) {
    const date = new Date(anime.airedOn);
    if (!Number.isNaN(date.getTime())) {
      return zonedDateKey(date, tz);
    }
  }

  return null;
}

/**
 * @deprecated Prefer getScheduleReleaseDateKey — kept for callers that need a Date.
 * Returns UTC midnight of the calendar day key (for day arithmetic only).
 */
export function getScheduleReleaseDate(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  options?: ScheduleDayOptions
): Date | null {
  void now;
  const key = getScheduleReleaseDateKey(anime, options);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
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
 * Возвращает дату эфира только в том случае, если она уже наступила (<= now).
 * Для дат в будущем прошлый эфир не синтезируется.
 */
export function getLatestAiredInstant(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  options?: ScheduleDayOptions
): Date | null {
  void options;
  const next = getRawScheduleInstant(anime);
  if (!next) {
    return null;
  }

  if (next.getTime() <= now.getTime()) {
    return next;
  }

  return null;
}

/**
 * Эфир привязан к календарному «сегодня» в TZ пользователя
 * (только если серия уже фактически вышла сегодня).
 * Не использует rolling 24h через границу суток.
 */
export function isRecentlyAiredForToday(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  options?: ScheduleDayOptions
): boolean {
  const tz = zone(options);
  const instant = getLatestAiredInstant(anime, now, options);
  if (!instant) {
    return false;
  }

  return zonedDateKey(instant, tz) === zonedDateKey(now, tz);
}

/**
 * Попадает ли тайтл в день недели schedule (0 = сегодня … 6).
 * «Сегодня» = календарная дата в TZ пользователя, не окно 24 часа.
 */
export function belongsToScheduleDay(
  anime: ScheduleAnimeDateFields,
  dayIndex: number,
  now: Date = new Date(),
  options?: ScheduleDayOptions
): boolean {
  if (!isScheduleImportStatus(anime.watchStatus)) {
    return false;
  }

  const tz = zone(options);
  const todayKey = zonedDateKey(now, tz);
  const dayKey = addDaysToDateKey(todayKey, dayIndex);
  const releaseKey = getScheduleReleaseDateKey(anime, options);

  if (releaseKey && releaseKey === dayKey) {
    const daysUntil = diffDateKeys(todayKey, releaseKey);
    if (daysUntil >= 0 && daysUntil <= 6) {
      return true;
    }
  }

  if (dayIndex === 0 && isRecentlyAiredForToday(anime, now, options)) {
    return true;
  }

  return false;
}

/** Catching-up: watching без слота в ближайшие 7 дней и не «сегодня». */
export function belongsToCatchingUp(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  options?: ScheduleDayOptions
): boolean {
  if (!isCatchingUpImportStatus(anime.watchStatus)) {
    return false;
  }

  if (isRecentlyAiredForToday(anime, now, options) || belongsToScheduleDay(anime, 0, now, options)) {
    return false;
  }

  for (let dayIndex = 1; dayIndex <= 6; dayIndex += 1) {
    if (belongsToScheduleDay(anime, dayIndex, now, options)) {
      return false;
    }
  }

  if (!anime.nextEpisodeDate) {
    return true;
  }

  const releaseKey = getScheduleReleaseDateKey(anime, options);
  if (!releaseKey) {
    return true;
  }

  const todayKey = zonedDateKey(now, zone(options));
  const daysUntil = diffDateKeys(todayKey, releaseKey);

  return daysUntil < 0 || daysUntil >= 7;
}
