import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';

import { db, releaseWatchlistEntries } from '@/lib/db';
import { createLogger } from '@/lib/observability/logger';
import { MovieDigitalReleaseDateService } from '@/lib/services/movie-digital-release-date-service';
import { ReleaseScheduleDateService } from '@/lib/services/release-schedule-date-service';

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

  static async refreshSchedules() {
    const rows = await db
      .select({
        tmdbId: releaseWatchlistEntries.tmdbId,
        type: releaseWatchlistEntries.type,
      })
      .from(releaseWatchlistEntries)
      .where(
        or(
          eq(releaseWatchlistEntries.status, 'watching'),
          eq(releaseWatchlistEntries.status, 'plan')
        )
      );

    const unique = new Map<string, { tmdbId: number; type: 'movie' | 'show' }>();
    for (const row of rows) {
      unique.set(`${row.type}:${row.tmdbId}`, { tmdbId: row.tmdbId, type: row.type });
    }

    let updatedEntries = 0;
    const items = [...unique.values()];

    for (const batch of chunk(items, Math.max(1, REFRESH_CONCURRENCY))) {
      await Promise.all(
        batch.map(async ({ tmdbId, type }) => {
          const slot = await ReleaseScheduleDateService.resolve(tmdbId, type, 'ru').catch(() => null);
          const refreshedAt = new Date();

          if (type === 'show') {
            const updated = await db
              .update(releaseWatchlistEntries)
              .set({
                nextEpisodeSeason: slot?.season ?? null,
                nextEpisodeNumber: slot?.episode ?? null,
                nextEpisodeDate: slot?.instant ?? slot?.calendarDate ?? null,
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
            return;
          }

          const movieDate = await MovieDigitalReleaseDateService.resolveDisplay(tmdbId).catch(() => null);
          const updated = await db
            .update(releaseWatchlistEntries)
            .set({
              releaseDate: movieDate ?? slot?.calendarDate ?? null,
              scheduleUpdatedAt: refreshedAt,
            })
            .where(
              and(
                eq(releaseWatchlistEntries.tmdbId, tmdbId),
                eq(releaseWatchlistEntries.type, 'movie'),
                inArray(releaseWatchlistEntries.status, ['watching', 'plan'])
              )
            )
            .returning({ id: releaseWatchlistEntries.id });
          updatedEntries += updated.length;
        })
      );
    }

    log.info({ items: items.length, updatedEntries }, 'Release watchlist schedules refreshed');
    return { shows: items.filter((i) => i.type === 'show').length, movies: items.filter((i) => i.type === 'movie').length, updatedEntries };
  }

  /** @deprecated use refreshSchedules */
  static async refreshShowSchedules() {
    return this.refreshSchedules();
  }
}
