import { and, asc, eq, sql } from 'drizzle-orm';

import { db, torrentNotificationLog, torrentReleases, torrentWatchlist } from '@/lib/db';
import { ProwlarrClient } from '@/lib/integrations/prowlarr/client';
import {
  formatTorrentNotification,
  sendTelegramMessage,
} from '@/lib/integrations/telegram/bot';
import { createLogger } from '@/lib/observability/logger';
import { NotificationHubService } from '@/lib/services/notification-hub-service';
import {
  buildSearchQueries,
  filterReleasesByPreferences,
  filterResultsByImdbOrTitle,
  filterResultsBySeason,
} from '@/lib/torrents/watcher/filters';
import {
  buildReleaseContentHash,
  computeReleaseIdentity,
  extractInfoHashFromMagnet,
  qualityLabel,
  type ProwlarrRelease,
} from '@/lib/torrents/watcher/identity';
import { extractEpisodeInfo } from '@/lib/torrents/watcher/parsers';
import { torrentBytesToMagnet } from '@/lib/torrents/watcher/torrent-file';
import type { TorrentReleaseCandidate } from '@/lib/torrents/types';

const log = createLogger('torrents:watcher');

const CONCURRENCY = 5;

let lastWatcherRunAt: string | null = null;

export function getLastTorrentWatcherRunAt() {
  return lastWatcherRunAt;
}

type WatchlistRow = typeof torrentWatchlist.$inferSelect;

function mapSize(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

async function resolveInfoHash(
  client: ProwlarrClient,
  release: ProwlarrRelease
): Promise<string | null> {
  const identity = computeReleaseIdentity(release);
  const magnet = release.magnetUrl || release.magnet || release.magnetLink;
  const fromMagnet = extractInfoHashFromMagnet(magnet);
  if (fromMagnet) {
    return fromMagnet;
  }
  if (release.infoHash || release.info_hash) {
    return String(release.infoHash || release.info_hash);
  }

  if (release.indexerId && release.guid) {
    try {
      const artifact = await client.getDownloadArtifact(release.indexerId, release.guid);
      const magnet =
        artifact.magnet ??
        (artifact.torrentBytes ? torrentBytesToMagnet(artifact.torrentBytes) : null);
      const hash = extractInfoHashFromMagnet(magnet);
      if (hash) {
        return hash;
      }
    } catch (error) {
      log.warn({ err: error, guid: release.guid }, 'Failed to resolve download link');
    }
  }

  return identity.primary;
}

async function searchForItem(
  client: ProwlarrClient,
  item: WatchlistRow
): Promise<ProwlarrRelease[]> {
  let results: ProwlarrRelease[] = [];
  try {
    results = await client.searchByImdb(item.imdbId);
  } catch (error) {
    log.warn({ err: error, imdbId: item.imdbId }, 'IMDb search failed');
  }

  const hasExactImdb = results.some((release) => {
    const id = String(release.imdbId || release.imdb_id || '').trim();
    return id && id !== '0' && id.toLowerCase() === item.imdbId.toLowerCase();
  });

  if (!hasExactImdb) {
    const queries = buildSearchQueries({
      imdbId: item.imdbId,
      title: item.title,
      originalTitle: item.originalTitle,
      itemType: item.type,
      year: item.year,
      targetSeason: item.targetSeason,
    });
    for (const query of queries) {
      try {
        const byQuery = await client.searchByQuery(query);
        if (byQuery.length) {
          results = byQuery;
          break;
        }
      } catch (error) {
        log.warn({ err: error, query }, 'Query search failed');
      }
    }
  }

  let filtered = filterResultsByImdbOrTitle(
    results,
    item.imdbId,
    item.title,
    item.originalTitle,
    item.year,
    item.type
  );

  if (item.type === 'tv' && item.targetSeason) {
    filtered = filterResultsBySeason(filtered, item.targetSeason);
  }

  filtered = filterReleasesByPreferences(
    filtered,
    item.preferredQuality,
    item.preferredAudio
  );

  return filtered.sort((a, b) => {
    const seedersDiff = (b.seeders ?? 0) - (a.seeders ?? 0);
    if (seedersDiff !== 0) {
      return seedersDiff;
    }
    return (mapSize(b.size) ?? 0) - (mapSize(a.size) ?? 0);
  });
}

function pinnedIdentities(item: WatchlistRow): Set<string> {
  const values: string[] = item.pinnedReleaseKey ? [item.pinnedReleaseKey] : [];
  if (item.pinnedReleaseAliases) {
    try {
      const aliases: unknown = JSON.parse(item.pinnedReleaseAliases);
      if (Array.isArray(aliases)) {
        values.push(...aliases.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      // Keep the primary key when legacy aliases are malformed.
    }
  }
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function releaseMatchesPinned(release: ProwlarrRelease, pinned: Set<string>) {
  return computeReleaseIdentity(release).aliases.some((alias) => pinned.has(alias));
}

async function notifyChannels(input: {
  userId: number;
  item: WatchlistRow;
  releaseTitle: string;
  quality: string | null;
  size: number | null;
  seeders: number | null;
  changeType: 'new' | 'update' | 'new_episode';
}) {
  const text = formatTorrentNotification({
    title: input.item.title || input.item.imdbId,
    releaseTitle: input.releaseTitle,
    quality: input.quality,
    size: input.size,
    seeders: input.seeders,
    imdbId: input.item.imdbId,
    changeType: input.changeType,
  });

  const telegramOk = await sendTelegramMessage({
    text,
    chatId: input.item.telegramChatId,
    photoUrl: input.item.posterUrl,
  });

  await db.insert(torrentNotificationLog).values({
    userId: input.userId,
    imdbId: input.item.imdbId,
    releaseTitle: input.releaseTitle,
    notificationText: text,
    success: telegramOk,
  });

  await NotificationHubService.create({
    userId: input.userId,
    type: 'system',
    module: 'torrents',
    channel: 'in_app',
    title: `Torrent: ${input.item.title || input.item.imdbId}`,
    message: input.releaseTitle,
    payload: {
      imdbId: input.item.imdbId,
      releaseTitle: input.releaseTitle,
      changeType: input.changeType,
    },
  });

  // Reaching this point means the in-app channel was persisted successfully.
  return true;
}

export function shouldAdoptExistingRelease(input: {
  huntingMode: boolean;
  sameContent: boolean;
  notificationCount: number;
}) {
  return input.huntingMode && input.sameContent && input.notificationCount === 0;
}

async function persistHuntingPin(
  item: WatchlistRow,
  release: ProwlarrRelease,
  infoHash: string,
  title: string
) {
  const identity = computeReleaseIdentity(release);
  const aliases = Array.from(
    new Set([infoHash.toLowerCase(), ...identity.aliases].filter(Boolean))
  );
  await db
    .update(torrentWatchlist)
    .set({
      pinnedReleaseKey: infoHash.toLowerCase(),
      pinnedReleaseAliases: JSON.stringify(aliases),
      pinnedReleaseTitle: title,
      updatedAt: new Date(),
    })
    .where(eq(torrentWatchlist.id, item.id));
}

async function processItem(client: ProwlarrClient, item: WatchlistRow): Promise<number> {
  let releases = await searchForItem(client, item);
  const maxNotify = item.maxReleasesCount && item.maxReleasesCount > 0 ? item.maxReleasesCount : 1;
  const pinned = pinnedIdentities(item);
  const pinOnlyMode = pinned.size > 0 && maxNotify === 1;
  const huntingMode = pinned.size === 0 && maxNotify === 1;
  if (pinOnlyMode) {
    releases = releases.filter((release) => releaseMatchesPinned(release, pinned));
  } else if (pinned.size > 0) {
    releases.sort(
      (a, b) =>
        Number(releaseMatchesPinned(b, pinned)) - Number(releaseMatchesPinned(a, pinned))
    );
  }
  let notified = 0;
  const seenKeys = new Set<string>();

  for (const release of releases) {
    if (notified >= maxNotify) {
      break;
    }

    const infoHash = await resolveInfoHash(client, release);
    if (!infoHash || seenKeys.has(infoHash.toLowerCase())) {
      continue;
    }
    seenKeys.add(infoHash.toLowerCase());

    const title = release.title || infoHash;
    const size = mapSize(release.size);
    const quality = qualityLabel(release);
    const seeders = release.seeders ?? null;
    const tracker = release.indexer || release.tracker || null;
    const { contentHash, legacyHash } = buildReleaseContentHash(size, title);
    const episode = extractEpisodeInfo(title);
    const publishedAt = release.publishDate ? new Date(release.publishDate) : null;

    const [existing] = await db
      .select()
      .from(torrentReleases)
      .where(and(eq(torrentReleases.imdbId, item.imdbId), eq(torrentReleases.infoHash, infoHash)))
      .limit(1);

    let changeType: 'new' | 'update' | 'new_episode' | null = null;

    if (!existing) {
      await db.insert(torrentReleases).values({
        imdbId: item.imdbId,
        title,
        infoHash,
        quality,
        size: size ?? undefined,
        seeders: seeders ?? undefined,
        tracker,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        contentHash,
        currentEpisode: episode?.current,
        totalEpisodes: episode?.total ?? item.seasonEpisodeCount ?? undefined,
      });
      changeType = episode?.current ? 'new_episode' : 'new';
    } else {
      const sameContent =
        existing.contentHash === contentHash || existing.contentHash === legacyHash;
      if (sameContent) {
        if (
          shouldAdoptExistingRelease({
            huntingMode,
            sameContent,
            notificationCount: existing.notificationCount,
          })
        ) {
          const delivered = await notifyChannels({
            userId: item.userId,
            item,
            releaseTitle: title,
            quality,
            size,
            seeders,
            changeType: episode?.current ? 'new_episode' : 'new',
          });
          if (delivered) {
            await db
              .update(torrentReleases)
              .set({
                notificationCount: sql`${torrentReleases.notificationCount} + 1`,
                lastNotifiedAt: new Date(),
              })
              .where(eq(torrentReleases.id, existing.id));
            notified += 1;
            await persistHuntingPin(item, release, infoHash, title);
          }
        }
        continue;
      }
      await db
        .update(torrentReleases)
        .set({
          title,
          quality,
          size: size ?? existing.size,
          seeders: seeders ?? existing.seeders,
          tracker: tracker ?? existing.tracker,
          lastUpdate: new Date(),
          contentHash,
          currentEpisode: episode?.current ?? existing.currentEpisode,
          totalEpisodes: episode?.total ?? existing.totalEpisodes,
        })
        .where(eq(torrentReleases.id, existing.id));
      changeType =
        episode?.current && episode.current !== existing.currentEpisode
          ? 'new_episode'
          : 'update';
    }

    const delivered = await notifyChannels({
      userId: item.userId,
      item,
      releaseTitle: title,
      quality,
      size,
      seeders,
      changeType,
    });

    if (delivered) {
      await db
        .update(torrentReleases)
        .set({
          notificationCount: sql`${torrentReleases.notificationCount} + 1`,
          lastNotifiedAt: new Date(),
        })
        .where(and(eq(torrentReleases.imdbId, item.imdbId), eq(torrentReleases.infoHash, infoHash)));
      notified += 1;
      if (huntingMode && notified === 1) {
        await persistHuntingPin(item, release, infoHash, title);
      }
    }
  }

  const now = new Date();
  const disable = item.notifyOnce && item.type === 'movie' && notified > 0;
  await db
    .update(torrentWatchlist)
    .set({
      lastChecked: now,
      updatedAt: now,
      ...(disable ? { enabled: false } : {}),
    })
    .where(eq(torrentWatchlist.id, item.id));

  return notified;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

export class TorrentWatcherService {
  static async listReleaseCandidates(
    userId: number,
    itemId: number
  ): Promise<TorrentReleaseCandidate[]> {
    const [item] = await db
      .select()
      .from(torrentWatchlist)
      .where(and(eq(torrentWatchlist.id, itemId), eq(torrentWatchlist.userId, userId)))
      .limit(1);
    if (!item) throw new Error('Watchlist item not found');
    const client = ProwlarrClient.fromEnv();
    if (!client) throw new Error('Prowlarr is not configured');

    const pinned = pinnedIdentities(item);
    const releases = await searchForItem(client, item);
    return releases.slice(0, 30).flatMap((release) => {
      const identity = computeReleaseIdentity(release);
      if (!identity.primary) return [];
      return [
        {
          releaseKey: identity.primary,
          aliases: identity.aliases,
          title: release.title ?? identity.primary,
          quality: qualityLabel(release),
          size: mapSize(release.size),
          seeders: release.seeders ?? null,
          tracker: release.indexer || release.tracker || null,
          pinned: releaseMatchesPinned(release, pinned),
        },
      ];
    });
  }

  static async scanDueItems(): Promise<{
    scanned: number;
    notified: number;
    skipped: boolean;
    reason?: string;
  }> {
    const client = ProwlarrClient.fromEnv();
    if (!client) {
      lastWatcherRunAt = new Date().toISOString();
      return { scanned: 0, notified: 0, skipped: true, reason: 'prowlarr_not_configured' };
    }

    const rows = await db
      .select()
      .from(torrentWatchlist)
      .where(
        and(
          eq(torrentWatchlist.enabled, true),
          sql`(
            ${torrentWatchlist.checkInterval} IS NULL
            OR ${torrentWatchlist.lastChecked} IS NULL
            OR ${torrentWatchlist.lastChecked} <= NOW() - (${torrentWatchlist.checkInterval} * INTERVAL '1 minute')
          )`
        )
      )
      .orderBy(asc(torrentWatchlist.lastChecked), asc(torrentWatchlist.id))
      .limit(200);
    if (!rows.length) {
      lastWatcherRunAt = new Date().toISOString();
      return { scanned: 0, notified: 0, skipped: false };
    }

    const counts = await mapPool(rows, CONCURRENCY, async (item) => {
      try {
        return await processItem(client, item);
      } catch (error) {
        log.error({ err: error, imdbId: item.imdbId, id: item.id }, 'Failed to process watchlist item');
        await db
          .update(torrentWatchlist)
          .set({ lastChecked: new Date(), updatedAt: new Date() })
          .where(eq(torrentWatchlist.id, item.id));
        return 0;
      }
    });

    lastWatcherRunAt = new Date().toISOString();
    return {
      scanned: rows.length,
      notified: counts.reduce((sum, value) => sum + value, 0),
      skipped: false,
    };
  }
}
