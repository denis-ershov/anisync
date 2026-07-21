'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';

import { ReleaseContentCard } from '@/components/releases/release-content-card';
import { useReleasesModule } from '@/components/releases/releases-module-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReleaseWatchlist, useReleaseWatchlistStats, useUpdateReleaseWatchlistItem } from '@/lib/releases/hooks';
import type { ReleaseCatalogItem, ReleaseWatchlistStatus } from '@/lib/releases/types';
import { watchlistItemToCatalogItem } from '@/lib/releases/utils';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | ReleaseWatchlistStatus;
type TypeFilter = 'all' | 'movie' | 'show';
type SortMode = 'releaseDate' | 'popularity' | 'rating';
const PAGE_SIZE = 24;

export function ReleasesWatchlistView() {
  const locale = useLocale();
  const t = useTranslations('Releases');
  const lang = locale === 'ru' ? 'ru' : 'en';
  const { openDetail } = useReleasesModule();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<SortMode>('releaseDate');
  const [page, setPage] = useState(1);

  const {
    data: items = [],
    isLoading: watchlistLoading,
    error: watchlistError,
  } = useReleaseWatchlist(lang);
  const updateMutation = useUpdateReleaseWatchlistItem();

  const {
    data: stats = { total: 0, watching: 0, plan: 0, watched: 0, movies: 0, shows: 0 },
    isLoading: statsLoading,
    error: statsError,
  } = useReleaseWatchlistStats();

  const loading = watchlistLoading || statsLoading;
  const error = watchlistError ?? statsError;
  const errorMessage = error instanceof Error ? error.message : error ? t('errors.loadFailed') : null;

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const statusOk = statusFilter === 'all' || item.status === statusFilter;
        const typeOk = typeFilter === 'all' || item.type === typeFilter;
        return statusOk && typeOk;
      })
      .sort((a, b) => {
        if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
        if (sort === 'popularity') return (b.popularity ?? 0) - (a.popularity ?? 0);
        return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
      });
  }, [items, sort, statusFilter, typeFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [statusFilter, typeFilter, sort]);
  useEffect(() => setPage((value) => Math.min(value, totalPages)), [totalPages]);

  const handleStatusChange = async (catalogItem: ReleaseCatalogItem, status: ReleaseWatchlistStatus) => {
    const watchlistItem = items.find(
      (entry) => entry.tmdbId === catalogItem.tmdbId && entry.type === catalogItem.type
    );
    if (!watchlistItem || watchlistItem.status === status) {
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: watchlistItem.id, status });
    } catch {
      // invalidation handled by mutation; errors surface on next fetch if needed
    }
  };

  return (
    <div className="container space-y-4 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: t('stats.total'), value: stats.total },
          { label: t('stats.watching'), value: stats.watching },
          { label: t('stats.plan'), value: stats.plan },
          { label: t('stats.watched'), value: stats.watched },
          { label: t('stats.movies'), value: stats.movies },
          { label: t('stats.shows'), value: stats.shows },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="min-h-11 w-full sm:w-44">
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            <SelectItem value="watching">{t('status.watching')}</SelectItem>
            <SelectItem value="plan">{t('status.plan')}</SelectItem>
            <SelectItem value="watched">{t('status.watched')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}>
          <SelectTrigger className="min-h-11 w-full sm:w-44">
            <SelectValue placeholder={t('filters.sort')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="releaseDate">{t('filters.sortReleaseDate')}</SelectItem>
            <SelectItem value="popularity">{t('filters.sortPopularity')}</SelectItem>
            <SelectItem value="rating">{t('filters.sortRating')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
          <SelectTrigger className="min-h-11 w-full sm:w-44">
            <SelectValue placeholder={t('filters.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            <SelectItem value="movie">{t('type.movie')}</SelectItem>
            <SelectItem value="show">{t('type.show')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 sm:ml-auto" role="group" aria-label={t('view.label')}>
          <Button type="button" size="icon" variant={layout === 'grid' ? 'secondary' : 'ghost'} onClick={() => setLayout('grid')} aria-label={t('view.grid')}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button type="button" size="icon" variant={layout === 'list' ? 'secondary' : 'ghost'} onClick={() => setLayout('list')} aria-label={t('view.list')}>
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {loading ? (
        <div className={cn('grid gap-3', layout === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1 lg:grid-cols-2')}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('emptyWatchlist')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {pageItems.map((item) => (
            <ReleaseContentCard
              key={item.id}
              item={watchlistItemToCatalogItem(item)}
              watchlistStatus={item.status}
              onStatusChange={handleStatusChange}
              onOpen={openDetail}
              layout={layout}
            />
          ))}
        </div>
      )}

      {filteredItems.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            <ChevronLeft className="mr-1 size-4" /> {t('pagination.prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pagination.page', { page })} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            {t('pagination.next')} <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
