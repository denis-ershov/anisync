import type { NextRequest } from 'next/server';

import type { CatalogOptions, CatalogSort } from '@/lib/integrations/tmdb';

export function getLang(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang');
  return lang === 'ru' ? 'ru' : 'en';
}

export function parseCatalogOptions(request: NextRequest): CatalogOptions {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('pageSize'));
  const genreId = Number(searchParams.get('genreId'));
  const type = searchParams.get('type');
  const sort = searchParams.get('sort');

  return {
    page: Number.isFinite(page) ? page : undefined,
    pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    genreId: Number.isFinite(genreId) ? genreId : undefined,
    type: type === 'movie' || type === 'show' || type === 'all' ? type : undefined,
    sort: sort === 'popularity' || sort === 'releaseDate' || sort === 'rating' ? (sort as CatalogSort) : undefined,
  };
}
