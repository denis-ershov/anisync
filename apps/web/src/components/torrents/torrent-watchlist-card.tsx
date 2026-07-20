'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Loader2, Power, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { TorrentPreferencesDialog } from '@/components/torrents/torrent-preferences-dialog';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';
import {
  useDeleteTorrentWatchlistItem,
  useToggleTorrentWatchlistItem,
  useTorrentReleases,
} from '@/lib/torrents/hooks';

type TorrentWatchlistCardProps = {
  item: TorrentWatchlistItem;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function TorrentWatchlistCard({ item }: TorrentWatchlistCardProps) {
  const t = useTranslations('Torrents');
  const locale = useLocale();

  const [expanded, setExpanded] = useState(false);
  const toggleMutation = useToggleTorrentWatchlistItem();
  const deleteMutation = useDeleteTorrentWatchlistItem();
  const releasesQuery = useTorrentReleases(item.imdbId, expanded);

  const busy = toggleMutation.isPending || deleteMutation.isPending;

  const handleToggleEnabled = async () => {
    try {
      await toggleMutation.mutateAsync(item.id);
    } catch {
      // mutation error surfaced via parent if needed
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('card.deleteConfirm', { title: item.title }))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(item.id);
    } catch {
      // noop
    }
  };

  return (
    <Card className="overflow-hidden border-border/70 bg-card/70">
      <CardHeader className="flex flex-row gap-3 space-y-0 p-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.posterUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              {t('card.noPoster')}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="line-clamp-2 text-base leading-snug">{item.title}</CardTitle>
            <Badge variant={item.enabled ? 'default' : 'secondary'}>
              {item.enabled ? t('card.enabled') : t('card.paused')}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.imdbId}
            {item.year ? ` · ${item.year}` : ''}
            {item.type ? ` · ${item.type.toUpperCase()}` : ''}
          </p>
          {item.latestRelease ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {t('card.latestRelease', {
                title: item.latestRelease.title,
                quality: item.latestRelease.quality ?? '—',
              })}
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-2 pt-0">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{t('card.releasesCount', { count: item.releasesCount })}</span>
          {item.lastChecked ? (
            <span>{t('card.lastChecked', { date: formatDate(item.lastChecked, locale) })}</span>
          ) : null}
        </div>

        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="min-h-11 w-full justify-between">
              {t('card.showReleases')}
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {releasesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : releasesQuery.error ? (
              <p className="text-sm text-destructive">{t('errors.loadReleasesFailed')}</p>
            ) : !releasesQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">{t('card.noReleases')}</p>
            ) : (
              <ul className="space-y-2">
                {releasesQuery.data.map((release, index) => (
                  <li
                    key={`${release.title}-${index}`}
                    className="rounded-lg border bg-background/60 px-3 py-2 text-sm"
                  >
                    <p className="font-medium leading-snug">{release.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {release.quality ? <span>{release.quality}</span> : null}
                      {release.size ? <span>{release.size}</span> : null}
                      {release.seeders !== null ? (
                        <span>{t('card.seeders', { count: release.seeders })}</span>
                      ) : null}
                      {release.tracker ? <span>{release.tracker}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3">
        <TorrentPreferencesDialog item={item} />
        <Button
          variant="outline"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={handleToggleEnabled}
          disabled={busy}
        >
          {toggleMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Power className="size-4" aria-hidden />
          )}
          <span className="ml-2">{item.enabled ? t('card.pause') : t('card.resume')}</span>
        </Button>
        <Button
          variant="destructive"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={handleDelete}
          disabled={busy}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          <span className="ml-2">{t('card.remove')}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
