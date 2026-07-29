import type { CatalogOptions, CatalogSort, CatalogTypeFilter } from '@/lib/integrations/tmdb/client';

export function buildUpcomingCacheKey(lang: string, options: Required<Pick<CatalogOptions, 'page' | 'pageSize' | 'type' | 'sort'>> & { genreId: number | null }) {
  const genre = options.genreId ?? 0;
  return `tmdb:upcoming:${lang}:${options.type}:${options.sort}:${genre}:${options.page}:${options.pageSize}`;
}

export function buildDetailCacheKey(tmdbId: number, tmdbLang: string) {
  return `tmdb:detail:${tmdbId}:${tmdbLang}`;
}

export function buildMovieReleaseDateCacheKey(movieId: number, from: string, toExclusive: string) {
  return `tmdb:movie-release:v3:${movieId}:${from}:${toExclusive}`;
}

export function buildShowScheduleCacheKey(tmdbId: number, lang: string) {
  return `tmdb:schedule:${tmdbId}:${lang}`;
}

export const UPCOMING_PRECOMPUTE_COMBOS: Array<{
  lang: 'en' | 'ru';
  type: CatalogTypeFilter;
  sort: CatalogSort;
}> = [
  { lang: 'en', type: 'all', sort: 'popularity' },
  { lang: 'en', type: 'all', sort: 'releaseDate' },
  { lang: 'en', type: 'movie', sort: 'popularity' },
  { lang: 'en', type: 'show', sort: 'popularity' },
  { lang: 'ru', type: 'all', sort: 'popularity' },
  { lang: 'ru', type: 'all', sort: 'releaseDate' },
  { lang: 'ru', type: 'movie', sort: 'popularity' },
  { lang: 'ru', type: 'show', sort: 'popularity' },
];
