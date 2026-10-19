'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTorrentWatchlistItem,
  deleteTorrentWatchlistItem,
  fetchTorrentReleaseCandidates,
  fetchTorrentHealth,
  fetchTorrentReleases,
  fetchTorrentWatchlist,
  refreshTorrentWatchlistItem,
  toggleTorrentWatchlistItem,
  updateTorrentWatchlistItem,
  pinTorrentReleaseCandidate,
  unpinTorrentReleaseCandidate,
  notifyTorrentReleaseCandidate,
} from '@/lib/torrents/api';
import type { TorrentReleaseCandidate, TorrentWatchlistUpdateInput } from '@/lib/torrents/types';
import type { TorrentMetadataRefreshField } from '@/lib/types';
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: TorrentWatchlistUpdateInput;
    }) => updateTorrentWatchlistItem(id, input),
    onSuccess: (_data, variables) => {
      invalidateWatchlist();
      void queryClient.invalidateQueries({
        queryKey: torrentQueryKeys.watchlist.candidates(variables.id),
      });
      queryClient.removeQueries({
        queryKey: torrentQueryKeys.watchlist.candidates(variables.id),
      });
    },
  });
}

export function useTorrentReleaseCandidates(id: number, enabled: boolean) {
  return useQuery({
    queryKey: torrentQueryKeys.watchlist.candidates(id),
    queryFn: () => fetchTorrentReleaseCandidates(id),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 60_000,
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
        queryKey: torrentQueryKeys.watchlist.candidates(variables.id),
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
        queryKey: torrentQueryKeys.watchlist.candidates(id),
      });
    },
  });
}

export function useNotifyTorrentRelease() {
  return useMutation({
    mutationFn: ({
      id,
      candidate,
    }: {
      id: number;
      candidate: TorrentReleaseCandidate;
    }) => notifyTorrentReleaseCandidate(id, candidate),
  });
}

export function useRefreshTorrentWatchlistItem() {
  const invalidateWatchlist = useInvalidateTorrentWatchlist();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: number | { id: number; fields?: TorrentMetadataRefreshField[] }) => {
      if (typeof args === 'number') {
        return refreshTorrentWatchlistItem(args);
      }
      return refreshTorrentWatchlistItem(args.id, args.fields);
    },
    onSuccess: (_data, args) => {
      invalidateWatchlist();
      const id = typeof args === 'number' ? args : args.id;
      void queryClient.invalidateQueries({
        queryKey: torrentQueryKeys.watchlist.candidates(id),
      });
      queryClient.removeQueries({
        queryKey: torrentQueryKeys.watchlist.candidates(id),
      });
    },
  });
}
