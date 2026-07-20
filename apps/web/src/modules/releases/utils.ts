import type { ReleaseCatalogItem, ReleaseWatchlistItem } from '@/lib/releases/types';

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatShortDate(dateKey: string, locale: string) {
  return dateFromKey(dateKey).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatFullDate(dateKey: string, locale: string) {
  return dateFromKey(dateKey).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function scheduleDateOf(item: ReleaseWatchlistItem): string | null {
  if (item.type === 'show') {
    return item.nextEpisodeDate ?? null;
  }

  return item.releaseDate ?? null;
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

export function buildWeekSchedule(items: ReleaseWatchlistItem[], today = new Date()) {
  const scheduleItems = items.filter(isScheduleSource).filter((item) => Boolean(scheduleDateOf(item)));
  const todayKey = localDateKey(today);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = localDateKey(date);

    return {
      dateKey,
      weekday: date.getDay(),
      isToday: dateKey === todayKey,
      items: scheduleItems.filter((item) => scheduleDateOf(item) === dateKey),
    };
  });

  const todayItems = scheduleItems.filter((item) => scheduleDateOf(item) === todayKey);

  return { days, todayItems, scheduleItems };
}
