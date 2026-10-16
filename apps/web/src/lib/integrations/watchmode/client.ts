import { env } from '@/lib/config';
import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('integrations:watchmode');

const BASE = 'https://api.watchmode.com/v1';
const CACHE_TTL_MS = Number.parseInt(process.env.WATCHMODE_CACHE_TTL_MS ?? '3600000', 10);
/** TTL для кэширования null/ошибок — предотвращает повторные запросы при rate limit. */
const ERROR_CACHE_TTL_MS = Number.parseInt(process.env.WATCHMODE_ERROR_CACHE_TTL_MS ?? '3600000', 10); // 1h

function apiKey() {
  return env.WATCHMODE_API_KEY ?? null;
}

export function isWatchmodeEnabled() {
  return Boolean(apiKey());
}

type WatchmodeTitle = {
  id?: number;
  title?: string;
  release_date?: string | null;
  tmdb_id?: number | null;
  tmdb_type?: string | null;
  imdb_id?: string | null;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(path: string, attempt = 0): Promise<T | null> {
  const key = apiKey();
  if (!key) {
    return null;
  }

  const url = new URL(`${BASE}${path}`);
  if (!url.searchParams.has('apiKey')) {
    url.searchParams.set('apiKey', key);
  }

  try {
    const res = await fetch(url.toString());

    if (res.status === 429) {
      // Rate limit — делаем одну повторную попытку после задержки
      const retryAfter = Number.parseInt(res.headers.get('Retry-After') ?? '5', 10);
      log.warn({ path, retryAfter, attempt }, 'Watchmode rate limited (429)');
      if (attempt < 1) {
        await sleep(Math.max(1, retryAfter) * 1000);
        return getJson<T>(path, attempt + 1);
      }
      // После retry — сдаёмся тихо, без error
      return null;
    }

    if (!res.ok) {
      log.warn({ status: res.status, path }, 'Watchmode request failed');
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log.error({ err, path }, 'Watchmode request exception');
    return null;
  }
}

/** Digital/release date fallback по TMDB id. */
export async function getMovieReleaseDateByTmdb(tmdbId: number): Promise<string | null> {
  const cacheKey = `watchmode:movie-release:${tmdbId}`;
  const cached = await cacheRead<{ value: string | null }>(cacheKey);
  if (cached) {
    return cached.value;
  }

  // apiKey добавляется внутри getJson через searchParams
  const title = await getJson<WatchmodeTitle>(`/title/movie-${tmdbId}/details/`);
  const date = title?.release_date?.slice(0, 10) ?? null;

  // Кэшируем даже null — предотвращает повторные запросы при rate limit.
  const ttl = date !== null ? CACHE_TTL_MS : ERROR_CACHE_TTL_MS;
  await cacheWrite(cacheKey, { value: date }, ttl);
  return date;
}
