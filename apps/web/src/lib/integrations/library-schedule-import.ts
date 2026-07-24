import type { LibraryStatus, ProviderLibraryEntry } from '@/lib/integrations/provider-types';

/** Смотрю + Буду смотреть (+ пересмотр как активный просмотр). */
export const SCHEDULE_IMPORT_STATUSES: readonly LibraryStatus[] = [
  'watching',
  'planned',
  'rewatching',
] as const;

/**
 * Текущая + ближайшая неделя: rolling-окно от сегодня (14 дней).
 * Совпадает с расписанием UI (7 дней) + следующая неделя.
 * Окно применяется к **planned**; watching/rewatching импортируются целиком
 * (в т.ч. для блока «Продолжаю смотреть» вне окна).
 */
export const SCHEDULE_IMPORT_WINDOW_DAYS = 14;

export type FetchLibraryScope = 'schedule' | 'full' | 'membership';

export type FetchLibraryOptions = {
  /**
   * `schedule` — watching/rewatching целиком + planned в окне эфира.
   * `full` / `membership` — все статусы списка без окна (membership — для детекта удалений).
   */
  scope?: FetchLibraryScope;
};

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysFromToday(target: Date, today: Date): number {
  const ms = startOfLocalDay(target).getTime() - startOfLocalDay(today).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function isScheduleImportStatus(status: LibraryStatus): boolean {
  return (SCHEDULE_IMPORT_STATUSES as readonly string[]).includes(status);
}

/** Дата эфира/старта для фильтра недели. */
export function getScheduleRelevantDate(entry: {
  nextEpisodeDate?: string | null;
  airedOn?: string | null;
  watchStatus: LibraryStatus;
}): Date | null {
  if (entry.nextEpisodeDate) {
    const next = new Date(entry.nextEpisodeDate);
    if (!Number.isNaN(next.getTime())) {
      return next;
    }
  }

  if (entry.watchStatus === 'planned' && entry.airedOn) {
    const aired = new Date(entry.airedOn);
    if (!Number.isNaN(aired.getTime())) {
      return aired;
    }
  }

  return null;
}

export function isWithinScheduleImportWindow(
  entry: {
    nextEpisodeDate?: string | null;
    airedOn?: string | null;
    watchStatus: LibraryStatus;
  },
  now: Date = new Date()
): boolean {
  const relevant = getScheduleRelevantDate(entry);
  if (!relevant) {
    return false;
  }

  const days = daysFromToday(relevant, now);
  return days >= 0 && days < SCHEDULE_IMPORT_WINDOW_DAYS;
}

/** Активный просмотр — всегда в schedule-import (расписание + «Продолжаю смотреть»). */
export function isCatchingUpImportStatus(status: LibraryStatus): boolean {
  return status === 'watching' || status === 'rewatching';
}

export function shouldIncludeInScheduleImport(
  entry: {
    nextEpisodeDate?: string | null;
    airedOn?: string | null;
    watchStatus: LibraryStatus;
  },
  now: Date = new Date()
): boolean {
  if (!isScheduleImportStatus(entry.watchStatus)) {
    return false;
  }

  if (isCatchingUpImportStatus(entry.watchStatus)) {
    return true;
  }

  // planned — только в окне 14 дней
  return isWithinScheduleImportWindow(entry, now);
}

export function filterLibraryForScheduleImport(
  entries: ProviderLibraryEntry[],
  now: Date = new Date()
): ProviderLibraryEntry[] {
  return entries.filter((entry) => shouldIncludeInScheduleImport(entry, now));
}

/**
 * Primary-authoritative import set:
 * - schedule slice (watching/rewatching + planned в окне);
 * - плюс любой статус с primary для тайтлов, уже есть локально (выравнивание completed и т.п.).
 */
export function filterLibraryForPrimaryAuthoritativeImport(
  entries: ProviderLibraryEntry[],
  knownPrimaryExternalIds: ReadonlySet<string>,
  now: Date = new Date()
): ProviderLibraryEntry[] {
  return entries.filter((entry) => {
    if (shouldIncludeInScheduleImport(entry, now)) {
      return true;
    }
    return knownPrimaryExternalIds.has(String(entry.externalAnimeId));
  });
}
