'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTorrentWatchlistItem,
  deleteTorrentWatchlistItem,
  fetchTorrentReleaseCandidates,
  fetchTorrentHealth,
  fetchTorrentReleases,
  fetchTorrentWatchlist,
  toggleTorrentWatchlistItem,
  updateTorrentWatchlistItem,
  pinTorrentReleaseCandidate,
  unpinTorrentReleaseCandidate,
} from '@/lib/torrents/api';
import type { TorrentWatchlistPreferences } from '@/lib/torrents/types';
import { torrentQueryKeys } from '@/lib/torrents/query-keys';

const defaultQueryOptions = {
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 30_000,
} as const;

export function useInvalidateTorrentWatchlist() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: torrentQueryKeys.watchlist.root });
  };
}

export function useTorrentHealth() {
  return useQuery({
    queryKey: torrentQueryKeys.health(),
    queryFn: fetchTorrentHealth,
    ...defaultQueryOptions,
    staleTime: 60_000,
  });
}

export function useTorrentWatchlist() {
  return useQuery({
    queryKey: torrentQueryKeys.watchlist.list(),
    queryFn: fetchTorrentWatchlist,
    ...defaultQueryOptions,
  });
}

export function useTorrentReleases(imdbId: string | null, enabled = false) {
  return useQuery({
    queryKey: torrentQueryKeys.releases(imdbId ?? ''),
    queryFn: () => fetchTorrentReleases(imdbId!),
    enabled: enabled && Boolean(imdbId),
    ...defaultQueryOptions,
  });
}

export function useAddTorrentWatchlistItem() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();

  return useMutation({
    mutationFn: ({ imdbId, input }: { imdbId: string; input?: string }) =>
      addTorrentWatchlistItem(imdbId, input),
    onSuccess: invalidateWatchlist,
  });
}

export function useToggleTorrentWatchlistItem() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();

  return useMutation({
    mutationFn: toggleTorrentWatchlistItem,
    onSuccess: invalidateWatchlist,
  });
}

export function useDeleteTorrentWatchlistItem() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();

  return useMutation({
    mutationFn: deleteTorrentWatchlistItem,
    onSuccess: invalidateWatchlist,
  });
}

export function useUpdateTorrentWatchlistItem() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Partial<
        Omit<TorrentWatchlistPreferences, 'pinnedReleaseKey' | 'pinnedReleaseTitle'>
      >;
    }) => updateTorrentWatchlistItem(id, input),
    onSuccess: invalidateWatchlist,
  });
}

export function useTorrentReleaseCandidates(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...torrentQueryKeys.watchlist.root, id, 'candidates'],
    queryFn: () => fetchTorrentReleaseCandidates(id),
    enabled,
    ...defaultQueryOptions,
  });
}

export function usePinTorrentRelease() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, candidate }: Parameters<typeof pinTorrentReleaseCandidate> extends [
      infer Id,
      infer Candidate,
    ]
      ? { id: Id; candidate: Candidate }
      : never) => pinTorrentReleaseCandidate(id, candidate),
    onSuccess: (_data, variables) => {
      invalidateWatchlist();
      void queryClient.invalidateQueries({
        queryKey: [...torrentQueryKeys.watchlist.root, variables.id, 'candidates'],
      });
    },
  });
}

export function useUnpinTorrentRelease() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unpinTorrentReleaseCandidate,
    onSuccess: (_data, id) => {
      invalidateWatchlist();
      void queryClient.invalidateQueries({
        queryKey: [...torrentQueryKeys.watchlist.root, id, 'candidates'],
      });
    },
  });
}
