import type {
  TorrentHealthSnapshot,
  TorrentReleaseCandidate,
  TorrentReleaseItem,
  TorrentWatchlistItem,
  TorrentWatchlistUpdateInput,
} from '@/lib/torrents/types';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export async function fetchTorrentHealth() {
  const response = await fetch('/api/torrents/health', { credentials: 'include' });
  const payload = await parseJson<{
    health?: TorrentHealthSnapshot;
    enabled?: boolean;
    storage?: string;
  } & Partial<TorrentHealthSnapshot>>(response);

  if (payload.health) {
    return payload.health;
  }

  return {
    dbOk: Boolean(payload.dbOk),
    prowlarrOk: payload.prowlarrOk ?? null,
    telegramOk: payload.telegramOk ?? null,
    prowlarrUrl: payload.prowlarrUrl ?? null,
    telegramUsername: payload.telegramUsername ?? null,
    totalItems: payload.totalItems ?? null,
    enabledItems: payload.enabledItems ?? null,
    lastWatcherRun: payload.lastWatcherRun ?? null,
  };
}

export async function fetchTorrentWatchlist() {
  const response = await fetch('/api/torrents/watchlist', { credentials: 'include' });
  return parseJson<TorrentWatchlistItem[]>(response);
}

export async function addTorrentWatchlistItem(imdbId: string, input?: string) {
  const response = await fetch('/api/torrents/watchlist', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imdbId, input }),
  });

  return parseJson<TorrentWatchlistItem>(response);
}

export async function toggleTorrentWatchlistItem(id: number) {
  const response = await fetch(`/api/torrents/watchlist/${id}/toggle`, {
    method: 'POST',
    credentials: 'include',
  });

  return parseJson<TorrentWatchlistItem>(response);
}

export async function deleteTorrentWatchlistItem(id: number) {
  const response = await fetch(`/api/torrents/watchlist/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }
}

export async function updateTorrentWatchlistItem(
  id: number,
  input: TorrentWatchlistUpdateInput
) {
  const response = await fetch(`/api/torrents/watchlist/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<TorrentWatchlistItem>(response);
}

export async function fetchTorrentReleaseCandidates(id: number) {
  const response = await fetch(`/api/torrents/watchlist/${id}/candidates`, {
    credentials: 'include',
  });
  return parseJson<TorrentReleaseCandidate[]>(response);
}

export async function pinTorrentReleaseCandidate(id: number, candidate: TorrentReleaseCandidate) {
  const response = await fetch(`/api/torrents/watchlist/${id}/pin`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidate),
  });
  return parseJson<TorrentWatchlistItem>(response);
}

export async function unpinTorrentReleaseCandidate(id: number) {
  const response = await fetch(`/api/torrents/watchlist/${id}/pin`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJson<TorrentWatchlistItem>(response);
}

export async function fetchTorrentReleases(imdbId: string) {
  const response = await fetch(`/api/torrents/releases/${encodeURIComponent(imdbId)}`, {
    credentials: 'include',
  });

  return parseJson<TorrentReleaseItem[]>(response);
}
