import { env } from '@/lib/config';
import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('integrations:watchmode');

const BASE = 'https://api.watchmode.com/v1';
const CACHE_TTL_MS = Number.parseInt(process.env.WATCHMODE_CACHE_TTL_MS ?? '3600000', 10);

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

async function getJson<T>(path: string): Promise<T | null> {
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
    if (!res.ok) {
      log.error({ status: res.status, path }, 'Watchmode request failed');
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

  const title = await getJson<WatchmodeTitle>(`/title/movie-${tmdbId}/details/?apiKey=${apiKey()}`);
  const date = title?.release_date?.slice(0, 10) ?? null;
  await cacheWrite(cacheKey, { value: date }, CACHE_TTL_MS);
  return date;
}
