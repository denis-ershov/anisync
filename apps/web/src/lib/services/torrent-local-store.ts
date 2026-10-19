import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db, torrentReleases, torrentWatchlist, type TorrentMetadataRefreshField } from '@/lib/db';
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
  scheduleOverride?: TorrentScheduleMeta
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
    digitalReleaseDate: scheduleOverride?.digitalReleaseDate ?? row.digitalReleaseDate ?? null,
    nextEpisodeSeason: scheduleOverride?.nextEpisodeSeason ?? row.nextEpisodeSeason ?? null,
    nextEpisodeNumber: scheduleOverride?.nextEpisodeNumber ?? row.nextEpisodeNumber ?? null,
    nextEpisodeDate: scheduleOverride?.nextEpisodeDate ?? row.nextEpisodeDate ?? null,
  };
}

async function resolveReleaseSummary(imdbId: string): Promise<{
  releasesCount: number;
  latest: TorrentWatchlistItem['latestRelease'];
}> {
  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(torrentReleases)
    .where(eq(torrentReleases.imdbId, imdbId));
  const [latest] = await db
    .select()
    .from(torrentReleases)
    .where(eq(torrentReleases.imdbId, imdbId))
    .orderBy(desc(torrentReleases.createdAt))
    .limit(1);

  return {
    releasesCount: Number(countRow?.c ?? 0),
    latest: latest
      ? {
          title: latest.title ?? '',
          quality: latest.quality,
          createdAt: latest.createdAt.toISOString(),
          currentEpisode: latest.currentEpisode,
          totalEpisodes: latest.totalEpisodes,
        }
      : null,
  };
}

export class TorrentLocalStore {
  static async reconcileStaleSchedules(
    rows: (typeof torrentWatchlist.$inferSelect)[]
  ): Promise<void> {
    const STALE_SCHEDULE_MS = 12 * 60 * 60 * 1000; // 12 hours
    const staleBefore = new Date(Date.now() - STALE_SCHEDULE_MS);

    const candidates = rows.filter(
      (r) => !r.scheduleUpdatedAt || r.scheduleUpdatedAt < staleBefore
    );

    if (candidates.length === 0) {
      return;
    }

    for (let i = 0; i < candidates.length; i += SCHEDULE_ENRICH_CONCURRENCY) {
      const batch = candidates.slice(i, i + SCHEDULE_ENRICH_CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (row) => {
          try {
            const schedule = await enrichTorrentSchedule(row);
            await db
              .update(torrentWatchlist)
              .set({
                digitalReleaseDate: schedule.digitalReleaseDate,
                nextEpisodeSeason: schedule.nextEpisodeSeason,
                nextEpisodeNumber: schedule.nextEpisodeNumber,
                nextEpisodeDate: schedule.nextEpisodeDate,
                scheduleUpdatedAt: new Date(),
              })
              .where(eq(torrentWatchlist.id, row.id));
          } catch {
            // Background silent ignore
          }
        })
      );
    }
  }

  static async list(userId: number): Promise<TorrentWatchlistItem[]> {
    const rows = await db
      .select()
      .from(torrentWatchlist)
      .where(eq(torrentWatchlist.userId, userId))
      .orderBy(desc(torrentWatchlist.createdAt));

    if (rows.length === 0) {
      return [];
    }

    // Фоновая неблокирующая сверка метаданных и устаревших расписаний
    const { TorrentMetadataRefreshService } = await import(
      '@/lib/services/torrent-metadata-refresh-service'
    );
    void TorrentMetadataRefreshService.reconcileStaleIfEnabled(userId, rows).catch(() => undefined);
    void this.reconcileStaleSchedules(rows).catch(() => undefined);

    const imdbIds = Array.from(new Set(rows.map((r) => r.imdbId).filter(Boolean)));
    const countsMap = new Map<string, number>();
    const latestMap = new Map<string, TorrentWatchlistItem['latestRelease']>();

    if (imdbIds.length > 0) {
      const [countRows, latestRows] = await Promise.all([
        db
          .select({
            imdbId: torrentReleases.imdbId,
            c: sql<number>`count(*)::int`,
          })
          .from(torrentReleases)
          .where(inArray(torrentReleases.imdbId, imdbIds))
          .groupBy(torrentReleases.imdbId),
        db.execute<{
          imdb_id: string;
          title: string | null;
          quality: string | null;
          created_at: Date | string;
          current_episode: number | null;
          total_episodes: number | null;
        }>(sql`
          SELECT DISTINCT ON (imdb_id)
            imdb_id,
            title,
            quality,
            created_at,
            current_episode,
            total_episodes
          FROM ${torrentReleases}
          WHERE ${inArray(torrentReleases.imdbId, imdbIds)}
          ORDER BY imdb_id, ${torrentReleases.createdAt} DESC
        `),
      ]);

      for (const c of countRows) {
        countsMap.set(c.imdbId, Number(c.c ?? 0));
      }

      const rowsArray = (Array.isArray(latestRows)
        ? latestRows
        : (latestRows as unknown as { rows?: unknown[] })?.rows ?? []) as Array<{
        imdb_id: string;
        title: string | null;
        quality: string | null;
        created_at: Date | string;
        current_episode: number | null;
        total_episodes: number | null;
      }>;

      for (const l of rowsArray) {
        const createdAtStr =
          l.created_at instanceof Date
            ? l.created_at.toISOString()
            : l.created_at
            ? new Date(l.created_at).toISOString()
            : new Date().toISOString();

        latestMap.set(l.imdb_id, {
          title: l.title ?? '',
          quality: l.quality,
          createdAt: createdAtStr,
          currentEpisode: l.current_episode,
          totalEpisodes: l.total_episodes,
        });
      }
    }

    return rows.map((row) =>
      mapRow(row, countsMap.get(row.imdbId) ?? 0, latestMap.get(row.imdbId) ?? null)
    );
  }

  static async refreshMetadata(
    userId: number,
    itemId: number,
    fields?: TorrentMetadataRefreshField[]
  ): Promise<TorrentWatchlistItem> {
    const { TorrentMetadataRefreshService } = await import(
      '@/lib/services/torrent-metadata-refresh-service'
    );
    return TorrentMetadataRefreshService.refreshSingle(userId, itemId, { fields });
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
      const summary = await resolveReleaseSummary(existing[0].imdbId);
      return mapRow(existing[0], summary.releasesCount, summary.latest);
    }

    const metadata = await findContentByImdb(imdbId).catch(() => null);

    let schedule: TorrentScheduleMeta = {
      digitalReleaseDate: null,
      nextEpisodeSeason: null,
      nextEpisodeNumber: null,
      nextEpisodeDate: null,
    };
    if (metadata?.tmdbId) {
      try {
        schedule = await enrichTorrentSchedule({
          imdbId,
          type: metadata.type,
          tmdbId: metadata.tmdbId,
        } as typeof torrentWatchlist.$inferSelect);
      } catch {
        // noop
      }
    }

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
        digitalReleaseDate: schedule.digitalReleaseDate,
        nextEpisodeSeason: schedule.nextEpisodeSeason,
        nextEpisodeNumber: schedule.nextEpisodeNumber,
        nextEpisodeDate: schedule.nextEpisodeDate,
        scheduleUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return mapRow(row, 0, null, schedule);
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
    const summary = await resolveReleaseSummary(row.imdbId);
    return mapRow(row, summary.releasesCount, summary.latest);
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
    const summary = await resolveReleaseSummary(row.imdbId);
    return mapRow(row, summary.releasesCount, summary.latest);
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
    const summary = await resolveReleaseSummary(row.imdbId);
    return mapRow(row, summary.releasesCount, summary.latest);
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

    const summary = await resolveReleaseSummary(updated.imdbId);
    return mapRow(updated, summary.releasesCount, summary.latest);
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
