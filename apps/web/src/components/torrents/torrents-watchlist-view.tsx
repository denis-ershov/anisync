'use client';

import { useTranslations } from 'next-intl';

import { TorrentAddForm } from '@/components/torrents/torrent-add-form';
import { TorrentWatchlistCard } from '@/components/torrents/torrent-watchlist-card';
import { TorrentsHealthBanner } from '@/components/torrents/torrents-health-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { useTorrentWatchlist } from '@/lib/torrents/hooks';

export function TorrentsWatchlistView() {
  const t = useTranslations('Torrents');

  const { data: items = [], isLoading, error } = useTorrentWatchlist();
  const errorMessage = error instanceof Error ? error.message : error ? t('errors.loadFailed') : null;

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full rounded-xl" />
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <TorrentWatchlistCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
