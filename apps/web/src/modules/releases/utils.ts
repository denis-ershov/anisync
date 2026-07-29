import type { ReleaseCatalogItem, ReleaseWatchlistItem, ReleaseWatchlistStatus } from '@/lib/releases/types';
import { addDaysToDateKey, resolveTimeZone, zonedDateKey } from '@/lib/timezone';

/** @deprecated Prefer zonedDateKey — kept for callers/tests without explicit TZ. */
export function localDateKey(date: Date, timeZone?: string | null): string {
  return zonedDateKey(date, timeZone);
}

export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
}

export function formatShortDate(dateKey: string, locale: string) {
  return dateFromKey(dateKey).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatFullDate(dateKey: string, locale: string) {
  return dateFromKey(dateKey).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function scheduleDateOf(
  item: ReleaseWatchlistItem,
  timeZone?: string | null
): string | null {
  const raw = item.type === 'show' ? item.nextEpisodeDate : item.releaseDate;
  if (!raw) {
    return null;
  }

  if (raw.includes('T') || raw.endsWith('Z')) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return zonedDateKey(date, timeZone);
  }

  return raw.slice(0, 10);
}

export function getNextWatchlistStatus(current: ReleaseWatchlistStatus | null): ReleaseWatchlistStatus | null {
  if (!current) {
    return 'plan';
  }
  if (current === 'plan') {
    return 'watching';
  }
  if (current === 'watching') {
    return 'watched';
  }
  return null;
}

export function isScheduleSource(item: ReleaseWatchlistItem) {
  return item.status === 'watching' || item.status === 'plan';
}

export function watchlistItemToCatalogItem(item: ReleaseWatchlistItem): ReleaseCatalogItem {
  return {
    tmdbId: item.tmdbId,
    type: item.type,
    title: item.title,
    titleRu: item.titleRu,
    rating: item.rating ?? 0,
    popularity: item.popularity ?? 0,
    posterPath: item.posterPath,
    genre: item.genre,
    genreRu: item.genreRu,
    year: item.year,
    releaseDate: item.releaseDate,
    nextEpisode:
      item.nextEpisodeDate && item.nextEpisodeSeason && item.nextEpisodeNumber
        ? {
            season: item.nextEpisodeSeason,
            episode: item.nextEpisodeNumber,
            airDate: item.nextEpisodeDate,
            title: null,
          }
        : null,
  };
}

export function buildWeekSchedule(
  items: ReleaseWatchlistItem[],
  today = new Date(),
  timeZone?: string | null
) {
  const tz = resolveTimeZone(timeZone);
  const scheduleItems = items
    .filter(isScheduleSource)
    .filter((item) => Boolean(scheduleDateOf(item, tz)));
  const todayKey = zonedDateKey(today, tz);

  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDaysToDateKey(todayKey, index);
    const [y, m, d] = dateKey.split('-').map(Number);
    const labelDate = new Date(Date.UTC(y, m - 1, d, 12));

    return {
      dateKey,
      weekday: labelDate.getUTCDay(),
      isToday: dateKey === todayKey,
      items: scheduleItems.filter((item) => scheduleDateOf(item, tz) === dateKey),
    };
  });

  const todayItems = scheduleItems.filter((item) => scheduleDateOf(item, tz) === todayKey);

  return { days, todayItems, scheduleItems };
}
