import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';

import { db, releaseWatchlistEntries } from '@/lib/db';
import { getShowScheduleEpisode } from '@/lib/integrations/tmdb';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('services:release-watchlist-refresh');

export const WATCHLIST_SCHEDULE_STALE_MS = Number.parseInt(
  process.env.RELEASES_WATCHLIST_STALE_MS ?? '3600000',
  10
);

const REFRESH_CONCURRENCY = Number.parseInt(process.env.RELEASES_WATCHLIST_REFRESH_CONCURRENCY ?? '4', 10);

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export class ReleaseWatchlistRefreshService {
  static isScheduleStale(updatedAt: Date | null, now = Date.now()) {
    if (!updatedAt) {
      return true;
    }

    return now - updatedAt.getTime() > WATCHLIST_SCHEDULE_STALE_MS;
  }

  static async hasStaleShowSchedules() {
    const staleBefore = new Date(Date.now() - WATCHLIST_SCHEDULE_STALE_MS);
    const rows = await db
      .select({ id: releaseWatchlistEntries.id })
      .from(releaseWatchlistEntries)
      .where(
        and(
          eq(releaseWatchlistEntries.type, 'show'),
          or(
            eq(releaseWatchlistEntries.status, 'watching'),
            eq(releaseWatchlistEntries.status, 'plan')
          ),
          or(
            isNull(releaseWatchlistEntries.scheduleUpdatedAt),
            lt(releaseWatchlistEntries.scheduleUpdatedAt, staleBefore)
          )
        )
      )
      .limit(1);

    return rows.length > 0;
  }

  static async refreshShowSchedules() {
    const rows = await db
      .select({ tmdbId: releaseWatchlistEntries.tmdbId })
      .from(releaseWatchlistEntries)
      .where(
        and(
          eq(releaseWatchlistEntries.type, 'show'),
          or(
            eq(releaseWatchlistEntries.status, 'watching'),
            eq(releaseWatchlistEntries.status, 'plan')
          )
        )
      );

    const uniqueIds = [...new Set(rows.map((row) => row.tmdbId))];
    let updatedEntries = 0;

    for (const batch of chunk(uniqueIds, Math.max(1, REFRESH_CONCURRENCY))) {
      await Promise.all(
        batch.map(async (tmdbId) => {
          const episode = await getShowScheduleEpisode(tmdbId, 'ru').catch(() => null);
          const refreshedAt = new Date();

          const updated = await db
            .update(releaseWatchlistEntries)
            .set({
              nextEpisodeSeason: episode?.season ?? null,
              nextEpisodeNumber: episode?.episode ?? null,
              nextEpisodeDate: episode?.airDate ?? null,
              scheduleUpdatedAt: refreshedAt,
            })
            .where(
              and(
                eq(releaseWatchlistEntries.tmdbId, tmdbId),
                eq(releaseWatchlistEntries.type, 'show'),
                inArray(releaseWatchlistEntries.status, ['watching', 'plan'])
              )
            )
            .returning({ id: releaseWatchlistEntries.id });

          updatedEntries += updated.length;
        })
      );
    }

    log.info({ shows: uniqueIds.length, updatedEntries }, 'Release watchlist schedules refreshed');
    return { shows: uniqueIds.length, updatedEntries };
  }
}
