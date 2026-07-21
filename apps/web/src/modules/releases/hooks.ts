'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addToReleaseWatchlist,
  deleteReleaseWatchlistItem,
  fetchReleaseContentDetail,
  fetchReleaseGenres,
  fetchReleaseWatchlist,
  fetchReleaseWatchlistStats,
  fetchUpcomingCatalog,
  searchReleaseContent,
  updateReleaseWatchlistItem,
} from '@/lib/releases/api';
import { releaseQueryKeys, type UpcomingCatalogParams } from '@/lib/releases/query-keys';
import type { ReleaseWatchlistStatus } from '@/lib/releases/types';

const defaultQueryOptions = {
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 30_000,
} as const;

export function useInvalidateReleaseWatchlist() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: releaseQueryKeys.watchlist.root });
  };
}

export function useReleaseGenres(lang: string) {
  return useQuery({
    queryKey: releaseQueryKeys.genres(lang),
    queryFn: () => fetchReleaseGenres(lang),
    ...defaultQueryOptions,
  });
}

export function useReleaseWatchlist(lang: string) {
  return useQuery({
    queryKey: releaseQueryKeys.watchlist.list(lang),
    queryFn: () => fetchReleaseWatchlist(lang),
    ...defaultQueryOptions,
  });
}

export function useReleaseWatchlistStats() {
  return useQuery({
    queryKey: releaseQueryKeys.watchlist.stats(),
    queryFn: fetchReleaseWatchlistStats,
    ...defaultQueryOptions,
  });
}

export function useReleaseUpcomingCatalog(lang: string, params: UpcomingCatalogParams, enabled = true) {
  return useQuery({
    queryKey: releaseQueryKeys.catalog.upcoming(lang, params),
    queryFn: () => fetchUpcomingCatalog(lang, params),
    enabled,
    ...defaultQueryOptions,
  });
}

export function useReleaseSearch(lang: string, query: string) {
  return useQuery({
    queryKey: releaseQueryKeys.catalog.search(lang, query),
    queryFn: () => searchReleaseContent(lang, query),
    enabled: query.length > 0,
    ...defaultQueryOptions,
  });
}

export function useReleaseContentDetail(
  tmdbId: number | null,
  type: 'movie' | 'show' | null,
  lang: string
) {
  return useQuery({
    queryKey: releaseQueryKeys.detail(tmdbId ?? 0, type ?? 'movie', lang),
    queryFn: () => fetchReleaseContentDetail(tmdbId!, type!, lang),
    enabled: tmdbId !== null && type !== null,
    ...defaultQueryOptions,
  });
}

export function useAddToReleaseWatchlist() {
  const invalidateWatchlist = useInvalidateReleaseWatchlist();

  return useMutation({
    mutationFn: addToReleaseWatchlist,
    onSuccess: invalidateWatchlist,
  });
}

export function useUpdateReleaseWatchlistItem() {
  const invalidateWatchlist = useInvalidateReleaseWatchlist();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReleaseWatchlistStatus }) =>
      updateReleaseWatchlistItem(id, status),
    onSuccess: invalidateWatchlist,
  });
}

export function useDeleteReleaseWatchlistItem() {
  const invalidateWatchlist = useInvalidateReleaseWatchlist();

  return useMutation({
    mutationFn: deleteReleaseWatchlistItem,
    onSuccess: invalidateWatchlist,
  });
}
