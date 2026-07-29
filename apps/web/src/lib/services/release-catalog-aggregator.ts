import { cacheRead, cacheWrite } from '@/lib/cache/store';
import type { CatalogOptions, UpcomingCatalogResult } from '@/lib/integrations/tmdb';
import {
  getUpcoming,
  getScheduleWindow,
  findContentByImdb,
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
const CATALOG_DAYS = Number.parseInt(process.env.RELEASES_CATALOG_WINDOW_DAYS ?? '14', 10);

type NormalizedItem = UpcomingCatalogResult['items'][number];

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rollingWindow(now = new Date()) {
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toExclusiveDate = new Date(fromDate);
  toExclusiveDate.setDate(fromDate.getDate() + CATALOG_DAYS);
  return {
    from: dateOnly(fromDate),
    toExclusive: dateOnly(toExclusiveDate),
    days: CATALOG_DAYS,
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

  await MediaExternalIdsService.upsert({
    mediaType: type,
    tmdbId: String(found.tmdbId),
    imdbId,
  });

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
      });
    }
  }

  return results;
}

async function collectTraktItems(lang: string, from: string, days: number): Promise<NormalizedItem[]> {
  if (!isTraktEnabled()) {
    return [];
  }

  const results: NormalizedItem[] = [];
  const seen = new Set<string>();

  const [movies, shows, streaming] = await Promise.all([
    getMoviesCalendar(from, days),
    getShowsCalendar(from, days),
    getStreamingCalendar(from, days),
  ]);

  const pushMovie = async (
    movie: { title?: string; year?: number; ids?: { imdb?: string | null; tmdb?: number | null } } | undefined,
    released: string | null
  ) => {
    const imdb = movie?.ids?.imdb;
    const tmdb = movie?.ids?.tmdb;
    if (tmdb) {
      const key = `movie:${tmdb}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        tmdbId: tmdb,
        type: 'movie',
        title: movie?.title || String(tmdb),
        titleRu: null,
        originalTitle: movie?.title ?? null,
        rating: 0,
        popularity: 0,
        posterPath: null,
        genre: null,
        genreRu: null,
        year: movie?.year ?? null,
        overview: null,
        releaseDate: released,
        nextEpisode: null,
      });
      return;
    }
    if (imdb) {
      const resolved = await resolveFromImdb(imdb, lang, 'movie');
      if (!resolved) return;
      const key = itemKey(resolved);
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ ...resolved, releaseDate: released ?? resolved.releaseDate });
    }
  };

  for (const entry of movies) {
    await pushMovie(entry.movie, entry.released?.slice(0, 10) ?? null);
  }

  // Streaming calendar = digital movie releases (not shows).
  for (const entry of streaming) {
    const released =
      entry.released?.slice(0, 10) ?? entry.first_aired?.slice(0, 10) ?? null;
    await pushMovie(entry.movie, released);
  }

  for (const entry of shows) {
    const imdb = entry.show?.ids?.imdb;
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
      results.push({
        tmdbId: tmdb,
        type: 'show',
        title: entry.show?.title || String(tmdb),
        titleRu: null,
        originalTitle: entry.show?.title ?? null,
        rating: 0,
        popularity: 0,
        posterPath: null,
        genre: null,
        genreRu: null,
        year: entry.show?.year ?? null,
        overview: null,
        releaseDate: airDate,
        nextEpisode,
      });
      continue;
    }

    if (imdb) {
      const resolved = await resolveFromImdb(imdb, lang, 'show');
      if (!resolved) continue;
      const key = itemKey(resolved);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        ...resolved,
        releaseDate: airDate ?? resolved.releaseDate,
        nextEpisode: nextEpisode ?? resolved.nextEpisode,
      });
    }
  }

  return results;
}

function enrichTmdbFromExternal(base: NormalizedItem, extra: NormalizedItem): NormalizedItem {
  return {
    ...base,
    releaseDate: base.releaseDate ?? extra.releaseDate,
    nextEpisode: base.nextEpisode ?? extra.nextEpisode,
    posterPath: base.posterPath ?? extra.posterPath,
    rating: base.rating || extra.rating,
    popularity: Math.max(base.popularity ?? 0, extra.popularity ?? 0),
    genre: base.genre ?? extra.genre,
    genreRu: base.genreRu ?? extra.genreRu,
    overview: base.overview ?? extra.overview,
    titleRu: base.titleRu ?? extra.titleRu,
  };
}

export class ReleaseCatalogAggregator {
  static async getUpcoming(lang = 'en', options: CatalogOptions = {}): Promise<UpcomingCatalogResult> {
    const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(Math.floor(options.pageSize), 100) : 25;
    const type = options.type ?? 'all';
    const sort = options.sort ?? 'popularity';
    const genreId = options.genreId && options.genreId > 0 ? Math.floor(options.genreId) : null;

    const { from, toExclusive, days } = rollingWindow();
    const cacheKey = `releases:catalog:merged:${lang}:${type}:${sort}:${genreId ?? 0}:${page}:${pageSize}:${from}:${toExclusive}`;
    const cached = await cacheRead<UpcomingCatalogResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch enough TMDB pages for merge (same as before for the requested page)
    const tmdb = await getUpcoming(lang, {
      page: 1,
      pageSize: Math.max(pageSize * page, 50),
      type,
      sort,
      genreId: genreId ?? undefined,
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
      } else {
        map.set(key, item);
      }
    }

    let merged = [...map.values()];

    // Keep items with schedule-relevant dates in rolling window when possible
    merged = merged.filter((item) => {
      const date = item.type === 'show' ? item.nextEpisode?.airDate ?? item.releaseDate : item.releaseDate;
      if (!date) {
        // Keep TMDB-sourced items without date (discover still useful)
        return Boolean(item.posterPath || item.popularity);
      }
      return date >= from && date < toExclusive;
    });

    if (genreId) {
      // Genre filter already applied on TMDB side; external items without genre pass through
      merged = merged.filter((item) => !item.genre || true);
    }

    merged.sort(compareCatalogItems(sort));

    const pageItems = paginateCatalogItems(merged, page, pageSize);
    const pageEnd = page * pageSize;
    const hasNextPage = merged.length > pageEnd;
    const hasPreviousPage = page > 1;
    const knownResults = (page - 1) * pageSize + pageItems.length + (hasNextPage ? 1 : 0);

    const result: UpcomingCatalogResult = {
      items: pageItems,
      page,
      pageSize,
      totalPages: hasNextPage ? page + 1 : page,
      totalResults: knownResults,
      hasNextPage,
      hasPreviousPage,
    };

    await cacheWrite(cacheKey, result, MERGED_CACHE_TTL_MS);
    return result;
  }
}

/** Expose window for tests / schedule alignment. */
export function getCatalogRollingWindow(now = new Date()) {
  return rollingWindow(now);
}

export function getReleasesScheduleWindow(now = new Date()) {
  return getScheduleWindow(now);
}
