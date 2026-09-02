import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db, torrentReleases, torrentWatchlist } from '@/lib/db';
import { MovieDigitalReleaseDateService } from '@/lib/services/movie-digital-release-date-service';
import {
  findContentByImdb,
  getShowEpisodeForDisplay,
} from '@/lib/integrations/tmdb/client';
import type {
  TorrentHealthSnapshot,
  TorrentReleaseItem,
  TorrentWatchlistItem,
  TorrentWatchlistUpdateInput,
} from '@/lib/torrents/types';

const SCHEDULE_ENRICH_CONCURRENCY = 4;

type TorrentScheduleMeta = Pick<
  TorrentWatchlistItem,
  'digitalReleaseDate' | 'nextEpisodeSeason' | 'nextEpisodeNumber' | 'nextEpisodeDate'
>;

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function resolveTmdbId(row: typeof torrentWatchlist.$inferSelect): Promise<number | null> {
  if (row.tmdbId) {
    return row.tmdbId;
  }

  const metadata = await findContentByImdb(row.imdbId).catch(() => null);
  if (!metadata?.tmdbId) {
    return null;
  }

  await db
    .update(torrentWatchlist)
    .set({ tmdbId: metadata.tmdbId, updatedAt: new Date() })
    .where(eq(torrentWatchlist.id, row.id));

  return metadata.tmdbId;
}

async function enrichTorrentSchedule(row: typeof torrentWatchlist.$inferSelect): Promise<TorrentScheduleMeta> {
  const empty: TorrentScheduleMeta = {
    digitalReleaseDate: null,
    nextEpisodeSeason: null,
    nextEpisodeNumber: null,
    nextEpisodeDate: null,
  };

  const tmdbId = await resolveTmdbId(row);
  if (!tmdbId) {
    return empty;
  }

  if (row.type === 'tv') {
    const episode = await getShowEpisodeForDisplay(tmdbId).catch(() => null);
    if (!episode?.airDate) {
      return empty;
    }

    return {
      digitalReleaseDate: null,
      nextEpisodeSeason: episode.season,
      nextEpisodeNumber: episode.episode,
      nextEpisodeDate: episode.airDate,
    };
  }

  const digitalReleaseDate = await MovieDigitalReleaseDateService.resolveDisplay(tmdbId).catch(() => null);
  return {
    digitalReleaseDate,
    nextEpisodeSeason: null,
    nextEpisodeNumber: null,
    nextEpisodeDate: null,
  };
}

function parsePinnedAliases(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function deletePinnedReleases(imdbId: string, releaseKey: string | null, aliasesRaw?: string | null) {
  if (!releaseKey?.trim()) {
    return;
  }
  const keys = Array.from(
    new Set(
      [releaseKey, ...parsePinnedAliases(aliasesRaw)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (!keys.length) {
    return;
  }
  await db
    .delete(torrentReleases)
    .where(and(eq(torrentReleases.imdbId, imdbId), inArray(torrentReleases.infoHash, keys)));
}
function mapRow(
  row: typeof torrentWatchlist.$inferSelect,
  releasesCount = 0,
  latest: TorrentWatchlistItem['latestRelease'] = null,
  schedule: TorrentScheduleMeta = {
    digitalReleaseDate: null,
    nextEpisodeSeason: null,
    nextEpisodeNumber: null,
    nextEpisodeDate: null,
  }
): TorrentWatchlistItem {
  return {
    id: row.id,
    imdbId: row.imdbId,
    title: row.title ?? row.imdbId,
    originalTitle: row.originalTitle,
    type: row.type ?? 'movie',
    enabled: row.enabled,
    posterUrl: row.posterUrl,
    year: row.year,
    genre: row.genre,
    rating: row.rating != null ? Number(row.rating) : null,
    targetSeason: row.targetSeason,
    preferredQuality: row.preferredQuality,
    preferredAudio: row.preferredAudio,
    maxReleasesCount: row.maxReleasesCount,
    checkInterval: row.checkInterval,
    notifyOnce: row.notifyOnce,
    pinnedReleaseKey: row.pinnedReleaseKey,
    pinnedReleaseTitle: row.pinnedReleaseTitle,
    releasesCount,
    lastChecked: row.lastChecked ? row.lastChecked.toISOString() : null,
    latestRelease: latest,
    digitalReleaseDate: schedule.digitalReleaseDate,
    nextEpisodeSeason: schedule.nextEpisodeSeason,
    nextEpisodeNumber: schedule.nextEpisodeNumber,
    nextEpisodeDate: schedule.nextEpisodeDate,
  };
}

async function mapRowWithSchedule(
  row: typeof torrentWatchlist.$inferSelect,
  releasesCount = 0,
  latest: TorrentWatchlistItem['latestRelease'] = null
): Promise<TorrentWatchlistItem> {
  const schedule = await enrichTorrentSchedule(row);
  return mapRow(row, releasesCount, latest, schedule);
}

export class TorrentLocalStore {
  static async list(userId: number): Promise<TorrentWatchlistItem[]> {
    const rows = await db
      .select()
      .from(torrentWatchlist)
      .where(eq(torrentWatchlist.userId, userId))
      .orderBy(desc(torrentWatchlist.createdAt));

    const { TorrentMetadataRefreshService } = await import(
      '@/lib/services/torrent-metadata-refresh-service'
    );
    void TorrentMetadataRefreshService.reconcileStaleIfEnabled(userId, rows).catch(() => undefined);

    const items = await mapPool(rows, SCHEDULE_ENRICH_CONCURRENCY, async (row) => {
      const [countRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(torrentReleases)
        .where(eq(torrentReleases.imdbId, row.imdbId));
      const [latest] = await db
        .select()
        .from(torrentReleases)
        .where(eq(torrentReleases.imdbId, row.imdbId))
        .orderBy(desc(torrentReleases.createdAt))
        .limit(1);

      return mapRowWithSchedule(
        row,
        Number(countRow?.c ?? 0),
        latest
          ? {
              title: latest.title ?? '',
              quality: latest.quality,
              createdAt: latest.createdAt.toISOString(),
              currentEpisode: latest.currentEpisode,
              totalEpisodes: latest.totalEpisodes,
            }
          : null
      );
    });

    return items;
  }

  static async refreshMetadata(userId: number, itemId: number): Promise<TorrentWatchlistItem> {
    const { TorrentMetadataRefreshService } = await import(
      '@/lib/services/torrent-metadata-refresh-service'
    );
    return TorrentMetadataRefreshService.refreshSingle(userId, itemId);
  }

  static async add(
    userId: number,
    imdbId: string,
    options?: { title?: string; telegramChatId?: string | null; targetSeason?: number | null }
  ): Promise<TorrentWatchlistItem> {
    const existing = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.userId, userId), eq(torrentWatchlist.imdbId, imdbId)))
      .limit(1);

    if (existing[0]) {
      return mapRowWithSchedule(existing[0]);
    }

    const metadata = await findContentByImdb(imdbId).catch(() => null);

    const [row] = await db
      .insert(torrentWatchlist)
      .values({
        userId,
        imdbId,
        title: metadata?.title ?? options?.title ?? imdbId,
        originalTitle: metadata?.originalTitle,
        type: metadata?.type,
        posterUrl: metadata?.posterUrl,
        year: metadata?.year,
        genre: metadata?.genre,
        plot: metadata?.plot,
        rating: metadata?.rating,
        runtime: metadata?.runtime,
        totalSeasons: metadata?.totalSeasons,
        totalEpisodes: metadata?.totalEpisodes,
        tmdbId: metadata?.tmdbId,
        targetSeason: options?.targetSeason ?? null,
        preferredQuality: '1080p',
        preferredAudio: 'russian',
        maxReleasesCount: 1,
        enabled: true,
        telegramChatId: options?.telegramChatId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return mapRowWithSchedule(row);
  }

  static async updatePreferences(
    userId: number,
    itemId: number,
    input: TorrentWatchlistUpdateInput
  ): Promise<TorrentWatchlistItem> {
    const [row] = await db
      .update(torrentWatchlist)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.originalTitle !== undefined ? { originalTitle: input.originalTitle } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.genre !== undefined ? { genre: input.genre } : {}),
        ...(input.posterUrl !== undefined ? { posterUrl: input.posterUrl } : {}),
        ...(input.targetSeason !== undefined ? { targetSeason: input.targetSeason } : {}),
        ...(input.preferredQuality !== undefined
          ? { preferredQuality: input.preferredQuality }
          : {}),
        ...(input.preferredAudio !== undefined ? { preferredAudio: input.preferredAudio } : {}),
        ...(input.maxReleasesCount !== undefined
          ? { maxReleasesCount: input.maxReleasesCount }
          : {}),
        ...(input.checkInterval !== undefined ? { checkInterval: input.checkInterval } : {}),
        ...(input.notifyOnce !== undefined ? { notifyOnce: input.notifyOnce } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .returning();

    if (!row) {
      throw new Error('Watchlist item not found');
    }
    return mapRowWithSchedule(row);
  }

  static async pinRelease(
    userId: number,
    itemId: number,
    releaseKey: string,
    aliases: string[],
    title: string
  ): Promise<TorrentWatchlistItem> {
    const [current] = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .limit(1);
    if (!current) {
      throw new Error('Watchlist item not found');
    }

    const previousKey = current.pinnedReleaseKey?.trim().toLowerCase() || null;
    const nextKey = releaseKey.trim().toLowerCase();

    // Смена pin = отвязка предыдущей раздачи → удаляем её из torrent_releases.
    if (previousKey && previousKey !== nextKey) {
      await deletePinnedReleases(
        current.imdbId,
        current.pinnedReleaseKey,
        current.pinnedReleaseAliases
      );
    }

    const [row] = await db
      .update(torrentWatchlist)
      .set({
        pinnedReleaseKey: nextKey,
        pinnedReleaseAliases: JSON.stringify(
          Array.from(new Set([nextKey, ...aliases.map((a) => a.trim().toLowerCase()).filter(Boolean)]))
        ),
        pinnedReleaseTitle: title,
        updatedAt: new Date(),
      })
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .returning();
    if (!row) {
      throw new Error('Watchlist item not found');
    }
    await db
      .insert(torrentReleases)
      .values({
        imdbId: row.imdbId,
        title,
        infoHash: nextKey,
      })
      .onConflictDoNothing();
    return mapRowWithSchedule(row);
  }

  static async unpinRelease(userId: number, itemId: number): Promise<TorrentWatchlistItem> {
    const [current] = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .limit(1);
    if (!current) {
      throw new Error('Watchlist item not found');
    }

    await deletePinnedReleases(
      current.imdbId,
      current.pinnedReleaseKey,
      current.pinnedReleaseAliases
    );

    const [row] = await db
      .update(torrentWatchlist)
      .set({
        pinnedReleaseKey: null,
        pinnedReleaseAliases: null,
        pinnedReleaseTitle: null,
        updatedAt: new Date(),
      })
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .returning();
    if (!row) {
      throw new Error('Watchlist item not found');
    }
    return mapRowWithSchedule(row);
  }

  static async toggle(userId: number, itemId: number): Promise<TorrentWatchlistItem> {
    const [row] = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .limit(1);

    if (!row) {
      throw new Error('Watchlist item not found');
    }

    const [updated] = await db
      .update(torrentWatchlist)
      .set({ enabled: !row.enabled, updatedAt: new Date() })
      .where(eq(torrentWatchlist.id, itemId))
      .returning();

    return mapRowWithSchedule(updated);
  }

  static async remove(userId: number, itemId: number): Promise<void> {
    await db
      .delete(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)));
  }

  static async listReleases(imdbId: string): Promise<TorrentReleaseItem[]> {
    const rows = await db
      .select()
      .from(torrentReleases)
      .where(eq(torrentReleases.imdbId, imdbId))
      .orderBy(desc(torrentReleases.createdAt))
      .limit(50);

    return rows.map((row) => ({
      title: row.title ?? '',
      quality: row.quality,
      size: row.size != null ? String(row.size) : null,
      seeders: row.seeders,
      tracker: row.tracker,
      createdAt: row.createdAt.toISOString(),
      lastUpdate: row.lastUpdate.toISOString(),
    }));
  }

  static async syncTelegramChatId(userId: number, telegramChatId: string | null) {
    const result = await db
      .update(torrentWatchlist)
      .set({ telegramChatId, updatedAt: new Date() })
      .where(eq(torrentWatchlist.userId, userId))
      .returning({ id: torrentWatchlist.id });

    return { success: true as const, updated: result.length, skipped: false as const };
  }

  static async health(): Promise<TorrentHealthSnapshot & { mode: 'local' }> {
    const { checkProwlarrHealth } = await import('@/lib/integrations/prowlarr/health');
    const { getLastTorrentWatcherRunAt } = await import(
      '@/lib/services/torrent-watcher-service'
    );
    const bounded = <T>(promise: Promise<T>) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Torrent health check timed out')), 6_000)
        ),
      ]);
    const [[total, enabled], prowlarr] = await Promise.all([
      bounded(
        Promise.all([
          db.select({ c: sql<number>`count(*)::int` }).from(torrentWatchlist),
          db
            .select({ c: sql<number>`count(*)::int` })
            .from(torrentWatchlist)
            .where(eq(torrentWatchlist.enabled, true)),
        ]).then(([totalRows, enabledRows]) => [totalRows[0], enabledRows[0]] as const)
      ),
      checkProwlarrHealth(process.env.PROWLARR_URL, process.env.PROWLARR_API_KEY),
    ]);
    const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

    return {
      mode: 'local',
      dbOk: true,
      prowlarrOk: prowlarr.configured ? prowlarr.ok : null,
      telegramOk: telegramConfigured ? true : null,
      prowlarrUrl: prowlarr.url,
      telegramUsername: null,
      totalItems: Number(total?.c ?? 0),
      enabledItems: Number(enabled?.c ?? 0),
      lastWatcherRun: getLastTorrentWatcherRunAt(),
    };
  }
}
