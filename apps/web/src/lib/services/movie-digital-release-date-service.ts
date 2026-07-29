import { cacheRead, cacheWrite } from '@/lib/cache/store';
import {
  isDigitalAvailabilityEntry,
  toDateOnly,
  type TmdbMovieReleaseDates,
} from '@/lib/integrations/tmdb/digital-release-dates';
import {
  getMovieDigitalReleaseDatesByTmdb,
  isTraktEnabled,
} from '@/lib/integrations/trakt/client';
import {
  getMovieReleaseDateByTmdb,
  isWatchmodeEnabled,
} from '@/lib/integrations/watchmode/client';
import { createLogger } from '@/lib/observability/logger';
import {
  pickEarliestDigitalCandidate,
  type AggregatedMovieDigitalRelease,
  type DigitalReleaseCandidate,
} from '@/lib/services/movie-digital-release-pick';

export type {
  AggregatedMovieDigitalRelease,
  DigitalReleaseCandidate,
  DigitalReleaseSource,
} from '@/lib/services/movie-digital-release-pick';
export { pickEarliestDigitalCandidate } from '@/lib/services/movie-digital-release-pick';

const log = createLogger('services:movie-digital-release-date');

const CANDIDATES_CACHE_TTL_MS = Number.parseInt(
  process.env.TMDB_RELEASE_DATES_CACHE_TTL_MS ?? '3600000',
  10,
);

function tmdbCandidatesFromPayload(payload: TmdbMovieReleaseDates): DigitalReleaseCandidate[] {
  const candidates: DigitalReleaseCandidate[] = [];

  for (const region of payload.results) {
    for (const entry of region.release_dates ?? []) {
      if (!isDigitalAvailabilityEntry(entry)) {
        continue;
      }

      const date = toDateOnly(entry.release_date);
      if (!date) {
        continue;
      }

      candidates.push({
        date,
        source: 'tmdb',
        region: region.iso_3166_1,
        label: entry.note ?? null,
      });
    }
  }

  return candidates;
}

async function fetchTmdbReleaseDatesPayload(tmdbId: number): Promise<TmdbMovieReleaseDates | null> {
  const { fetchMovieReleaseDatesPayload } = await import('@/lib/integrations/tmdb/client');
  return fetchMovieReleaseDatesPayload(tmdbId);
}

async function loadTmdbCandidates(tmdbId: number): Promise<DigitalReleaseCandidate[]> {
  try {
    const payload = await fetchTmdbReleaseDatesPayload(tmdbId);
    if (!payload) {
      return [];
    }
    return tmdbCandidatesFromPayload(payload);
  } catch (err) {
    log.error({ err, tmdbId }, 'Failed to load TMDB release dates for aggregation');
    return [];
  }
}

export class MovieDigitalReleaseDateService {
  /** Собирает digital candidates из TMDB + Watchmode + Trakt (US). */
  static async collectCandidates(tmdbId: number): Promise<DigitalReleaseCandidate[]> {
    const cacheKey = `movie:digital:candidates:v2:${tmdbId}`;
    const cached = await cacheRead<{ value: DigitalReleaseCandidate[] }>(cacheKey);
    if (cached) {
      return cached.value;
    }

    const [tmdbCandidates, watchmodeDate, traktDates] = await Promise.all([
      loadTmdbCandidates(tmdbId),
      isWatchmodeEnabled()
        ? getMovieReleaseDateByTmdb(tmdbId).catch(() => null)
        : Promise.resolve(null),
      isTraktEnabled()
        ? getMovieDigitalReleaseDatesByTmdb(tmdbId).catch(() => [])
        : Promise.resolve([]),
    ]);

    const candidates: DigitalReleaseCandidate[] = [...tmdbCandidates];

    if (watchmodeDate) {
      candidates.push({
        date: watchmodeDate.slice(0, 10),
        source: 'watchmode',
        region: 'US',
        label: 'watchmode',
      });
    }

    for (const date of traktDates) {
      candidates.push({
        date,
        source: 'trakt',
        region: 'US',
        label: 'trakt',
      });
    }

    await cacheWrite(cacheKey, { value: candidates }, CANDIDATES_CACHE_TTL_MS);
    return candidates;
  }

  /** Earliest digital среди всех источников (без окна). */
  static async resolveDisplay(tmdbId: number): Promise<string | null> {
    const result = await this.resolve(tmdbId);
    return result?.date ?? null;
  }

  /** Earliest digital в окне [from, toExclusive) среди всех источников. */
  static async resolveInWindow(
    tmdbId: number,
    from: string,
    toExclusive: string,
  ): Promise<AggregatedMovieDigitalRelease | null> {
    return this.resolve(tmdbId, from, toExclusive);
  }

  static async resolve(
    tmdbId: number,
    from?: string,
    toExclusive?: string,
  ): Promise<AggregatedMovieDigitalRelease | null> {
    const candidates = await this.collectCandidates(tmdbId);
    return pickEarliestDigitalCandidate(candidates, from, toExclusive);
  }
}
