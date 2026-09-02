'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';

import { TorrentAddForm } from '@/components/torrents/torrent-add-form';
import { TorrentWatchlistCard } from '@/components/torrents/torrent-watchlist-card';
import { TorrentsHealthBanner } from '@/components/torrents/torrents-health-banner';
import { CatalogPaginationBar } from '@/components/ui/catalog-pagination-bar';
import { catalogCardGridClassName } from '@/components/ui/catalog-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useTorrentWatchlist } from '@/lib/torrents/hooks';
import {
  DEFAULT_CATALOG_PAGE_SIZE,
  type CatalogPageSize,
} from '@/lib/ui/catalog-pagination';

export function TorrentsWatchlistView() {
  const t = useTranslations('Torrents');
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CatalogPageSize>(DEFAULT_CATALOG_PAGE_SIZE);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  const autoRefresh = user?.settings?.autoRefreshTorrentMetadata ?? false;

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

  const handleToggleAutoRefresh = async (checked: boolean) => {
    if (!user) return;
    setIsUpdatingSetting(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRefreshTorrentMetadata: checked }),
      });
      if (!res.ok) {
        throw new Error('Failed to update settings');
      }
      const data = await res.json();
      updateUser({
        ...user,
        settings: {
          ...user.settings,
          autoRefreshTorrentMetadata: checked,
          ...(data.settings ?? {}),
        },
      });
    } catch {
      toast({
        title: t('errors.actionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingSetting(false);
    }
  };

  return (
    <div className="container space-y-6 px-4 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <TorrentsHealthBanner />

      <section className="space-y-4">
        <div className="rounded-xl border bg-card/50 p-4">
          <TorrentAddForm />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4 backdrop-blur-sm transition-colors hover:border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <Label
                htmlFor="auto-refresh-switch"
                className="text-sm font-medium cursor-pointer"
              >
                {t('autoRefresh')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('autoRefreshHint')}</p>
            </div>
          </div>
          <Switch
            id="auto-refresh-switch"
            checked={autoRefresh}
            disabled={isUpdatingSetting || !user}
            onCheckedChange={handleToggleAutoRefresh}
            aria-label={t('autoRefresh')}
          />
        </div>
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
