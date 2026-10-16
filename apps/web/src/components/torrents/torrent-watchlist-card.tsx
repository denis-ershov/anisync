'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Calendar,
  Film,
  HardDrive,
  Loader2,
  Pin,
  Power,
  RefreshCw,
  Star,
  Trash2,
  Tv,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { TorrentPreferencesDialog } from '@/components/torrents/torrent-preferences-dialog';
import { TorrentWatchlistDetailModal } from '@/components/torrents/torrent-watchlist-detail-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  useDeleteTorrentWatchlistItem,
  useRefreshTorrentWatchlistItem,
  useToggleTorrentWatchlistItem,
} from '@/lib/torrents/hooks';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';
import { getTorrentScheduleLine } from '@/lib/torrents/schedule-label';
import { cn } from '@/lib/utils';

type TorrentWatchlistCardProps = {
  item: TorrentWatchlistItem;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function typeLabel(type: string, t: ReturnType<typeof useTranslations<'Torrents'>>) {
  if (type === 'movie') return t('type.movie');
  if (type === 'tv') return t('type.tv');
  return type.toUpperCase();
}

export function TorrentWatchlistCard({ item }: TorrentWatchlistCardProps) {
  const t = useTranslations('Torrents');
  const locale = useLocale();
  const { toast } = useToast();

  const toggleMutation = useToggleTorrentWatchlistItem();
  const deleteMutation = useDeleteTorrentWatchlistItem();
  const refreshMutation = useRefreshTorrentWatchlistItem();

  const busy = toggleMutation.isPending || deleteMutation.isPending || refreshMutation.isPending;
  const secondaryTitle =
    item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : null;
  const lastCheckedLabel = formatDate(item.lastChecked, locale);
  const scheduleLabel = getTorrentScheduleLine(item, locale, t);

  const handleToggleEnabled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleMutation.mutateAsync(item.id);
    } catch {
      // noop
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await refreshMutation.mutateAsync(item.id);
      toast({
        title: t('refreshSuccess'),
      });
    } catch {
      toast({
        title: t('refreshError'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('card.deleteConfirm', { title: item.title }))) return;
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch {
      // noop
    }
  };

  return (
    <TorrentWatchlistDetailModal item={item}>
      <Card
        className={cn(
          'group h-full overflow-hidden border-border/70 bg-card/70 transition-colors',
          'hover:border-primary/30 hover:bg-card/90 cursor-pointer'
        )}
      >
        <CardContent className="p-0 flex flex-row sm:flex-col flex-1 min-w-0">
          <div className="relative w-24 sm:w-full shrink-0 aspect-[2/3] bg-muted overflow-hidden">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100px, 20vw"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {item.type === 'movie' ? (
                  <Film className="h-8 w-8 sm:h-14 sm:w-14 opacity-40" aria-hidden />
                ) : (
                  <Tv className="h-8 w-8 sm:h-14 sm:w-14 opacity-40" aria-hidden />
                )}
              </div>
            )}

            <div className="hidden sm:flex absolute inset-x-0 top-0 items-start justify-between gap-2 p-2">
              {item.rating != null && item.rating > 0 ? (
                <Badge className="gap-1 border-0 bg-black/55 text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                  {item.rating.toFixed(1)}
                </Badge>
              ) : (
                <span />
              )}
              <Badge
                variant={item.enabled ? 'default' : 'secondary'}
                className="shrink-0 backdrop-blur-sm"
              >
                {item.enabled ? t('card.enabled') : t('card.paused')}
              </Badge>
            </div>

            <div className="hidden sm:block absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
              <Badge variant="outline" className="mb-2 border-white/30 bg-black/40 text-white">
                {typeLabel(item.type, t)}
              </Badge>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                {item.title}
              </h3>
              {secondaryTitle ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-white/75">{secondaryTitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex-1 min-w-0 p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="block sm:hidden space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {typeLabel(item.type, t)}
                    </Badge>
                    {item.year ? (
                      <span className="text-[11px] text-muted-foreground">{item.year}</span>
                    ) : null}
                    {item.rating != null && item.rating > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-500">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                        {item.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <Badge
                    variant={item.enabled ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.enabled ? t('card.enabled') : t('card.paused')}
                  </Badge>
                </div>
                <h3 className="line-clamp-1 text-sm font-semibold leading-snug">
                  {item.title}
                </h3>
                {secondaryTitle ? (
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{secondaryTitle}</p>
                ) : null}
              </div>

              <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{item.imdbId}</span>
                {item.year ? <span>· {item.year}</span> : null}
                {item.genre ? <span className="line-clamp-1">· {item.genre}</span> : null}
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                {scheduleLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 sm:px-2 sm:py-1 text-primary">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="line-clamp-1">{scheduleLabel}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2 sm:py-1 text-muted-foreground">
                  <HardDrive className="h-3 w-3 shrink-0" aria-hidden />
                  {t('card.releasesCount', { count: item.releasesCount })}
                </span>
                {lastCheckedLabel ? (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    {lastCheckedLabel}
                  </span>
                ) : null}
              </div>

              {(item.preferredQuality || item.preferredAudio) && (
                <div className="flex flex-wrap gap-1">
                  {item.preferredQuality ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.preferredQuality}</Badge>
                  ) : null}
                  {item.preferredAudio ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.preferredAudio}</Badge>
                  ) : null}
                </div>
              )}

              {item.pinnedReleaseTitle ? (
                <p className="inline-flex items-start gap-1 text-[11px] sm:text-xs text-primary">
                  <Pin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{item.pinnedReleaseTitle}</span>
                </p>
              ) : item.latestRelease ? (
                <p className="hidden sm:block line-clamp-2 text-xs text-muted-foreground">
                  {t('card.latestRelease', {
                    title: item.latestRelease.title,
                    quality: item.latestRelease.quality ?? '—',
                  })}
                </p>
              ) : null}
            </div>

            <div
              className="flex sm:hidden items-center gap-1.5 pt-2 border-t border-border/40 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <TorrentPreferencesDialog
                item={item}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('preferences.action')}
                  </Button>
                }
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleRefresh}
                disabled={busy}
                title={t('card.refresh')}
                aria-label={t('card.refresh')}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', refreshMutation.isPending && 'animate-spin text-primary')}
                  aria-hidden
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleToggleEnabled}
                disabled={busy}
                title={item.enabled ? t('card.pause') : t('card.resume')}
                aria-label={item.enabled ? t('card.pause') : t('card.resume')}
              >
                {toggleMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Power className="h-3.5 w-3.5" aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={busy}
                aria-label={t('card.remove')}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter
          className="hidden sm:flex flex-wrap gap-2 border-t bg-muted/20 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <TorrentPreferencesDialog item={item} />
          <Button
            variant="outline"
            size="sm"
            className="min-h-9 px-2.5 transition-colors hover:border-primary/50 hover:text-primary"
            onClick={handleRefresh}
            disabled={busy}
            title={t('card.refresh')}
            aria-label={t('card.refresh')}
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshMutation.isPending && 'animate-spin text-primary')}
              aria-hidden
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-9 flex-1 sm:flex-none"
            onClick={handleToggleEnabled}
            disabled={busy}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Power className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {item.enabled ? t('card.pause') : t('card.resume')}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={busy}
            aria-label={t('card.remove')}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </CardFooter>
      </Card>
    </TorrentWatchlistDetailModal>
  );
}
