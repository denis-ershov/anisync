export type UpcomingCatalogParams = {
  page?: number;
  pageSize?: number;
  type?: 'all' | 'movie' | 'show';
  sort?: 'popularity' | 'releaseDate' | 'rating';
  genreId?: number | null;
};

const releasesRoot = ['releases'] as const;
const watchlistRoot = [...releasesRoot, 'watchlist'] as const;

export const releaseQueryKeys = {
  all: releasesRoot,
  genres: (lang: string) => [...releasesRoot, 'genres', lang] as const,
  watchlist: {
    root: watchlistRoot,
    list: (lang: string) => [...watchlistRoot, 'list', lang] as const,
    stats: () => [...watchlistRoot, 'stats'] as const,
  },
  catalog: {
    upcoming: (lang: string, params: UpcomingCatalogParams) =>
      [...releasesRoot, 'catalog', 'upcoming', lang, params] as const,
    search: (lang: string, query: string) =>
      [...releasesRoot, 'catalog', 'search', lang, query] as const,
  },
  detail: (tmdbId: number, type: 'movie' | 'show', lang: string) =>
    [...releasesRoot, 'detail', tmdbId, type, lang] as const,
};
