import { cacheRead, cacheWrite } from '@/lib/cache/store';
import { MovieDigitalReleaseDateService } from '@/lib/services/movie-digital-release-date-service';
import {
  findContentByImdb,
  getScheduleWindow,
  getShowScheduleEpisode,
} from '@/lib/integrations/tmdb';
import { getNextEpisodeInRange } from '@/lib/integrations/tvmaze/client';
import { createLogger } from '@/lib/observability/logger';
import type { ReleaseContentType, ReleaseScheduleSlot } from '@/lib/releases/schedule-types';
import { MediaExternalIdsService } from '@/lib/services/media-external-ids-service';

const log = createLogger('services:release-schedule-date');

const SCHEDULE_CACHE_TTL_MS = Number.parseInt(process.env.RELEASES_SCHEDULE_SLOT_TTL_MS ?? '3600000', 10);

async function resolveImdbId(tmdbId: number, type: ReleaseContentType): Promise<string | null> {
  const mediaType = type === 'movie' ? 'movie' : 'show';
  const cached = await MediaExternalIdsService.findOne({
    mediaType,
    tmdbId: String(tmdbId),
  });
  if (cached?.imdbId) {
    return cached.imdbId;
  }

  try {
    const { getContentDetail } = await import('@/lib/integrations/tmdb');
    const detail = await getContentDetail(tmdbId, type, 'en');
    return detail.imdbId ?? null;
  } catch (err) {
    log.error({ err, tmdbId, type }, 'Failed to resolve IMDb id');
    return null;
  }
}

export class ReleaseScheduleDateService {
  static async resolveMovie(
    tmdbId: number,
    now = new Date()
  ): Promise<ReleaseScheduleSlot | null> {
    const { from, toExclusive } = getScheduleWindow(now);
    const cacheKey = `releases:schedule:movie:${tmdbId}:${from}:${toExclusive}`;
    const cachedWrap = await cacheRead<{ value: ReleaseScheduleSlot | null }>(cacheKey);
    if (cachedWrap) {
      return cachedWrap.value;
    }

    let slot: ReleaseScheduleSlot | null = null;

    const aggregated = await MovieDigitalReleaseDateService.resolveInWindow(tmdbId, from, toExclusive);
    if (aggregated) {
      slot = { calendarDate: aggregated.date, source: aggregated.source };
    }

    await cacheWrite(cacheKey, { value: slot }, SCHEDULE_CACHE_TTL_MS);
    return slot;
  }

  static async resolveShow(
    tmdbId: number,
    lang = 'en',
    now = new Date()
  ): Promise<ReleaseScheduleSlot | null> {
    const { from, toExclusive } = getScheduleWindow(now);
    const cacheKey = `releases:schedule:show:${tmdbId}:${lang}:${from}:${toExclusive}`;
    const cachedWrap = await cacheRead<{ value: ReleaseScheduleSlot | null }>(cacheKey);
    if (cachedWrap) {
      return cachedWrap.value;
    }

    let slot: ReleaseScheduleSlot | null = null;

    const tmdbEpisode = await getShowScheduleEpisode(tmdbId, lang).catch(() => null);
    if (tmdbEpisode?.airDate) {
      slot = {
        calendarDate: tmdbEpisode.airDate,
        season: tmdbEpisode.season,
        episode: tmdbEpisode.episode,
        source: 'tmdb',
      };
    }

    if (!slot) {
      const imdbId = await resolveImdbId(tmdbId, 'show');
      if (imdbId) {
        const tvmaze = await getNextEpisodeInRange(imdbId, from, toExclusive);
        if (tvmaze?.airDate) {
          slot = {
            calendarDate: tvmaze.airDate,
            instant: tvmaze.airstamp,
            season: tvmaze.season,
            episode: tvmaze.episode,
            source: 'tvmaze',
          };
        }
      }
    } else {
      // Enrich with TVmaze airstamp when possible
      const imdbId = await resolveImdbId(tmdbId, 'show');
      if (imdbId) {
        const tvmaze = await getNextEpisodeInRange(imdbId, from, toExclusive);
        if (
          tvmaze?.airstamp &&
          tvmaze.season === slot.season &&
          tvmaze.episode === slot.episode
        ) {
          slot = { ...slot, instant: tvmaze.airstamp };
        } else if (
          tvmaze?.airDate &&
          Math.abs(Date.parse(tvmaze.airDate) - Date.parse(slot.calendarDate)) > 86400000
        ) {
          // Prefer TVmaze when dates diverge by >1 day
          slot = {
            calendarDate: tvmaze.airDate,
            instant: tvmaze.airstamp,
            season: tvmaze.season,
            episode: tvmaze.episode,
            source: 'tvmaze',
          };
        }
      }
    }

    await cacheWrite(cacheKey, { value: slot }, SCHEDULE_CACHE_TTL_MS);
    return slot;
  }

  static async resolve(
    tmdbId: number,
    type: ReleaseContentType,
    lang = 'en',
    now = new Date()
  ): Promise<ReleaseScheduleSlot | null> {
    if (type === 'movie') {
      return this.resolveMovie(tmdbId, now);
    }
    return this.resolveShow(tmdbId, lang, now);
  }

  /** Resolve TMDB id from IMDb (for catalog merge). */
  static async resolveTmdbFromImdb(imdbId: string, lang = 'en') {
    return findContentByImdb(imdbId, lang);
  }
}
