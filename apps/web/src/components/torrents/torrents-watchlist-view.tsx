'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { TorrentAddForm } from '@/components/torrents/torrent-add-form';
import { TorrentWatchlistCard } from '@/components/torrents/torrent-watchlist-card';
import { TorrentsHealthBanner } from '@/components/torrents/torrents-health-banner';
import { CatalogPaginationBar } from '@/components/ui/catalog-pagination-bar';
import { catalogCardGridClassName } from '@/components/ui/catalog-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { useTorrentWatchlist } from '@/lib/torrents/hooks';
import {
  DEFAULT_CATALOG_PAGE_SIZE,
  type CatalogPageSize,
} from '@/lib/ui/catalog-pagination';

export function TorrentsWatchlistView() {
  const t = useTranslations('Torrents');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CatalogPageSize>(DEFAULT_CATALOG_PAGE_SIZE);

  const { data: items = [], isLoading, error } = useTorrentWatchlist();
  const errorMessage = error instanceof Error ? error.message : error ? t('errors.loadFailed') : null;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  useEffect(() => setPage(1), [pageSize, items.length]);
  useEffect(() => setPage((value) => Math.min(value, totalPages)), [totalPages]);

  const handlePageSizeChange = (nextSize: CatalogPageSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return (
    <div className="container space-y-6 px-4 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <TorrentsHealthBanner />

      <section className="rounded-xl border bg-card/50 p-4">
        <TorrentAddForm />
      </section>

      {isLoading ? (
        <div className={catalogCardGridClassName}>
          {Array.from({ length: Math.min(pageSize, 10) }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      ) : errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{t('empty.title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('empty.description')}</p>
        </div>
      ) : (
        <>
          <div className={catalogCardGridClassName}>
            {pageItems.map((item) => (
              <TorrentWatchlistCard key={item.id} item={item} />
            ))}
          </div>
          <CatalogPaginationBar
            page={page}
            pageSize={pageSize}
            hasPreviousPage={page > 1}
            hasNextPage={page < totalPages}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
