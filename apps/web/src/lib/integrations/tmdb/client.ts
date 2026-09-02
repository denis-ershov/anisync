import { env } from '@/lib/config';
import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { createLogger } from '@/lib/observability/logger';
import { MovieDigitalReleaseDateService } from '@/lib/services/movie-digital-release-date-service';
import { MediaExternalIdsService } from '@/lib/services/media-external-ids-service';
import {
  buildDetailCacheKey,
  buildMovieReleaseDateCacheKey,
  buildShowScheduleCacheKey,
  buildUpcomingCacheKey,
} from '@/lib/integrations/tmdb/cache-keys';
import {
  pickCanonicalDigitalReleaseDate,
  pickDigitalReleaseDate,
  type TmdbMovieReleaseDates,
} from '@/lib/integrations/tmdb/digital-release-dates';

export { pickCanonicalDigitalReleaseDate, pickDigitalReleaseDate } from '@/lib/integrations/tmdb/digital-release-dates';

const log = createLogger('integrations:tmdb');

const BASE = "https://api.themoviedb.org/3";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const TMDB_TIMEOUT_MS = envInt("TMDB_TIMEOUT_MS", 5000);
const TMDB_RETRIES = envInt("TMDB_RETRIES", 1);
const GENRE_CACHE_TTL_MS = envInt("TMDB_GENRE_CACHE_TTL_MS", 21600000); // 6h
const DETAIL_CACHE_TTL_MS = envInt("TMDB_DETAIL_CACHE_TTL_MS", 300000); // 5m
const RELEASE_DATES_CACHE_TTL_MS = envInt("TMDB_RELEASE_DATES_CACHE_TTL_MS", 3600000); // 1h
const UPCOMING_CACHE_TTL_MS = envInt("TMDB_UPCOMING_CACHE_TTL_MS", 1800000); // 30m
const SCHEDULE_CACHE_TTL_MS = envInt("TMDB_SCHEDULE_CACHE_TTL_MS", 3600000); // 1h
const UPCOMING_SHOW_DETAIL_LIMIT = envInt("TMDB_UPCOMING_SHOW_DETAIL_LIMIT", 12);
const UPCOMING_SHOW_SCAN_PAGES = envInt("TMDB_UPCOMING_SHOW_SCAN_PAGES", 6);
const UPCOMING_MOVIE_SCAN_PAGES = envInt("TMDB_UPCOMING_MOVIE_SCAN_PAGES", 6);
const UPCOMING_MOVIE_RELEASE_DATES_CONCURRENCY = envInt("TMDB_UPCOMING_MOVIE_RELEASE_DATES_CONCURRENCY", 4);
const TMDB_PAGE_SIZE = 20;
const UPCOMING_SCAN_SAFETY_MULTIPLIER = 3;

function apiKey() {
  const key = env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not configured');
  return key;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeoutWithJitter(attempt: number): number {
  const base = 200 * Math.max(attempt, 1);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt <= Math.max(0, TMDB_RETRIES); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey()}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        log.error(
          { status: res.status, path, attempt, url: url.pathname },
          "TMDB request failed",
        );
        if (res.status >= 500 && attempt < TMDB_RETRIES) {
          await sleep(timeoutWithJitter(attempt + 1));
          continue;
        }
        throw new Error(`TMDB error ${res.status}`);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.error(
        { err, path, attempt, timeoutMs: TMDB_TIMEOUT_MS, aborted: isAbort },
        "TMDB request exception",
      );
      if (attempt < TMDB_RETRIES) {
        await sleep(timeoutWithJitter(attempt + 1));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("TMDB request failed after retries");
}

interface TmdbMovie {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
  overview?: string;
  popularity?: number;
}

interface TmdbPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbEpisode {
  season_number: number;
  episode_number: number;
  air_date: string | null;
  name: string | null;
}

interface TmdbSeason {
  air_date?: string | null;
  episode_count?: number;
  season_number: number;
}

interface TmdbSeasonDetails {
  air_date?: string | null;
  episodes?: TmdbEpisode[];
}

interface TmdbDetail extends TmdbMovie {
  runtime?: number;
  episode_run_time?: number[];
  genres?: TmdbGenre[];
  credits?: { cast?: Array<{ name: string; order: number }> };
  videos?: { results?: Array<{ key: string; site: string; type: string }> };
  last_air_date?: string | null;
  last_episode_to_air?: TmdbEpisode | null;
  next_episode_to_air?: TmdbEpisode | null;
  seasons?: TmdbSeason[];
  number_of_seasons?: number;
  number_of_episodes?: number;
}

interface TmdbExternalIds {
  imdb_id?: string | null;
}

const genreMapEn: Record<number, string> = {};
const genreMapRu: Record<number, string> = {};
let genresLoadedAt = 0;

async function ensureGenres() {
  if (Date.now() - genresLoadedAt < GENRE_CACHE_TTL_MS && Object.keys(genreMapEn).length > 0) {
    return;
  }
  try {
    const [movEn, tvEn, movRu, tvRu] = await Promise.all([
      get<{ genres: TmdbGenre[] }>("/genre/movie/list", { language: "en-US" }),
      get<{ genres: TmdbGenre[] }>("/genre/tv/list", { language: "en-US" }),
      get<{ genres: TmdbGenre[] }>("/genre/movie/list", { language: "ru-RU" }),
      get<{ genres: TmdbGenre[] }>("/genre/tv/list", { language: "ru-RU" }),
    ]);
    for (const g of [...movEn.genres, ...tvEn.genres]) genreMapEn[g.id] = g.name;
    for (const g of [...movRu.genres, ...tvRu.genres]) genreMapRu[g.id] = g.name;
    genresLoadedAt = Date.now();
  } catch (e) {
    log.error({ err: e }, "Failed to load genres");
  }
}

function genreFromIds(ids: number[] = [], map: Record<number, string>): string {
  return ids.slice(0, 2).map(id => map[id]).filter(Boolean).join(", ");
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastDayOfMonth(year: number, month: number): string {
  return dateOnly(new Date(year, month + 1, 0));
}

function inDateRange(value: string | null | undefined, from: string, toExclusive: string): boolean {
  return Boolean(value && value >= from && value < toExclusive);
}

const EXCLUDED_MOVIE_GENRE_IDS = new Set([16, 99, 10402, 10770]);
const EXCLUDED_SHOW_GENRE_IDS = new Set([16, 99, 10762, 10763, 10764, 10766, 10767]);
const EXCLUDED_CATALOG_GENRE_IDS = new Set([
  ...EXCLUDED_MOVIE_GENRE_IDS,
  ...EXCLUDED_SHOW_GENRE_IDS,
]);

function toDateOnly(value: string | undefined): string | null {
  if (!value) return null;
  const [date] = value.split("T");
  return date ?? null;
}

export function isAllowedCatalogGenreIds(type: "movie" | "show", genreIds: number[] = []): boolean {
  const excluded = type === "movie" ? EXCLUDED_MOVIE_GENRE_IDS : EXCLUDED_SHOW_GENRE_IDS;
  return !genreIds.some(id => excluded.has(id));
}

function excludedGenresParam(type: "movie" | "show"): string {
  const excluded = type === "movie" ? EXCLUDED_MOVIE_GENRE_IDS : EXCLUDED_SHOW_GENRE_IDS;
  return [...excluded].join(",");
}

async function getCachedShowDetail(tmdbId: number, tmdbLang: string): Promise<TmdbDetail> {
  const key = buildDetailCacheKey(tmdbId, tmdbLang);
  const cached = await cacheRead<TmdbDetail>(key);
  if (cached) {
    return cached;
  }

  const detail = await get<TmdbDetail>(`/tv/${tmdbId}`, { language: tmdbLang });
  await cacheWrite(key, detail, DETAIL_CACHE_TTL_MS);
  return detail;
}

export function mappedGenreIdForType(type: "movie" | "show", genreId: number | null): number | null {
  if (!genreId) return null;
  if (type === "show") {
    const movieToShow: Record<number, number> = {
      12: 10759,
      14: 10765,
      28: 10759,
      878: 10765,
      10752: 10768,
    };
    return movieToShow[genreId] ?? genreId;
  }

  const showToMovie: Record<number, number> = {
    10759: 28,
    10765: 878,
    10768: 10752,
  };
  return showToMovie[genreId] ?? genreId;
}

export async function fetchMovieReleaseDatesPayload(movieId: number): Promise<TmdbMovieReleaseDates | null> {
  try {
    return await get<TmdbMovieReleaseDates>(`/movie/${movieId}/release_dates`);
  } catch (e) {
    log.error({ err: e, tmdbId: movieId }, 'Failed to load movie release dates payload');
    return null;
  }
}

export async function getMovieDigitalReleaseDate(movieId: number, from: string, toExclusive: string): Promise<string | null> {
  const key = buildMovieReleaseDateCacheKey(movieId, from, toExclusive);
  const cached = await cacheRead<{ value: string | null }>(key);
  if (cached) {
    return cached.value;
  }

  try {
    const result = await MovieDigitalReleaseDateService.resolveInWindow(movieId, from, toExclusive);
    const digitalDate = result?.date ?? null;
    await cacheWrite(key, { value: digitalDate }, RELEASE_DATES_CACHE_TTL_MS);
    return digitalDate;
  } catch (e) {
    log.error({ err: e, tmdbId: movieId }, "Failed to load movie release dates");
    return null;
  }
}

export async function getMovieDigitalReleaseDateDisplay(movieId: number): Promise<string | null> {
  const key = `tmdb:movie:${movieId}:digital_display_v3`;
  const cached = await cacheRead<{ value: string | null }>(key);
  if (cached) {
    return cached.value;
  }

  try {
    const value = await MovieDigitalReleaseDateService.resolveDisplay(movieId);
    await cacheWrite(key, { value }, RELEASE_DATES_CACHE_TTL_MS);
    return value;
  } catch (e) {
    log.error({ err: e, tmdbId: movieId }, 'Failed to load movie digital release date for display');
    return null;
  }
}

function normalizeItem(item: TmdbMovie, type: "movie" | "show", lang: string) {
  const isRu = lang.startsWith("ru");
  const title = (type === "movie" ? item.title : item.name) ?? "";
  const originalTitle = type === "movie" ? item.original_title : item.original_name;
  const releaseDate = type === "movie" ? item.release_date : item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  return {
    tmdbId: item.id,
    type,
    title: isRu && item.title ? item.title : title,
    titleRu: item.name ?? item.title ?? null,
    originalTitle: originalTitle ?? null,
    rating: Math.round((item.vote_average ?? 0) * 10) / 10,
    popularity: item.popularity ?? 0,
    posterPath: item.poster_path ?? null,
    genre: genreFromIds(item.genre_ids, genreMapEn) || null,
    genreRu: genreFromIds(item.genre_ids, genreMapRu) || null,
    year: year ?? null,
    overview: item.overview ?? null,
    releaseDate: releaseDate ?? null,
    nextEpisode: null as null | { season: number; episode: number; airDate: string | null; title: string | null },
  };
}

type EpisodeWindowMatch = { season: number; episode: number; airDate: string | null; title: string | null };

async function getShowEpisodeInRange(
  tmdbId: number,
  detail: TmdbDetail,
  lang: string,
  from: string,
  toExclusive: string,
): Promise<EpisodeWindowMatch | null> {
  const seasonNumbers = [
    ...(detail.seasons ?? [])
      .filter(season => season.season_number > 0)
      .filter(season => {
        if (!season.air_date) return false;
        return inDateRange(season.air_date, from, toExclusive);
      })
      .map(season => season.season_number),
    detail.last_episode_to_air?.season_number,
    detail.next_episode_to_air?.season_number,
    ...(detail.seasons ?? [])
      .filter(season => season.season_number > 0)
      .sort((a, b) => b.season_number - a.season_number)
      .slice(0, 2)
      .map(season => season.season_number),
  ]
    .filter((seasonNumber): seasonNumber is number => Boolean(seasonNumber && seasonNumber > 0))
    .filter((seasonNumber, index, all) => all.indexOf(seasonNumber) === index)
    .sort((a, b) => b - a);

  if (seasonNumbers.length === 0) {
    return null;
  }

  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const matchedEpisodes: TmdbEpisode[] = [];

  for (const seasonNumber of seasonNumbers) {
    try {
      const season = await get<TmdbSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}`, {
        language: tmdbLang,
      });
      matchedEpisodes.push(
        ...(season.episodes ?? []).filter(ep => inDateRange(ep.air_date, from, toExclusive)),
      );
    } catch (e) {
      log.error({ err: e, tmdbId, seasonNumber }, "Failed to load TV season for schedule");
    }
  }

  const selected = matchedEpisodes
    .sort((a, b) => {
      // В Releases приоритет — премьера сезона (E1), затем ближайшая дата.
      const aPremiere = a.episode_number === 1 ? 0 : 1;
      const bPremiere = b.episode_number === 1 ? 0 : 1;
      if (aPremiere !== bPremiere) return aPremiere - bPremiere;
      const dateCompare = (a.air_date ?? "9999").localeCompare(b.air_date ?? "9999");
      if (dateCompare !== 0) return dateCompare;
      if (a.season_number !== b.season_number) return a.season_number - b.season_number;
      return a.episode_number - b.episode_number;
    })[0];

  if (!selected) return null;

  return {
    season: selected.season_number,
    episode: selected.episode_number,
    airDate: selected.air_date ?? null,
    title: selected.name ?? null,
  };
}

function normalizeShowDetail(detail: TmdbDetail, lang: string) {
  const releaseDate = detail.last_air_date ?? null;
  const item = normalizeItem(
    {
      ...detail,
      first_air_date: releaseDate ?? undefined,
      genre_ids: undefined,
    },
    "show",
    lang,
  );

  const genres = detail.genres ?? [];
  const genre = genres.map(g => g.name).slice(0, 2).join(", ") || null;
  return {
    ...item,
    year: item.year ?? (detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : null),
    title: detail.name ?? item.title,
    titleRu: detail.name ?? null,
    originalTitle: detail.original_name ?? null,
    genre,
    genreRu: lang === "ru" ? genre : item.genreRu,
    releaseDate,
    nextEpisode: null as null | { season: number; episode: number; airDate: string | null; title: string | null },
  };
}

export async function getTrending(lang = "en") {
  await ensureGenres();
  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const [movies, shows] = await Promise.all([
    get<{ results: TmdbMovie[] }>("/trending/movie/week", { language: tmdbLang }),
    get<{ results: TmdbMovie[] }>("/trending/tv/week", { language: tmdbLang }),
  ]);
  const items = [
    ...movies.results
      .filter(movie => isAllowedCatalogGenreIds("movie", movie.genre_ids))
      .slice(0, 10)
      .map(movie => normalizeItem(movie, "movie", lang)),
    ...shows.results
      .filter(show => isAllowedCatalogGenreIds("show", show.genre_ids))
      .slice(0, 10)
      .map(show => normalizeItem(show, "show", lang)),
  ];
  items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return items;
}

export type CatalogTypeFilter = "all" | "movie" | "show";
export type CatalogSort = "popularity" | "releaseDate" | "rating";

export interface CatalogOptions {
  page?: number;
  pageSize?: number;
  type?: CatalogTypeFilter;
  sort?: CatalogSort;
  genreId?: number;
  /** Inclusive YYYY-MM-DD; defaults to getCurrentCatalogWindow().from */
  from?: string;
  /** Exclusive YYYY-MM-DD; defaults to getCurrentCatalogWindow().toExclusive */
  toExclusive?: string;
}

async function loadUpcomingShows(
  tmdbLang: string,
  lang: string,
  from: string,
  toInclusive: string,
  toExclusive: string,
  sort: CatalogSort,
  genreId: number | null,
  startPage: number,
  minItems: number,
) {
  const shows: ReturnType<typeof normalizeShowDetail>[] = [];
  let currentPage = startPage;
  let pagesScanned = 0;
  let totalPages = startPage;
  let totalResults = 0;
  const tmdbRankSort = sort === "rating" ? "vote_average.desc" : "popularity.desc";
  const detailsPerPage = Math.max(UPCOMING_SHOW_DETAIL_LIMIT, minItems);
  const maxPagesToScan = scanPageLimit(UPCOMING_SHOW_SCAN_PAGES, minItems);

  while (shows.length < minItems && pagesScanned < maxPagesToScan && currentPage <= totalPages) {
    const tvPage = await get<TmdbPage<TmdbMovie>>("/discover/tv", {
      language: tmdbLang,
      "air_date.gte": from,
      "air_date.lte": toInclusive,
      sort_by: sort === "releaseDate" ? "first_air_date.asc" : tmdbRankSort,
      include_adult: "false",
      include_null_first_air_dates: "false",
      ...(genreId ? { with_genres: String(mappedGenreIdForType("show", genreId)) } : {}),
      without_genres: excludedGenresParam("show"),
      page: String(currentPage),
    });
    totalPages = tvPage.total_pages;
    totalResults = tvPage.total_results;

    const showDetails = await Promise.all(
      tvPage.results.slice(0, detailsPerPage).map(async show => {
        try {
          return await getCachedShowDetail(show.id, tmdbLang);
        } catch (e) {
          log.error({ err: e, tmdbId: show.id, page: currentPage }, "Failed to load TV details for upcoming");
          return null;
        }
      }),
    );

    const normalizedShows = showDetails
      .filter((detail): detail is TmdbDetail => Boolean(detail))
      .filter(detail => inDateRange(detail.last_air_date, from, toExclusive))
      .filter(detail => isAllowedCatalogGenreIds("show", detail.genres?.map(genre => genre.id)))
      .map(detail => normalizeShowDetail(detail, lang));

    shows.push(...normalizedShows);

    currentPage += 1;
    pagesScanned += 1;
  }

  return { shows, totalResults };
}

async function loadUpcomingMovies(
  tmdbLang: string,
  _lang: string,
  from: string,
  toInclusive: string,
  toExclusive: string,
  sort: CatalogSort,
  genreId: number | null,
  startPage: number,
  minItems: number,
) {
  const movies: ReturnType<typeof normalizeItem>[] = [];
  let currentPage = startPage;
  let pagesScanned = 0;
  let totalPages = startPage;
  let totalResults = 0;
  const tmdbRankSort = sort === "rating" ? "vote_average.desc" : "popularity.desc";
  const releaseDatesConcurrency = Math.max(1, Math.min(UPCOMING_MOVIE_RELEASE_DATES_CONCURRENCY, 10));
  const maxPagesToScan = scanPageLimit(UPCOMING_MOVIE_SCAN_PAGES, minItems);

  while (movies.length < minItems && pagesScanned < maxPagesToScan && currentPage <= totalPages) {
    const moviePage = await get<TmdbPage<TmdbMovie>>("/discover/movie", {
      language: tmdbLang,
      with_release_type: "4",
      "release_date.gte": from,
      "release_date.lte": toInclusive,
      sort_by: sort === "releaseDate" ? "release_date.asc" : tmdbRankSort,
      include_adult: "false",
      ...(genreId ? { with_genres: String(mappedGenreIdForType("movie", genreId)) } : {}),
      without_genres: excludedGenresParam("movie"),
      page: String(currentPage),
    });
    totalPages = moviePage.total_pages;
    totalResults = moviePage.total_results;

    for (let i = 0; i < moviePage.results.length; i += releaseDatesConcurrency) {
      const chunk = moviePage.results.slice(i, i + releaseDatesConcurrency);
      const normalizedChunk = await Promise.all(
        chunk.filter(movie => isAllowedCatalogGenreIds("movie", movie.genre_ids)).map(async movie => {
          const canonicalDate = await getMovieDigitalReleaseDateDisplay(movie.id).catch(() => null);

          // Вариант А: Если фильм уже вышел в цифре ранее начала текущего окна каталога,
          // он не считается предстоящим релизом для этого окна.
          if (canonicalDate && canonicalDate < from) {
            return null;
          }

          const digitalDate =
            canonicalDate && inDateRange(canonicalDate, from, toExclusive)
              ? canonicalDate
              : await getMovieDigitalReleaseDate(movie.id, from, toExclusive);

          if (!digitalDate) {
            return null;
          }

          return normalizeItem(
            {
              ...movie,
              release_date: digitalDate,
            },
            "movie",
            _lang,
          );
        }),
      );

      movies.push(
        ...normalizedChunk.filter((item): item is ReturnType<typeof normalizeItem> => Boolean(item)),
      );

      if (movies.length >= minItems) {
        break;
      }
    }

    if (movies.length >= minItems) {
      break;
    }

    currentPage += 1;
    pagesScanned += 1;
  }

  return { movies, totalResults };
}

type NormalizedItem = ReturnType<typeof normalizeItem>;

export type UpcomingCatalogResult = {
  items: NormalizedItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

function clampPage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 25;
  return Math.min(Math.max(Math.floor(value), 1), 100);
}

function clampGenreId(value: number | undefined): number | null {
  if (!value || Number.isNaN(value) || value <= 0) return null;
  return Math.floor(value);
}

function compareCatalogItems(sort: CatalogSort) {
  return (a: NormalizedItem, b: NormalizedItem) => {
    if (sort === "releaseDate") {
      const dateCompare = (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999");
      if (dateCompare !== 0) return dateCompare;
    } else if (sort === "rating") {
      const ratingCompare = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingCompare !== 0) return ratingCompare;
    } else {
      const popularityCompare = (b.popularity ?? 0) - (a.popularity ?? 0);
      if (popularityCompare !== 0) return popularityCompare;
    }

    return (b.popularity ?? 0) - (a.popularity ?? 0);
  };
}

export function paginateCatalogItems<T>(items: T[], page: number, pageSize: number): T[] {
  const offset = (page - 1) * pageSize;
  return items.slice(offset, offset + pageSize);
}

function scanPageLimit(baseLimit: number, minItems: number): number {
  return Math.max(
    baseLimit,
    Math.ceil(minItems / TMDB_PAGE_SIZE) * UPCOMING_SCAN_SAFETY_MULTIPLIER,
  );
}

export function getCurrentCatalogWindow(now = new Date()) {
  const from = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
  const toInclusive = lastDayOfMonth(now.getFullYear(), now.getMonth() + 1);
  const toExclusive = dateOnly(new Date(now.getFullYear(), now.getMonth() + 2, 1));
  return { from, toInclusive, toExclusive };
}

function resolveUpcomingWindow(options: CatalogOptions) {
  if (options.from && options.toExclusive && options.from < options.toExclusive) {
    const exclusive = new Date(`${options.toExclusive}T00:00:00`);
    exclusive.setDate(exclusive.getDate() - 1);
    return {
      from: options.from,
      toInclusive: dateOnly(exclusive),
      toExclusive: options.toExclusive,
    };
  }
  return getCurrentCatalogWindow();
}

export function getScheduleWindow(now = new Date()) {
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toExclusiveDate = new Date(fromDate);
  toExclusiveDate.setDate(fromDate.getDate() + 7);
  const toInclusiveDate = new Date(fromDate);
  toInclusiveDate.setDate(fromDate.getDate() + 6);

  return {
    from: dateOnly(fromDate),
    toInclusive: dateOnly(toInclusiveDate),
    toExclusive: dateOnly(toExclusiveDate),
  };
}

/** Окно для UI (карточки torrent/releases): −30…+120 дней от сегодня. */
export function getDisplayScheduleWindow(now = new Date()) {
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  fromDate.setDate(fromDate.getDate() - 30);
  const toExclusiveDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  toExclusiveDate.setDate(toExclusiveDate.getDate() + 120);

  return {
    from: dateOnly(fromDate),
    toExclusive: dateOnly(toExclusiveDate),
  };
}

export async function getShowEpisodeForDisplay(tmdbId: number, lang = 'en') {
  const cacheKey = `tmdb:show:${tmdbId}:${lang}:display_episode`;
  const cached = await cacheRead<{ value: EpisodeWindowMatch | null }>(cacheKey);
  if (cached) {
    return cached.value;
  }

  const tmdbLang = lang === 'ru' ? 'ru-RU' : 'en-US';
  const detail = await getCachedShowDetail(tmdbId, tmdbLang);
  const { from, toExclusive } = getDisplayScheduleWindow();
  const episode = await getShowEpisodeInRange(tmdbId, detail, lang, from, toExclusive);
  await cacheWrite(cacheKey, { value: episode }, SCHEDULE_CACHE_TTL_MS);
  return episode;
}

export async function getGenres(lang = "en") {
  await ensureGenres();
  const map = lang === "ru" ? genreMapRu : genreMapEn;
  return Object.entries(map)
    .map(([id, name]) => ({ id: Number(id), name }))
    .filter(genre => Number.isFinite(genre.id) && genre.name)
    .filter(genre => !EXCLUDED_CATALOG_GENRE_IDS.has(genre.id))
    .sort((a, b) => a.name.localeCompare(b.name, lang === "ru" ? "ru" : "en"));
}

export async function getShowScheduleEpisode(tmdbId: number, lang = "en") {
  const cacheKey = buildShowScheduleCacheKey(tmdbId, lang);
  const cached = await cacheRead<{
    value: { season: number; episode: number; airDate: string | null; title: string | null } | null;
  }>(cacheKey);
  if (cached) {
    return cached.value;
  }

  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const detail = await getCachedShowDetail(tmdbId, tmdbLang);
  const { from, toExclusive } = getScheduleWindow();
  const episode = await getShowEpisodeInRange(tmdbId, detail, lang, from, toExclusive);
  await cacheWrite(cacheKey, { value: episode }, SCHEDULE_CACHE_TTL_MS);
  return episode;
}

// Digital release type = 4 in TMDB release_types enum
export async function getUpcoming(lang = "en", options: CatalogOptions = {}): Promise<UpcomingCatalogResult> {
  await ensureGenres();
  const page = clampPage(options.page);
  const pageSize = clampPageSize(options.pageSize);
  const type = options.type ?? "all";
  const sort = options.sort ?? "popularity";
  const genreId = clampGenreId(options.genreId);
  const { from, toInclusive, toExclusive } = resolveUpcomingWindow(options);
  const cacheKey = buildUpcomingCacheKey(lang, { page, pageSize, type, sort, genreId, from, toExclusive });
  const cached = await cacheRead<UpcomingCatalogResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const fetchMovies = type === "all" || type === "movie";
  const fetchShows = type === "all" || type === "show";
  const pageEnd = page * pageSize;
  const minItemsForPage = pageEnd + 1;

  const [movieData, showData] = await Promise.all([
    fetchMovies
      ? loadUpcomingMovies(tmdbLang, lang, from, toInclusive, toExclusive, sort, genreId, 1, minItemsForPage)
      : Promise.resolve({ movies: [], totalResults: 0 }),
    fetchShows
      ? loadUpcomingShows(tmdbLang, lang, from, toInclusive, toExclusive, sort, genreId, 1, minItemsForPage)
      : Promise.resolve({ shows: [], totalResults: 0 }),
  ]);
  const shows = showData.shows;

  const sortedItems = [
    ...movieData.movies,
    ...shows,
  ].sort(compareCatalogItems(sort));
  const items = paginateCatalogItems(sortedItems, page, pageSize);
  const hasNextPage = sortedItems.length > pageEnd;
  const hasPreviousPage = page > 1;
  const knownResults = (page - 1) * pageSize + items.length + (hasNextPage ? 1 : 0);

  const result = {
    items,
    page,
    pageSize,
    totalPages: hasNextPage ? page + 1 : page,
    totalResults: knownResults,
    hasNextPage,
    hasPreviousPage,
  };

  await cacheWrite(cacheKey, result, UPCOMING_CACHE_TTL_MS);
  return result;
}

export async function searchContent(query: string, lang = "en") {
  await ensureGenres();
  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const result = await get<{ results: TmdbMovie[] }>("/search/multi", {
    query,
    language: tmdbLang,
    include_adult: "false",
  });
  const rawItems = result.results
    .filter(r => r.media_type === "movie" || r.media_type === "tv")
    .filter(r => isAllowedCatalogGenreIds(r.media_type === "movie" ? "movie" : "show", r.genre_ids))
    .slice(0, 20)
    .map(r => normalizeItem(r, r.media_type === "movie" ? "movie" : "show", lang));

  const items = await Promise.all(
    rawItems.map(async (item) => {
      if (item.type === 'movie') {
        const digital = await getMovieDigitalReleaseDateDisplay(item.tmdbId).catch(() => null);
        if (digital) {
          return { ...item, releaseDate: digital };
        }
      }
      return item;
    })
  );

  return items;
}

export async function getContentDetail(tmdbId: number, type: "movie" | "show", lang = "en") {
  const tmdbLang = lang === "ru" ? "ru-RU" : "en-US";
  const endpoint = type === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const [detail, detailEn] = await Promise.all([
    get<TmdbDetail>(endpoint, { language: tmdbLang, append_to_response: "credits,videos" }),
    lang !== "en"
      ? get<TmdbDetail>(endpoint, { language: "en-US", append_to_response: "credits,videos" })
      : Promise.resolve(null as TmdbDetail | null),
  ]);

  const cachedExternal = await MediaExternalIdsService.findOne({
    mediaType: type === 'movie' ? 'movie' : 'show',
    tmdbId: String(tmdbId),
  });

  let imdbId: string | null = cachedExternal?.imdbId ?? null;
  if (!imdbId) {
    try {
      const external = await get<TmdbExternalIds>(`${endpoint}/external_ids`);
      imdbId = external.imdb_id ?? null;
      if (imdbId) {
        await MediaExternalIdsService.upsert({
          mediaType: type === 'movie' ? 'movie' : 'show',
          tmdbId: String(tmdbId),
          imdbId,
        });
      }
    } catch (e) {
      log.error({ err: e, tmdbId, type }, 'Failed to load external ids');
    }
  }

  const title = (type === "movie" ? detail.title : detail.name) ?? "";
  const titleEn = detailEn ? (type === "movie" ? detailEn.title : detailEn.name) ?? title : title;
  let nextEpisode: { season: number; episode: number; airDate: string | null; title: string | null } | null = null;
  let releaseDate = type === "movie" ? detail.release_date : detail.first_air_date;

  if (type === "show") {
    const { from, toExclusive } = getScheduleWindow();
    nextEpisode = await getShowEpisodeInRange(tmdbId, detail, lang, from, toExclusive);
  } else {
    const digital = await getMovieDigitalReleaseDateDisplay(tmdbId).catch(() => null);
    if (digital) {
      releaseDate = digital;
    }
  }

  const year = (type === "movie" ? detail.release_date : detail.first_air_date)
    ? new Date((type === "movie" ? detail.release_date : detail.first_air_date) as string).getFullYear()
    : null;

  const genres = detail.genres ?? [];
  const genre = genres.map(g => g.name).slice(0, 2).join(", ") || null;

  const runtimeMin =
    detail.runtime ??
    (detail.episode_run_time && detail.episode_run_time[0] ? detail.episode_run_time[0] : null);
  const duration = runtimeMin ? `${runtimeMin}` : null;

  const cast = (detail.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 10)
    .map(c => c.name);

  const trailer =
    detail.videos?.results?.find(v => v.site === "YouTube" && v.type === "Trailer")?.key ?? null;

  return {
    tmdbId: detail.id,
    type,
    title: titleEn,
    titleRu: lang === "ru" ? title : null,
    originalTitle: (type === "movie" ? detail.original_title : detail.original_name) ?? null,
    rating: Math.round((detail.vote_average ?? 0) * 10) / 10,
    popularity: detail.popularity ?? 0,
    posterPath: detail.poster_path ?? null,
    genre,
    genreRu: lang === "ru" ? genre : null,
    year: year ?? null,
    overview: detailEn?.overview ?? detail.overview ?? null,
    overviewRu: lang === "ru" ? (detail.overview ?? null) : null,
    releaseDate: releaseDate ?? null,
    duration,
    cast,
    trailerKey: trailer,
    nextEpisode,
    imdbId,
    totalSeasons: type === "show" ? (detail.number_of_seasons ?? null) : null,
    totalEpisodes: type === "show" ? (detail.number_of_episodes ?? null) : null,
  };
}

/**
 * Resolve rich AniSync torrent metadata from an IMDb id.
 * Uses the same TMDB client/retry/cache boundary as Releases.
 */
export async function findContentByImdb(imdbId: string, lang = "ru") {
  const found = await get<{
    movie_results?: TmdbMovie[];
    tv_results?: TmdbMovie[];
  }>(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
    language: lang === "ru" ? "ru-RU" : "en-US",
  });

  const movie = found.movie_results?.[0];
  const show = found.tv_results?.[0];
  if (!movie && !show) {
    return null;
  }

  const type = movie ? "movie" : "show";
  const match = movie ?? show!;
  const detail = await getContentDetail(match.id, type, lang);

  return {
    imdbId,
    tmdbId: detail.tmdbId,
    type: type === "show" ? ("tv" as const) : ("movie" as const),
    title: detail.titleRu || detail.title,
    originalTitle: detail.originalTitle,
    posterUrl: detail.posterPath
      ? `https://image.tmdb.org/t/p/w500${detail.posterPath}`
      : null,
    year: detail.year == null ? null : String(detail.year),
    genre: detail.genreRu || detail.genre,
    plot: detail.overviewRu || detail.overview,
    rating: detail.rating == null ? null : String(detail.rating),
    runtime: detail.duration,
    totalSeasons: detail.totalSeasons,
    totalEpisodes: detail.totalEpisodes,
  };
}
