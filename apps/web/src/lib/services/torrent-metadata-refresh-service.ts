import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  db,
  torrentMetadataRefreshFields,
  torrentReleases,
  torrentWatchlist,
  userSettings,
  type TorrentMetadataRefreshField,
} from '@/lib/db';
import { findContentByImdb, getShowEpisodeForDisplay } from '@/lib/integrations/tmdb/client';
import { MovieDigitalReleaseDateService } from '@/lib/services/movie-digital-release-date-service';
import { createLogger } from '@/lib/observability/logger';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';

const log = createLogger('services:torrent-metadata-refresh');

export const STALE_TORRENT_METADATA_MS = Number.parseInt(
  process.env.TORRENT_METADATA_STALE_MS ?? '86400000', // 24 hours
  10
);

export const DEFAULT_TORRENT_METADATA_REFRESH_FIELDS: TorrentMetadataRefreshField[] = [
  ...torrentMetadataRefreshFields,
];

export function normalizeRefreshFields(fields?: unknown): TorrentMetadataRefreshField[] {
  if (!Array.isArray(fields)) {
    return [...DEFAULT_TORRENT_METADATA_REFRESH_FIELDS];
  }
  const allowed = new Set<string>(DEFAULT_TORRENT_METADATA_REFRESH_FIELDS);
  return fields.filter((f): f is TorrentMetadataRefreshField => allowed.has(f));
}

export function computeMetadataUpdate(
  row: typeof torrentWatchlist.$inferSelect,
  metadata: {
    title?: string | null;
    originalTitle?: string | null;
    type?: 'movie' | 'tv' | null;
    posterUrl?: string | null;
    year?: string | null;
    genre?: string | null;
    plot?: string | null;
    rating?: string | null;
    runtime?: string | null;
    totalSeasons?: number | null;
    totalEpisodes?: number | null;
    tmdbId?: number | null;
  },
  fields: TorrentMetadataRefreshField[]
): Partial<typeof torrentWatchlist.$inferInsert> {
  const update: Partial<typeof torrentWatchlist.$inferInsert> = {};
  const active = new Set(fields);

  if (active.has('posters')) {
    if (metadata.posterUrl !== undefined) {
      update.posterUrl = metadata.posterUrl ?? row.posterUrl;
    }
  }

  if (active.has('ratings')) {
    if (metadata.rating !== undefined) {
      update.rating = metadata.rating ?? row.rating;
    }
  }

  if (active.has('genres')) {
    if (metadata.genre !== undefined) {
      update.genre = metadata.genre ?? row.genre;
    }
  }

  if (active.has('plot')) {
    if (metadata.plot !== undefined) {
      update.plot = metadata.plot ?? row.plot;
    }
  }

  if (active.has('details')) {
    if (metadata.title) {
      update.title = metadata.title;
    }
    if (metadata.originalTitle !== undefined) {
      update.originalTitle = metadata.originalTitle ?? row.originalTitle;
    }
    if (metadata.year !== undefined) {
      update.year = metadata.year ?? row.year;
    }
    if (metadata.runtime !== undefined) {
      update.runtime = metadata.runtime ?? row.runtime;
    }
    if (metadata.type !== undefined) {
      update.type = metadata.type ?? row.type;
    }
  }

  if (active.has('episodes')) {
    if (metadata.totalSeasons !== undefined) {
      update.totalSeasons = metadata.totalSeasons ?? row.totalSeasons;
    }
    if (metadata.totalEpisodes !== undefined) {
      update.totalEpisodes = metadata.totalEpisodes ?? row.totalEpisodes;
    }
  }

  // tmdbId is an internal linkage id; populate if missing
  if (!row.tmdbId && metadata.tmdbId) {
    update.tmdbId = metadata.tmdbId;
  }

  return update;
}

const BATCH_RECONCILE_CONCURRENCY = 3;

export interface RefreshSingleOptions {
  fields?: TorrentMetadataRefreshField[];
}

export class TorrentMetadataRefreshService {
  static async refreshSingle(
    userId: number,
    itemId: number,
    options?: RefreshSingleOptions
  ): Promise<TorrentWatchlistItem> {
    const [row] = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .limit(1);

    if (!row) {
      throw new Error('Watchlist item not found');
    }

    let activeFields = options?.fields;
    if (!activeFields) {
      const [settings] = await db
        .select({ fields: userSettings.torrentMetadataRefreshFields })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      activeFields = normalizeRefreshFields(settings?.fields);
    }

    const metadata = await findContentByImdb(row.imdbId).catch((err) => {
      log.error({ err, imdbId: row.imdbId, itemId }, 'Failed to fetch fresh metadata from IMDb/TMDB');
      return null;
    });

    let updatedRow = row;

    if (metadata) {
      const updateData = computeMetadataUpdate(row, metadata, activeFields);
      const [persisted] = await db
        .update(torrentWatchlist)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
        .returning();

      if (persisted) {
        updatedRow = persisted;
      }
    }

    const [countRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(torrentReleases)
      .where(eq(torrentReleases.imdbId, updatedRow.imdbId));

    const [latest] = await db
      .select()
      .from(torrentReleases)
      .where(eq(torrentReleases.imdbId, updatedRow.imdbId))
      .orderBy(desc(torrentReleases.createdAt))
      .limit(1);

    let digitalReleaseDate: string | null = null;
    let nextEpisodeSeason: number | null = null;
    let nextEpisodeNumber: number | null = null;
    let nextEpisodeDate: string | null = null;

    if (updatedRow.tmdbId && activeFields.includes('episodes')) {
      if (updatedRow.type === 'tv') {
        const episode = await getShowEpisodeForDisplay(updatedRow.tmdbId).catch(() => null);
        if (episode?.airDate) {
          nextEpisodeSeason = episode.season;
          nextEpisodeNumber = episode.episode;
          nextEpisodeDate = episode.airDate;
        }
      } else {
        digitalReleaseDate = await MovieDigitalReleaseDateService.resolveDisplay(updatedRow.tmdbId).catch(() => null);
      }
    }

    return {
      id: updatedRow.id,
      imdbId: updatedRow.imdbId,
      title: updatedRow.title ?? updatedRow.imdbId,
      originalTitle: updatedRow.originalTitle,
      type: updatedRow.type ?? 'movie',
      enabled: updatedRow.enabled,
      posterUrl: updatedRow.posterUrl,
      year: updatedRow.year,
      genre: updatedRow.genre,
      rating: updatedRow.rating != null ? Number(updatedRow.rating) : null,
      targetSeason: updatedRow.targetSeason,
      preferredQuality: updatedRow.preferredQuality,
      preferredAudio: updatedRow.preferredAudio,
      maxReleasesCount: updatedRow.maxReleasesCount,
      checkInterval: updatedRow.checkInterval,
      notifyOnce: updatedRow.notifyOnce,
      pinnedReleaseKey: updatedRow.pinnedReleaseKey,
      pinnedReleaseTitle: updatedRow.pinnedReleaseTitle,
      releasesCount: Number(countRow?.c ?? 0),
      lastChecked: updatedRow.lastChecked ? updatedRow.lastChecked.toISOString() : null,
      latestRelease: latest
        ? {
            title: latest.title ?? '',
            quality: latest.quality,
            createdAt: latest.createdAt.toISOString(),
            currentEpisode: latest.currentEpisode,
            totalEpisodes: latest.totalEpisodes,
          }
        : null,
      digitalReleaseDate,
      nextEpisodeSeason,
      nextEpisodeNumber,
      nextEpisodeDate,
    };
  }

  static async reconcileStaleIfEnabled(
    userId: number,
    rows: (typeof torrentWatchlist.$inferSelect)[]
  ): Promise<void> {
    const [settings] = await db
      .select({
        autoRefresh: userSettings.autoRefreshTorrentMetadata,
        fields: userSettings.torrentMetadataRefreshFields,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings?.autoRefresh) {
      return;
    }

    const fields = normalizeRefreshFields(settings.fields);
    const staleBefore = new Date(Date.now() - STALE_TORRENT_METADATA_MS);
    const staleRows = rows.filter(
      (row) => !row.updatedAt || row.updatedAt < staleBefore
    );

    if (staleRows.length === 0) {
      return;
    }

    // Фоновая сверка без блокировки пользователя
    void (async () => {
      for (let i = 0; i < staleRows.length; i += BATCH_RECONCILE_CONCURRENCY) {
        const chunk = staleRows.slice(i, i + BATCH_RECONCILE_CONCURRENCY);
        await Promise.all(
          chunk.map((row) =>
            this.refreshSingle(userId, row.id, { fields }).catch((err) => {
              log.warn({ err, itemId: row.id }, 'Silent background torrent metadata reconcile failed');
            })
          )
        );
      }
    })();
  }
}
