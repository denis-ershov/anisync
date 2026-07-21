import { and, desc, eq, sql } from 'drizzle-orm';

import { db, torrentReleases, torrentWatchlist } from '@/lib/db';
import { findContentByImdb } from '@/lib/integrations/tmdb/client';
import type {
  TorrentHealthSnapshot,
  TorrentReleaseItem,
  TorrentWatchlistItem,
  TorrentWatchlistUpdateInput,
} from '@/lib/torrents/types';

function mapRow(
  row: typeof torrentWatchlist.$inferSelect,
  releasesCount = 0,
  latest: TorrentWatchlistItem['latestRelease'] = null
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
  };
}

export class TorrentLocalStore {
  static async list(userId: number): Promise<TorrentWatchlistItem[]> {
    const rows = await db
      .select()
      .from(torrentWatchlist)
      .where(eq(torrentWatchlist.userId, userId))
      .orderBy(desc(torrentWatchlist.createdAt));

    const items: TorrentWatchlistItem[] = [];
    for (const row of rows) {
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

      items.push(
        mapRow(row, Number(countRow?.c ?? 0), latest
          ? {
              title: latest.title ?? '',
              quality: latest.quality,
              createdAt: latest.createdAt.toISOString(),
              currentEpisode: latest.currentEpisode,
              totalEpisodes: latest.totalEpisodes,
            }
          : null)
      );
    }

    return items;
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
      return mapRow(existing[0]);
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

    return mapRow(row);
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
    return mapRow(row);
  }

  static async pinRelease(
    userId: number,
    itemId: number,
    releaseKey: string,
    aliases: string[],
    title: string
  ): Promise<TorrentWatchlistItem> {
    const [row] = await db
      .update(torrentWatchlist)
      .set({
        pinnedReleaseKey: releaseKey,
        pinnedReleaseAliases: JSON.stringify(aliases),
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
        infoHash: releaseKey,
      })
      .onConflictDoNothing();
    return mapRow(row);
  }

  static async unpinRelease(userId: number, itemId: number): Promise<TorrentWatchlistItem> {
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
    return mapRow(row);
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

    return mapRow(updated);
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
