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
 */
export const SCHEDULE_IMPORT_WINDOW_DAYS = 14;

export type FetchLibraryScope = 'schedule' | 'full' | 'membership';

export type FetchLibraryOptions = {
  /**
   * `schedule` — статусы расписания + окно эфира.
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

export function filterLibraryForScheduleImport(
  entries: ProviderLibraryEntry[],
  now: Date = new Date()
): ProviderLibraryEntry[] {
  return entries.filter(
    (entry) => isScheduleImportStatus(entry.watchStatus) && isWithinScheduleImportWindow(entry, now)
  );
}
