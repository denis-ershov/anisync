export type ReleaseContentType = 'movie' | 'show';

export type ReleaseCatalogItem = {
  tmdbId: number;
  type: ReleaseContentType;
  title: string;
  titleRu: string | null;
  originalTitle?: string | null;
  rating: number;
  popularity: number;
  posterPath: string | null;
  genre: string | null;
  genreRu: string | null;
  year: number | null;
  overview?: string | null;
  releaseDate: string | null;
  nextEpisode?: {
    season: number;
    episode: number;
    airDate: string | null;
    title: string | null;
  } | null;
};

export type ReleaseCatalogPage = {
  items: ReleaseCatalogItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ReleaseGenre = {
  id: number;
  name: string;
};

export type ReleaseWatchlistItem = {
  id: number;
  tmdbId: number;
  type: ReleaseContentType;
  title: string;
  titleRu: string | null;
  status: 'watching' | 'plan';
  rating: number | null;
  popularity: number | null;
  posterPath: string | null;
  genre: string | null;
  genreRu: string | null;
  year: number | null;
  releaseDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeDate: string | null;
  addedAt: string;
};

export type ReleaseWatchlistStats = {
  total: number;
  watching: number;
  plan: number;
  movies: number;
  shows: number;
};

export type ReleaseContentDetail = ReleaseCatalogItem & {
  overviewRu?: string | null;
  duration?: string | null;
  cast?: string[];
  trailerKey?: string | null;
  imdbId?: string | null;
};
