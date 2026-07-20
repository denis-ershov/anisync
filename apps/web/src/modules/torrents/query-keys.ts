const torrentsRoot = ['torrents'] as const;
const watchlistRoot = [...torrentsRoot, 'watchlist'] as const;

export const torrentQueryKeys = {
  all: torrentsRoot,
  health: () => [...torrentsRoot, 'health'] as const,
  watchlist: {
    root: watchlistRoot,
    list: () => [...watchlistRoot, 'list'] as const,
  },
  releases: (imdbId: string) => [...torrentsRoot, 'releases', imdbId] as const,
};
