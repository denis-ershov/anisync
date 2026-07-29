import { env } from '@/lib/config';
import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('integrations:trakt');

const BASE = 'https://api.trakt.tv';
const CALENDAR_CACHE_TTL_MS = Number.parseInt(process.env.TRAKT_CALENDAR_CACHE_TTL_MS ?? '3600000', 10);
const USER_AGENT = process.env.TRAKT_USER_AGENT ?? 'AniSync/1.0 (https://anisync.ru)';

export type TraktIds = {
  trakt?: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
};

export type TraktMovieCalendarItem = {
  released?: string;
  movie?: {
    title?: string;
    year?: number;
    ids?: TraktIds;
  };
};

/** Streaming calendar returns movies with a streaming (digital) release date. */
export type TraktStreamingCalendarItem = {
  released?: string;
  /** Some Trakt responses use first_aired for streaming slots. */
  first_aired?: string;
  movie?: {
    title?: string;
    year?: number;
    ids?: TraktIds;
  };
};

export type TraktShowCalendarItem = {
  first_aired?: string;
  episode?: {
    season?: number;
    number?: number;
    title?: string;
    ids?: TraktIds;
  };
  show?: {
    title?: string;
    year?: number;
    ids?: TraktIds;
  };
};

/**
 * Public `/calendars/all/*` endpoints need only the app Client ID as `trakt-api-key`.
 * OAuth Bearer is required for `/calendars/my/*` (personalized) — not used here.
 */
function clientId() {
  return env.TRAKT_CLIENT_ID ?? null;
}

export function isTraktEnabled() {
  return Boolean(clientId());
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(path: string, attempt = 0): Promise<T | null> {
  const id = clientId();
  if (!id) {
    return null;
  }

  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'trakt-api-version': '2',
        'trakt-api-key': id,
      },
    });

    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get('Retry-After') ?? '10', 10);
      const ratelimit = res.headers.get('X-Ratelimit');
      log.warn({ path, retryAfter, ratelimit, attempt }, 'Trakt rate limited');
      if (attempt < 1) {
        await sleep(Math.max(1, retryAfter) * 1000);
        return getJson<T>(path, attempt + 1);
      }
      return null;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.error(
        { status: res.status, path, body: body.slice(0, 300) },
        'Trakt request failed'
      );
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    log.error({ err, path }, 'Trakt request exception');
    return null;
  }
}

/** GET /calendars/all/streaming/{start}/{days} — digital/streaming movie releases (API key only). */
export async function getStreamingCalendar(
  startDate: string,
  days: number
): Promise<TraktStreamingCalendarItem[]> {
  const key = `trakt:calendar:streaming:${startDate}:${days}`;
  const cached = await cacheRead<TraktStreamingCalendarItem[]>(key);
  if (cached) {
    return cached;
  }

  const items =
    (await getJson<TraktStreamingCalendarItem[]>(`/calendars/all/streaming/${startDate}/${days}`)) ??
    [];
  await cacheWrite(key, items, CALENDAR_CACHE_TTL_MS);
  return items;
}

/** GET /calendars/all/movies/{start}/{days} — theatrical/general movie releases (API key only). */
export async function getMoviesCalendar(startDate: string, days: number): Promise<TraktMovieCalendarItem[]> {
  const key = `trakt:calendar:movies:${startDate}:${days}`;
  const cached = await cacheRead<TraktMovieCalendarItem[]>(key);
  if (cached) {
    return cached;
  }

  const items =
    (await getJson<TraktMovieCalendarItem[]>(`/calendars/all/movies/${startDate}/${days}`)) ?? [];
  await cacheWrite(key, items, CALENDAR_CACHE_TTL_MS);
  return items;
}

/** GET /calendars/all/shows/{start}/{days} — global show airings (API key only). */
export async function getShowsCalendar(startDate: string, days: number): Promise<TraktShowCalendarItem[]> {
  const key = `trakt:calendar:shows:${startDate}:${days}`;
  const cached = await cacheRead<TraktShowCalendarItem[]>(key);
  if (cached) {
    return cached;
  }

  const items =
    (await getJson<TraktShowCalendarItem[]>(`/calendars/all/shows/${startDate}/${days}`)) ?? [];
  await cacheWrite(key, items, CALENDAR_CACHE_TTL_MS);
  return items;
}

export type TraktMovieRelease = {
  country: string;
  certification?: string;
  release_date: string;
  release_type: 'digital' | 'theatrical' | 'physical' | 'premiere' | 'limited' | 'tv' | 'unknown';
  note?: string | null;
};

/** GET /movies/tmdb:{id}/releases/{country} — digital release dates (US default). */
export async function getMovieDigitalReleaseDatesByTmdb(
  tmdbId: number,
  country = 'us',
): Promise<string[]> {
  const key = `trakt:movie-digital-releases:${tmdbId}:${country}`;
  const cached = await cacheRead<{ value: string[] }>(key);
  if (cached) {
    return cached.value;
  }

  const items =
    (await getJson<TraktMovieRelease[]>(`/movies/tmdb:${tmdbId}/releases/${country}`)) ?? [];

  const dates = items
    .filter((item) => item.release_type === 'digital')
    .map((item) => item.release_date?.slice(0, 10))
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => a.localeCompare(b));

  await cacheWrite(key, { value: dates }, CALENDAR_CACHE_TTL_MS);
  return dates;
}
