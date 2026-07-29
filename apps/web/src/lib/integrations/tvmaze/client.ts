import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('integrations:tvmaze');

const BASE = 'https://api.tvmaze.com';
const SCHEDULE_CACHE_TTL_MS = Number.parseInt(process.env.TVMAZE_SCHEDULE_CACHE_TTL_MS ?? '86400000', 10);
const LOOKUP_CACHE_TTL_MS = Number.parseInt(process.env.TVMAZE_LOOKUP_CACHE_TTL_MS ?? '3600000', 10);

export type TvmazeShow = {
  id: number;
  name: string;
  externals?: { imdb?: string | null; thetvdb?: number | null };
  image?: { medium?: string | null; original?: string | null } | null;
  genres?: string[];
  rating?: { average?: number | null };
  premiered?: string | null;
  summary?: string | null;
  weight?: number;
};

export type TvmazeEpisode = {
  id: number;
  name: string | null;
  season: number;
  number: number | null;
  airdate: string | null;
  airtime: string | null;
  airstamp: string | null;
  show?: TvmazeShow;
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      log.error({ status: res.status, path }, 'TVmaze request failed');
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log.error({ err, path }, 'TVmaze request exception');
    return null;
  }
}

export async function lookupShowByImdb(imdbId: string): Promise<TvmazeShow | null> {
  const key = `tvmaze:lookup:imdb:${imdbId}`;
  const cached = await cacheRead<TvmazeShow>(key);
  if (cached) {
    return cached;
  }

  const show = await getJson<TvmazeShow>(`/lookup/shows?imdb=${encodeURIComponent(imdbId)}`);
  if (show) {
    await cacheWrite(key, show, LOOKUP_CACHE_TTL_MS);
  }
  return show;
}

export async function getShowEpisodes(tvmazeId: number): Promise<TvmazeEpisode[]> {
  const key = `tvmaze:episodes:${tvmazeId}`;
  const cached = await cacheRead<TvmazeEpisode[]>(key);
  if (cached) {
    return cached;
  }

  const episodes = (await getJson<TvmazeEpisode[]>(`/shows/${tvmazeId}/episodes`)) ?? [];
  await cacheWrite(key, episodes, LOOKUP_CACHE_TTL_MS);
  return episodes;
}

/** Следующий эпизод в окне [from, toExclusive) по airdate/airstamp. */
export async function getNextEpisodeInRange(
  imdbId: string,
  from: string,
  toExclusive: string
): Promise<{ season: number; episode: number; airDate: string | null; airstamp: string | null } | null> {
  const show = await lookupShowByImdb(imdbId);
  if (!show) {
    return null;
  }

  const episodes = await getShowEpisodes(show.id);
  const matched = episodes
    .filter((ep) => {
      const date = ep.airdate ?? (ep.airstamp ? ep.airstamp.slice(0, 10) : null);
      return Boolean(date && date >= from && date < toExclusive && ep.number != null);
    })
    .sort((a, b) => {
      const aKey = a.airstamp ?? a.airdate ?? '9999';
      const bKey = b.airstamp ?? b.airdate ?? '9999';
      return aKey.localeCompare(bKey);
    })[0];

  if (!matched || matched.number == null) {
    return null;
  }

  return {
    season: matched.season,
    episode: matched.number,
    airDate: matched.airdate ?? matched.airstamp?.slice(0, 10) ?? null,
    airstamp: matched.airstamp,
  };
}

export async function getWebSchedule(country: string, date: string): Promise<TvmazeEpisode[]> {
  const key = `tvmaze:schedule:web:${country || 'global'}:${date}`;
  const cached = await cacheRead<TvmazeEpisode[]>(key);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({ date });
  if (country) {
    params.set('country', country);
  }
  const items = (await getJson<TvmazeEpisode[]>(`/schedule/web?${params.toString()}`)) ?? [];
  await cacheWrite(key, items, SCHEDULE_CACHE_TTL_MS);
  return items;
}

export async function getBroadcastSchedule(country: string, date: string): Promise<TvmazeEpisode[]> {
  const key = `tvmaze:schedule:${country}:${date}`;
  const cached = await cacheRead<TvmazeEpisode[]>(key);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({ country, date });
  const items = (await getJson<TvmazeEpisode[]>(`/schedule?${params.toString()}`)) ?? [];
  await cacheWrite(key, items, SCHEDULE_CACHE_TTL_MS);
  return items;
}
