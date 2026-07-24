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

/** Эфир уже был, но в пределах окна «ещё сегодня» (в т.ч. сдвиг TZ / утренний эфир). */
export function isRecentlyAiredForToday(
  anime: ScheduleAnimeDateFields,
  now: Date = new Date(),
  windowHours: number = RECENTLY_AIRED_TODAY_HOURS
): boolean {
  const instant = getRawScheduleInstant(anime);
  if (!instant) {
    return false;
  }
  const hoursAgo = (now.getTime() - instant.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= 0 && hoursAgo < windowHours;
}

/**
 * Попадает ли тайтл в день недели schedule (0 = сегодня … 6).
 * Уже вышедшие сегодня / за последние 24ч остаются в «Сегодня», а не скрываются.
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
    // Будущие дни недели + сегодняшний календарный день (даже если время эфира уже прошло).
    if (daysUntil >= 0 && daysUntil <= 7) {
      return true;
    }
  }

  // Сегодня: эфир был недавно (дата «вчера» из‑за TZ или next_episode ещё не обновлён).
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
  if (isRecentlyAiredForToday(anime, now)) {
    return false;
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

  // Прошлые эфиры (старше окна) или дальше чем неделя.
  return daysUntil < 0 || daysUntil > 7;
}
