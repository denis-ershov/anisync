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
import {
  useDeleteTorrentWatchlistItem,
  useToggleTorrentWatchlistItem,
} from '@/lib/torrents/hooks';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';
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

  const toggleMutation = useToggleTorrentWatchlistItem();
  const deleteMutation = useDeleteTorrentWatchlistItem();

  const busy = toggleMutation.isPending || deleteMutation.isPending;
  const secondaryTitle =
    item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : null;
  const lastCheckedLabel = formatDate(item.lastChecked, locale);

  const handleToggleEnabled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleMutation.mutateAsync(item.id);
    } catch {
      // noop
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
          'group overflow-hidden border-border/70 bg-card/70 transition-colors',
          'hover:border-primary/30 hover:bg-card/90 cursor-pointer'
        )}
      >
        <CardContent className="p-0">
          <div className="relative aspect-[2/3] w-full bg-muted">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {item.type === 'movie' ? (
                  <Film className="h-14 w-14 opacity-40" aria-hidden />
                ) : (
                  <Tv className="h-14 w-14 opacity-40" aria-hidden />
                )}
              </div>
            )}

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
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

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
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

          <div className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{item.imdbId}</span>
              {item.year ? <span>· {item.year}</span> : null}
              {item.genre ? <span className="line-clamp-1">· {item.genre}</span> : null}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
                <HardDrive className="h-3 w-3" aria-hidden />
                {t('card.releasesCount', { count: item.releasesCount })}
              </span>
              {lastCheckedLabel ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {lastCheckedLabel}
                </span>
              ) : null}
            </div>

            {item.latestRelease ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {t('card.latestRelease', {
                  title: item.latestRelease.title,
                  quality: item.latestRelease.quality ?? '—',
                })}
              </p>
            ) : null}

            {item.pinnedReleaseTitle ? (
              <p className="inline-flex items-start gap-1 text-xs text-primary">
                <Pin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span className="line-clamp-2">{item.pinnedReleaseTitle}</span>
              </p>
            ) : null}

            {(item.preferredQuality || item.preferredAudio) && (
              <div className="flex flex-wrap gap-1">
                {item.preferredQuality ? (
                  <Badge variant="outline" className="text-[10px]">{item.preferredQuality}</Badge>
                ) : null}
                {item.preferredAudio ? (
                  <Badge variant="outline" className="text-[10px]">{item.preferredAudio}</Badge>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter
          className="flex flex-wrap gap-2 border-t bg-muted/20 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <TorrentPreferencesDialog item={item} />
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
