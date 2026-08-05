'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ReleaseContentCard } from '@/components/releases/release-content-card';
import { useReleasesModule } from '@/components/releases/releases-module-context';
import { Button } from '@/components/ui/button';
import { CatalogPaginationBar } from '@/components/ui/catalog-pagination-bar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAddToReleaseWatchlist,
  useReleaseGenres,
  useReleaseSearch,
  useReleaseUpcomingCatalog,
  useReleaseWatchlist,
  useUpdateReleaseWatchlistItem,
} from '@/lib/releases/hooks';
import type { ReleaseCatalogItem, ReleaseWatchlistItem } from '@/lib/releases/types';
import { getNextWatchlistStatus } from '@/lib/releases/utils';
import {
  catalogCardGridClassName,
  catalogListGridClassName,
  DEFAULT_CATALOG_PAGE_SIZE,
  type CatalogPageSize,
} from '@/lib/ui/catalog-pagination';
import { cn } from '@/lib/utils';

type CatalogType = 'all' | 'movie' | 'show';
type CatalogSort = 'popularity' | 'releaseDate' | 'rating';

function CatalogFilters({
  type,
  sort,
  genreId,
  genres,
  onTypeChange,
  onSortChange,
  onGenreChange,
  layout,
}: {
  type: CatalogType;
  sort: CatalogSort;
  genreId: string;
  genres: Array<{ id: number; name: string }>;
  onTypeChange: (value: CatalogType) => void;
  onSortChange: (value: CatalogSort) => void;
  onGenreChange: (value: string) => void;
  layout: 'inline' | 'stacked';
}) {
  const t = useTranslations('Releases');
  const selectClass = layout === 'inline' ? 'w-full md:w-36' : 'w-full';
  const sortClass = layout === 'inline' ? 'w-full md:w-40' : 'w-full';
  const genreClass = layout === 'inline' ? 'w-full md:w-44' : 'w-full';

  return (
    <>
      <Select value={type} onValueChange={(value) => onTypeChange(value as CatalogType)}>
        <SelectTrigger className={selectClass}>
          <SelectValue placeholder={t('filters.type')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
          <SelectItem value="movie">{t('type.movie')}</SelectItem>
          <SelectItem value="show">{t('type.show')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(value) => onSortChange(value as CatalogSort)}>
        <SelectTrigger className={sortClass}>
          <SelectValue placeholder={t('filters.sort')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="popularity">{t('filters.sortPopularity')}</SelectItem>
          <SelectItem value="releaseDate">{t('filters.sortReleaseDate')}</SelectItem>
          <SelectItem value="rating">{t('filters.sortRating')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={genreId} onValueChange={onGenreChange}>
        <SelectTrigger className={genreClass}>
          <SelectValue placeholder={t('filters.genre')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allGenres')}</SelectItem>
          {genres.map((genre) => (
            <SelectItem key={genre.id} value={String(genre.id)}>
              {genre.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function ReleasesDiscoverView() {
  const locale = useLocale();
  const t = useTranslations('Releases');
  const lang = locale === 'ru' ? 'ru' : 'en';
  const { openDetail } = useReleasesModule();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<CatalogType>('all');
  const [sort, setSort] = useState<CatalogSort>('popularity');
  const [genreId, setGenreId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CatalogPageSize>(DEFAULT_CATALOG_PAGE_SIZE);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [type, sort, genreId, pageSize, lang]);

  const catalogParams = useMemo(
    () => ({
      page,
      pageSize,
      type,
      sort,
      genreId: genreId === 'all' ? null : Number(genreId),
    }),
    [genreId, page, pageSize, sort, type]
  );

  const isSearchMode = debouncedQuery.length > 0;

  const { data: genres = [] } = useReleaseGenres(lang);
  const { data: watchlist = [] } = useReleaseWatchlist(lang);
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useReleaseSearch(lang, debouncedQuery);
  const {
    data: catalog,
    isLoading: catalogLoading,
    error: catalogError,
  } = useReleaseUpcomingCatalog(lang, catalogParams, !isSearchMode);

  const addMutation = useAddToReleaseWatchlist();
  const updateMutation = useUpdateReleaseWatchlistItem();

  const loading = isSearchMode ? searchLoading : catalogLoading;
  const fetchError = isSearchMode ? searchError : catalogError;
  const errorMessage =
    actionError ??
    (fetchError instanceof Error ? fetchError.message : fetchError ? t('errors.loadFailed') : null);

  const items = isSearchMode ? (searchResults ?? []) : (catalog?.items ?? []);
  const hasNextPage = isSearchMode ? false : (catalog?.hasNextPage ?? false);
  const hasPreviousPage = isSearchMode ? false : (catalog?.hasPreviousPage ?? false);
  const totalPages = isSearchMode ? undefined : catalog?.totalPages;

  const cardsGridClass = layout === 'grid' ? catalogCardGridClassName : catalogListGridClassName;

  const watchlistMap = useMemo(() => {
    const map = new Map<string, ReleaseWatchlistItem>();
    for (const item of watchlist) {
      map.set(`${item.tmdbId}:${item.type}`, item);
    }
    return map;
  }, [watchlist]);

  const handleStatusClick = async (item: ReleaseCatalogItem) => {
    const key = `${item.tmdbId}:${item.type}`;
    const existing = watchlistMap.get(key);
    const nextStatus = getNextWatchlistStatus(existing?.status ?? null);

    if (!nextStatus) {
      return;
    }

    setActionError(null);

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, status: nextStatus });
      } else {
        await addMutation.mutateAsync({
          tmdbId: item.tmdbId,
          type: item.type,
          status: nextStatus,
          title: item.title,
          titleRu: item.titleRu,
          rating: item.rating,
          popularity: item.popularity,
          posterPath: item.posterPath,
          genre: item.genre,
          genreRu: item.genreRu,
          year: item.year,
          releaseDate: item.releaseDate,
          nextEpisodeSeason: item.nextEpisode?.season ?? null,
          nextEpisodeNumber: item.nextEpisode?.episode ?? null,
          nextEpisodeDate: item.nextEpisode?.airDate ?? null,
        });
      }
    } catch (actionErr) {
      setActionError(actionErr instanceof Error ? actionErr.message : t('errors.watchlistFailed'));
    }
  };

  const handlePageSizeChange = (nextSize: CatalogPageSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return (
    <div className="container space-y-4 px-4 py-4">
      <div className="space-y-3">
        <div className="flex gap-2 md:hidden">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-h-11 pl-9"
            />
          </div>
          {!isSearchMode ? (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="min-h-11 shrink-0" aria-label={t('filters.open')}>
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <SheetHeader className="text-left">
                  <SheetTitle>{t('filters.title')}</SheetTitle>
                  <SheetDescription>{t('filters.description')}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  <CatalogFilters
                    layout="stacked"
                    type={type}
                    sort={sort}
                    genreId={genreId}
                    genres={genres}
                    onTypeChange={setType}
                    onSortChange={setSort}
                    onGenreChange={setGenreId}
                  />
                  <Button type="button" className="min-h-11 w-full" onClick={() => setFiltersOpen(false)}>
                    {t('filters.apply')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
        </div>

        <div className={cn('gap-3', isSearchMode ? 'flex' : 'hidden md:grid md:grid-cols-[1fr_auto_auto_auto]')}>
          <div className={cn('relative', !isSearchMode && 'hidden md:block')}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-h-11 pl-9"
            />
          </div>
          {!isSearchMode ? (
            <CatalogFilters
              layout="inline"
              type={type}
              sort={sort}
              genreId={genreId}
              genres={genres}
              onTypeChange={setType}
              onSortChange={setSort}
              onGenreChange={setGenreId}
            />
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-1" role="group" aria-label={t('view.label')}>
        <Button type="button" size="icon" variant={layout === 'grid' ? 'secondary' : 'ghost'} onClick={() => setLayout('grid')} aria-label={t('view.grid')}>
          <LayoutGrid className="size-4" />
        </Button>
        <Button type="button" size="icon" variant={layout === 'list' ? 'secondary' : 'ghost'} onClick={() => setLayout('list')} aria-label={t('view.list')}>
          <List className="size-4" />
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {loading ? (
        <div className={cardsGridClass}>
          {Array.from({ length: Math.min(pageSize, 10) }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('emptyCatalog')}</p>
      ) : (
        <div className={cardsGridClass}>
          {items.map((item) => {
            const watchlistItem = watchlistMap.get(`${item.tmdbId}:${item.type}`);
            return (
              <ReleaseContentCard
                key={`${item.tmdbId}-${item.type}`}
                item={item}
                watchlistStatus={watchlistItem?.status ?? null}
                onStatusClick={handleStatusClick}
                onOpen={openDetail}
                layout={layout}
              />
            );
          })}
        </div>
      )}

      {!isSearchMode ? (
        <CatalogPaginationBar
          page={page}
          pageSize={pageSize}
          hasPreviousPage={hasPreviousPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}
    </div>
  );
}
