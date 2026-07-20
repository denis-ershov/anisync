import type {
  ReleaseCatalogItem,
  ReleaseCatalogPage,
  ReleaseContentDetail,
  ReleaseGenre,
  ReleaseWatchlistItem,
  ReleaseWatchlistStats,
} from '@/lib/releases/types';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }

  return response.json() as Promise<T>;
}

function withLang(url: string, lang: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${lang}`;
}

export async function fetchUpcomingCatalog(
  lang: string,
  params: {
    page?: number;
    pageSize?: number;
    type?: 'all' | 'movie' | 'show';
    sort?: 'popularity' | 'releaseDate' | 'rating';
    genreId?: number | null;
  }
) {
  const search = new URLSearchParams({ lang });
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.type) search.set('type', params.type);
  if (params.sort) search.set('sort', params.sort);
  if (params.genreId) search.set('genreId', String(params.genreId));

  const response = await fetch(`/api/releases/content/upcoming?${search.toString()}`, {
    credentials: 'include',
  });

  return parseJson<ReleaseCatalogPage>(response);
}

export async function fetchReleaseGenres(lang: string) {
  const response = await fetch(withLang('/api/releases/content/genres', lang), {
    credentials: 'include',
  });
  return parseJson<ReleaseGenre[]>(response);
}

export async function searchReleaseContent(lang: string, query: string) {
  const search = new URLSearchParams({ lang, query });
  const response = await fetch(`/api/releases/content/search?${search.toString()}`, {
    credentials: 'include',
  });
  return parseJson<ReleaseCatalogItem[]>(response);
}

export async function fetchReleaseWatchlist(lang: string) {
  const response = await fetch(withLang('/api/releases/watchlist', lang), {
    credentials: 'include',
  });
  return parseJson<ReleaseWatchlistItem[]>(response);
}

export async function fetchReleaseWatchlistStats() {
  const response = await fetch('/api/releases/watchlist/stats', { credentials: 'include' });
  return parseJson<ReleaseWatchlistStats>(response);
}

export async function addToReleaseWatchlist(payload: Record<string, unknown>) {
  const response = await fetch('/api/releases/watchlist', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<ReleaseWatchlistItem>(response);
}

export async function updateReleaseWatchlistItem(id: number, status: 'watching' | 'plan') {
  const response = await fetch(`/api/releases/watchlist/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson<ReleaseWatchlistItem>(response);
}

export async function deleteReleaseWatchlistItem(id: number) {
  const response = await fetch(`/api/releases/watchlist/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }
}

export async function fetchReleaseContentDetail(tmdbId: number, type: 'movie' | 'show', lang: string) {
  const search = new URLSearchParams({ lang, type });
  const response = await fetch(`/api/releases/content/${tmdbId}?${search.toString()}`, {
    credentials: 'include',
  });
  return parseJson<ReleaseContentDetail>(response);
}
