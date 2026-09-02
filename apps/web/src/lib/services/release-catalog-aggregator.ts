import { cacheRead, cacheWrite } from '@/lib/cache/store';
import type { CatalogOptions, UpcomingCatalogResult } from '@/lib/integrations/tmdb';
import {
  getUpcoming,
  getScheduleWindow,
  getCurrentCatalogWindow,
  findContentByImdb,
  getContentDetail,
  paginateCatalogItems,
} from '@/lib/integrations/tmdb';
import { getWebSchedule, getBroadcastSchedule } from '@/lib/integrations/tvmaze/client';
import {
  getMoviesCalendar,
  getShowsCalendar,
  getStreamingCalendar,
  isTraktEnabled,
} from '@/lib/integrations/trakt/client';
import { createLogger } from '@/lib/observability/logger';
import { MediaExternalIdsService } from '@/lib/services/media-external-ids-service';

const log = createLogger('services:release-catalog-aggregator');

const MERGED_CACHE_TTL_MS = Number.parseInt(process.env.RELEASES_MERGED_CATALOG_TTL_MS ?? '1800000', 10);
const TVMAZE_COUNTRY = process.env.TVMAZE_SCHEDULE_COUNTRY ?? 'RU';
const TMDB_ENRICH_CONCURRENCY = 6;

type NormalizedItem = UpcomingCatalogResult['items'][number] & { imdbId?: string | null };

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(from: string, toExclusive: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${toExclusive}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 1;
  }
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

/**
 * Окно Discover-каталога.
 * По умолчанию — текущий + следующий календарный месяц (как TMDB getUpcoming).
 * Если задан RELEASES_CATALOG_WINDOW_DAYS — rolling N дней от сегодня.
 */
export function resolveCatalogWindow(now = new Date()) {
  const rawDays = process.env.RELEASES_CATALOG_WINDOW_DAYS;
  if (rawDays != null && rawDays !== '') {
    const days = Number.parseInt(rawDays, 10);
    if (Number.isFinite(days) && days > 0) {
      const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const toExclusiveDate = new Date(fromDate);
      toExclusiveDate.setDate(fromDate.getDate() + days);
      const toInclusiveDate = new Date(toExclusiveDate);
      toInclusiveDate.setDate(toExclusiveDate.getDate() - 1);
      return {
        from: dateOnly(fromDate),
        toInclusive: dateOnly(toInclusiveDate),
        toExclusive: dateOnly(toExclusiveDate),
        days,
      };
    }
  }

  const { from, toInclusive, toExclusive } = getCurrentCatalogWindow(now);
  return {
    from,
    toInclusive,
    toExclusive,
    days: daysBetween(from, toExclusive),
  };
}

function dateKeysInRange(from: string, days: number): string[] {
  const start = new Date(`${from}T00:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return dateOnly(d);
  });
}

function itemKey(item: { tmdbId: number; type: string }) {
  return `${item.type}:${item.tmdbId}`;
}

function compareCatalogItems(sort: NonNullable<CatalogOptions['sort']>) {
  return (a: NormalizedItem, b: NormalizedItem) => {
    if (sort === 'releaseDate') {
      const dateCompare = (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999');
      if (dateCompare !== 0) return dateCompare;
    } else if (sort === 'rating') {
      const ratingCompare = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingCompare !== 0) return ratingCompare;
    } else {
      const popularityCompare = (b.popularity ?? 0) - (a.popularity ?? 0);
      if (popularityCompare !== 0) return popularityCompare;
    }
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  };
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function resolveFromTmdbId(
  tmdbId: number,
  type: 'movie' | 'show',
  lang: string,
  schedule: Pick<NormalizedItem, 'releaseDate' | 'nextEpisode'>,
  imdbId?: string | null
): Promise<NormalizedItem | null> {
  const detail = await getContentDetail(tmdbId, type, lang).catch(() => null);
  if (!detail) {
    return null;
  }

  return {
    tmdbId: detail.tmdbId,
    type,
    title: detail.title,
    titleRu: detail.titleRu,
    originalTitle: detail.originalTitle,
    rating: detail.rating,
    popularity: detail.popularity,
    posterPath: detail.posterPath,
    genre: detail.genre,
    genreRu: detail.genreRu,
    year: detail.year,
    overview: detail.overview,
    releaseDate: schedule.releaseDate ?? detail.releaseDate,
    nextEpisode: schedule.nextEpisode ?? detail.nextEpisode,
    imdbId: imdbId ?? detail.imdbId ?? null,
  };
}

async function resolveFromImdb(
  imdbId: string,
  lang: string,
  typeHint?: 'movie' | 'show'
): Promise<NormalizedItem | null> {
  const found = await findContentByImdb(imdbId, lang).catch(() => null);
  if (!found?.tmdbId) {
    return null;
  }

  const type = found.type === 'tv' ? 'show' : 'movie';
  if (typeHint && type !== typeHint) {
    return null;
  }

  return {
    tmdbId: found.tmdbId,
    type,
    title: found.title || found.originalTitle || imdbId,
    titleRu: lang === 'ru' ? found.title : null,
    originalTitle: found.originalTitle,
    rating: found.rating ? Number(found.rating) : 0,
    popularity: 0,
    posterPath: found.posterUrl?.includes('/t/p/')
      ? found.posterUrl.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, '')
      : null,
    genre: found.genre,
    genreRu: lang === 'ru' ? found.genre : null,
    year: found.year ? Number(found.year) : null,
    overview: found.plot,
    releaseDate: null,
    nextEpisode: null,
    imdbId,
  };
}

async function collectTvmazeItems(lang: string, from: string, days: number): Promise<NormalizedItem[]> {
  const dates = dateKeysInRange(from, Math.min(days, 7));
  const results: NormalizedItem[] = [];
  const seenImdb = new Set<string>();

  for (const date of dates) {
    const [web, broadcast] = await Promise.all([
      getWebSchedule(TVMAZE_COUNTRY, date),
      getBroadcastSchedule(TVMAZE_COUNTRY, date),
    ]);

    for (const ep of [...web, ...broadcast]) {
      const show = ep.show;
      const imdb = show?.externals?.imdb;
      if (!imdb || seenImdb.has(imdb)) {
        continue;
      }
      seenImdb.add(imdb);

      const resolved = await resolveFromImdb(imdb, lang, 'show');
      if (!resolved) {
        continue;
      }

      results.push({
        ...resolved,
        releaseDate: ep.airdate ?? date,
        nextEpisode: {
          season: ep.season,
          episode: ep.number ?? 0,
          airDate: ep.airdate ?? date,
          title: ep.name,
        },
        popularity: show?.weight ?? resolved.popularity,
        rating: show?.rating?.average ?? resolved.rating,
        imdbId: imdb,
      });
    }
  }

  return results;
}

async function collectTraktItems(lang: string, from: string, days: number): Promise<NormalizedItem[]> {
  if (!isTraktEnabled()) {
    return [];
  }

  const seen = new Set<string>();
  const jobs: Array<() => Promise<NormalizedItem | null>> = [];

  const enqueueMovie = (
    movie: { title?: string; year?: number; ids?: { imdb?: string | null; tmdb?: number | null } } | undefined,
    released: string | null
  ) => {
    const imdb = movie?.ids?.imdb ?? null;
    const tmdb = movie?.ids?.tmdb;
    if (tmdb) {
      const key = `movie:${tmdb}`;
      if (seen.has(key)) return;
      seen.add(key);
      jobs.push(() =>
        resolveFromTmdbId(tmdb, 'movie', lang, { releaseDate: released, nextEpisode: null }, imdb)
      );
      return;
    }
    if (imdb) {
      const key = `imdb:${imdb}`;
      if (seen.has(key)) return;
      seen.add(key);
      jobs.push(async () => {
        const resolved = await resolveFromImdb(imdb, lang, 'movie');
        return resolved ? { ...resolved, releaseDate: released ?? resolved.releaseDate } : null;
      });
    }
  };

  const [movies, shows, streaming] = await Promise.all([
    getMoviesCalendar(from, days),
    getShowsCalendar(from, days),
    getStreamingCalendar(from, days),
  ]);

  for (const entry of movies) {
    enqueueMovie(entry.movie, entry.released?.slice(0, 10) ?? null);
  }
  for (const entry of streaming) {
    enqueueMovie(
      entry.movie,
      entry.released?.slice(0, 10) ?? entry.first_aired?.slice(0, 10) ?? null
    );
  }

  for (const entry of shows) {
    const imdb = entry.show?.ids?.imdb ?? null;
    const tmdb = entry.show?.ids?.tmdb;
    const airDate = entry.first_aired?.slice(0, 10) ?? null;
    const nextEpisode =
      entry.episode?.season != null && entry.episode?.number != null
        ? {
            season: entry.episode.season,
            episode: entry.episode.number,
            airDate,
            title: entry.episode.title ?? null,
          }
        : null;

    if (tmdb) {
      const key = `show:${tmdb}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(() =>
        resolveFromTmdbId(tmdb, 'show', lang, { releaseDate: airDate, nextEpisode }, imdb)
      );
      continue;
    }

    if (imdb) {
      const key = `imdb:${imdb}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(async () => {
        const resolved = await resolveFromImdb(imdb, lang, 'show');
        if (!resolved) return null;
        return {
          ...resolved,
          releaseDate: airDate ?? resolved.releaseDate,
          nextEpisode: nextEpisode ?? resolved.nextEpisode,
        };
      });
    }
  }

  const resolved = await mapPool(jobs, TMDB_ENRICH_CONCURRENCY, (job) => job());
  return resolved.filter((item): item is NormalizedItem => Boolean(item?.tmdbId && item.posterPath));
}

function enrichTmdbFromExternal(base: NormalizedItem, extra: NormalizedItem): NormalizedItem {
  return {
    ...base,
    releaseDate: base.releaseDate ?? extra.releaseDate,
    nextEpisode: base.nextEpisode ?? extra.nextEpisode,
    posterPath: base.posterPath ?? extra.posterPath,
    rating: base.rating && base.rating > 0 ? base.rating : extra.rating ?? base.rating,
    popularity: Math.max(base.popularity ?? 0, extra.popularity ?? 0),
    genre: base.genre ?? extra.genre,
    genreRu: base.genreRu ?? extra.genreRu,
    overview: base.overview ?? extra.overview,
    titleRu: base.titleRu ?? extra.titleRu,
    imdbId: base.imdbId ?? extra.imdbId ?? null,
  };
}

/** Prefer richer metadata when the same IMDb id maps to conflicting TMDB ids. */
function mergeByImdb(items: NormalizedItem[]): NormalizedItem[] {
  const byKey = new Map<string, NormalizedItem>();
  const imdbOwner = new Map<string, string>();

  for (const item of items) {
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, enrichTmdbFromExternal(existing, item));
    } else {
      byKey.set(key, item);
    }

    const imdb = item.imdbId;
    if (!imdb) continue;
    const ownerKey = imdbOwner.get(imdb);
    if (!ownerKey) {
      imdbOwner.set(imdb, key);
      continue;
    }
    if (ownerKey === key) continue;

    const owner = byKey.get(ownerKey);
    const current = byKey.get(key);
    if (!owner || !current) continue;

    const preferCurrent =
      (current.posterPath && !owner.posterPath) ||
      (current.popularity ?? 0) > (owner.popularity ?? 0) ||
      ((current.rating ?? 0) > (owner.rating ?? 0) && Boolean(current.posterPath));

    if (preferCurrent) {
      byKey.set(key, enrichTmdbFromExternal(current, owner));
      byKey.delete(ownerKey);
      imdbOwner.set(imdb, key);
    } else {
      byKey.set(ownerKey, enrichTmdbFromExternal(owner, current));
      byKey.delete(key);
    }
  }

  return [...byKey.values()];
}

const activePoolFetches = new Map<string, Promise<NormalizedItem[]>>();

async function fetchMergedPool(
  lang: string,
  type: 'all' | 'movie' | 'show',
  sort: NonNullable<CatalogOptions['sort']>,
  genreId: number | null,
  from: string,
  toExclusive: string,
  days: number,
): Promise<NormalizedItem[]> {
  const poolCacheKey = `releases:catalog:pool:v4:${lang}:${type}:${sort}:${genreId ?? 0}:${from}:${toExclusive}`;
  const cached = await cacheRead<NormalizedItem[]>(poolCacheKey);
  if (cached) {
    return cached;
  }

  const existingFetch = activePoolFetches.get(poolCacheKey);
  if (existingFetch) {
    return existingFetch;
  }

  const fetchPromise = (async () => {
    // Предварительно тянем 100 элементов пула (для мгновенной пагинации 1-4 страниц)
    const tmdbPoolSize = 100;
    const tmdb = await getUpcoming(lang, {
      page: 1,
      pageSize: tmdbPoolSize,
      type,
      sort,
      genreId: genreId ?? undefined,
      from,
      toExclusive,
    });

    const [tvmazeItems, traktItems] = await Promise.all([
      collectTvmazeItems(lang, from, days).catch((err) => {
        log.error({ err }, 'TVmaze catalog collect failed');
        return [] as NormalizedItem[];
      }),
      collectTraktItems(lang, from, days).catch((err) => {
        log.error({ err }, 'Trakt catalog collect failed');
        return [] as NormalizedItem[];
      }),
    ]);

    const map = new Map<string, NormalizedItem>();

    for (const item of tmdb.items) {
      map.set(itemKey(item), item);
    }

    for (const item of [...tvmazeItems, ...traktItems]) {
      if (type !== 'all' && item.type !== type) {
        continue;
      }
      const key = itemKey(item);
      const existing = map.get(key);
      if (existing) {
        map.set(key, enrichTmdbFromExternal(existing, item));
      } else if (item.posterPath) {
        map.set(key, item);
      }
    }

    const needsPoster = [...map.values()].filter((item) => !item.posterPath);
    if (needsPoster.length > 0) {
      const enriched = await mapPool(needsPoster, TMDB_ENRICH_CONCURRENCY, async (item) => {
        const detail = await resolveFromTmdbId(
          item.tmdbId,
          item.type,
          lang,
          { releaseDate: item.releaseDate, nextEpisode: item.nextEpisode },
          item.imdbId
        );
        return detail ? enrichTmdbFromExternal(detail, item) : item;
      });
      for (const item of enriched) {
        map.set(itemKey(item), item);
      }
    }

    let merged = mergeByImdb([...map.values()]);

    merged = merged.filter((item) => {
      if (!item.posterPath) {
        return false;
      }
      const date = item.type === 'show' ? item.nextEpisode?.airDate ?? item.releaseDate : item.releaseDate;
      if (!date) {
        return Boolean(item.popularity);
      }
      return date >= from && date < toExclusive;
    });

    merged.sort(compareCatalogItems(sort));

    await cacheWrite(poolCacheKey, merged, MERGED_CACHE_TTL_MS);
    return merged;
  })();

  activePoolFetches.set(poolCacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    activePoolFetches.delete(poolCacheKey);
  }
}

export class ReleaseCatalogAggregator {
  static async getUpcoming(lang = 'en', options: CatalogOptions = {}): Promise<UpcomingCatalogResult> {
    const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(Math.floor(options.pageSize), 100) : 25;
    const type = options.type ?? 'all';
    const sort = options.sort ?? 'popularity';
    const genreId = options.genreId && options.genreId > 0 ? Math.floor(options.genreId) : null;

    const { from, toExclusive, days } = resolveCatalogWindow();

    const merged = await fetchMergedPool(lang, type, sort, genreId, from, toExclusive, days);

    const pageItems = paginateCatalogItems(merged, page, pageSize);
    const pageEnd = page * pageSize;
    const hasNextPage = merged.length > pageEnd;
    const hasPreviousPage = page > 1;
    const totalPages = Math.max(1, Math.ceil(merged.length / pageSize));
    const totalResults = merged.length;

    return {
      items: pageItems,
      page,
      pageSize,
      totalPages,
      totalResults,
      hasNextPage,
      hasPreviousPage,
    };
  }
}

/** Expose window for tests / schedule alignment. */
export function getCatalogRollingWindow(now = new Date()) {
  return resolveCatalogWindow(now);
}

export function getReleasesScheduleWindow(now = new Date()) {
  return getScheduleWindow(now);
}
