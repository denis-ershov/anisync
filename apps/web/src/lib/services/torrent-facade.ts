import type {
  TorrentHealthSnapshot,
  TorrentReleaseItem,
  TorrentWatchlistItem,
  TorrentWatchlistUpdateInput,
} from '@/lib/torrents/types';
import { TorrentLocalStore } from '@/lib/services/torrent-local-store';

export async function listTorrentWatchlist(userId: number): Promise<TorrentWatchlistItem[]> {
  return TorrentLocalStore.list(userId);
}

export async function addTorrentWatchlist(
  userId: number,
  imdbId: string,
  input?: string,
  telegramChatId?: string | null
) {
  const seasonMatch = input?.match(/\b(?:s|season\s*|сезон\s*)(\d{1,2})\b/i);
  return TorrentLocalStore.add(userId, imdbId, {
    title: imdbId,
    telegramChatId,
    targetSeason: seasonMatch ? Number(seasonMatch[1]) : null,
  });
}

export async function toggleTorrentWatchlist(userId: number, itemId: number) {
  return TorrentLocalStore.toggle(userId, itemId);
}

export async function deleteTorrentWatchlist(userId: number, itemId: number) {
  return TorrentLocalStore.remove(userId, itemId);
}

export async function listTorrentReleases(
  userId: number,
  imdbId: string
): Promise<TorrentReleaseItem[]> {
  void userId;
  return TorrentLocalStore.listReleases(imdbId);
}

export async function getTorrentHealth(): Promise<TorrentHealthSnapshot & { mode: 'local' }> {
  return TorrentLocalStore.health();
}

export async function syncTorrentTelegram(userId: number, telegramChatId: string | null) {
  return TorrentLocalStore.syncTelegramChatId(userId, telegramChatId);
}

export async function updateTorrentPreferences(
  userId: number,
  itemId: number,
  input: TorrentWatchlistUpdateInput
) {
  return TorrentLocalStore.updatePreferences(userId, itemId, input);
}

export async function pinTorrentRelease(
  userId: number,
  itemId: number,
  releaseKey: string,
  aliases: string[],
  title: string
) {
  return TorrentLocalStore.pinRelease(userId, itemId, releaseKey, aliases, title);
}

export async function unpinTorrentRelease(userId: number, itemId: number) {
  return TorrentLocalStore.unpinRelease(userId, itemId);
}
