'use client';

import { useState, type ReactNode } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDeleteTorrentWatchlistItem,
  useToggleTorrentWatchlistItem,
  useTorrentReleases,
} from '@/lib/torrents/hooks';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';

type TorrentWatchlistDetailModalProps = {
  item: TorrentWatchlistItem;
  children: ReactNode;
  onRemoved?: () => void;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function typeLabel(type: string, t: ReturnType<typeof useTranslations<'Torrents'>>) {
  if (type === 'movie') return t('type.movie');
  if (type === 'tv') return t('type.tv');
  return type.toUpperCase();
}

export function TorrentWatchlistDetailModal({
  item,
  children,
  onRemoved,
}: TorrentWatchlistDetailModalProps) {
  const t = useTranslations('Torrents');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const toggleMutation = useToggleTorrentWatchlistItem();
  const deleteMutation = useDeleteTorrentWatchlistItem();
  const releasesQuery = useTorrentReleases(item.imdbId, open);

  const busy = toggleMutation.isPending || deleteMutation.isPending;
  const secondaryTitle =
    item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : null;

  const handleToggle = async () => {
    try {
      await toggleMutation.mutateAsync(item.id);
    } catch {
      // noop
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('card.deleteConfirm', { title: item.title }))) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      setOpen(false);
      onRemoved?.();
    } catch {
      // noop
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[min(92vh,900px)] max-w-3xl gap-0 overflow-hidden p-0">
        <div className="relative h-44 sm:h-52">
          {item.posterUrl ? (
            <Image
              src={item.posterUrl}
              alt=""
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              {item.type === 'movie' ? (
                <Film className="h-16 w-16 text-muted-foreground/40" aria-hidden />
              ) : (
                <Tv className="h-16 w-16 text-muted-foreground/40" aria-hidden />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          <DialogHeader className="absolute inset-x-0 bottom-0 space-y-2 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.enabled ? 'default' : 'secondary'}>
                {item.enabled ? t('card.enabled') : t('card.paused')}
              </Badge>
              <Badge variant="outline">{typeLabel(item.type, t)}</Badge>
              {item.rating != null && item.rating > 0 ? (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                  {item.rating.toFixed(1)}
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="text-left text-xl font-bold leading-tight sm:text-2xl">
              {item.title}
            </DialogTitle>
            {secondaryTitle ? (
              <DialogDescription className="text-left text-sm sm:text-base">
                {secondaryTitle}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(92vh-13rem)]">
          <div className="space-y-6 p-4 sm:p-6">
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card/60 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t('detail.imdb')}</p>
                <p className="mt-1 font-mono">{item.imdbId}</p>
              </div>
              <div className="rounded-lg border bg-card/60 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t('detail.yearGenre')}</p>
                <p className="mt-1">
                  {[item.year, item.genre].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="rounded-lg border bg-card/60 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t('card.releasesCount', { count: item.releasesCount })}</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {item.lastChecked
                    ? t('card.lastChecked', { date: formatDate(item.lastChecked, locale) })
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border bg-card/60 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t('detail.pinned')}</p>
                <p className="mt-1 flex items-start gap-1.5">
                  <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="line-clamp-2">
                    {item.pinnedReleaseTitle ?? t('detail.noPinned')}
                  </span>
                </p>
              </div>
            </section>

            {item.latestRelease ? (
              <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('detail.latestRelease')}
                </p>
                <p className="mt-1 font-medium leading-snug">{item.latestRelease.title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.latestRelease.quality ? <Badge variant="outline">{item.latestRelease.quality}</Badge> : null}
                  {item.latestRelease.currentEpisode != null ? (
                    <span>
                      {t('detail.episode', {
                        current: item.latestRelease.currentEpisode,
                        total: item.latestRelease.totalEpisodes ?? '?',
                      })}
                    </span>
                  ) : null}
                  {item.latestRelease.createdAt ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {formatDate(item.latestRelease.createdAt, locale)}
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section>
              <h3 className="mb-3 text-sm font-semibold">{t('detail.preferences')}</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <PrefRow label={t('preferences.quality')} value={item.preferredQuality} />
                <PrefRow label={t('preferences.audio')} value={item.preferredAudio} />
                <PrefRow
                  label={t('preferences.season')}
                  value={item.targetSeason != null ? String(item.targetSeason) : null}
                />
                <PrefRow
                  label={t('preferences.interval')}
                  value={
                    item.checkInterval != null
                      ? t('detail.intervalMinutes', { count: item.checkInterval })
                      : null
                  }
                />
                <PrefRow
                  label={t('preferences.maxReleases')}
                  value={item.maxReleasesCount != null ? String(item.maxReleasesCount) : null}
                />
                <PrefRow
                  label={t('preferences.notifyOnce')}
                  value={item.notifyOnce ? t('detail.yes') : t('detail.no')}
                />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold">{t('detail.releases')}</h3>
              {releasesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
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
                      className="rounded-lg border bg-card/50 px-3 py-2.5 text-sm transition-colors hover:bg-accent/30"
                    >
                      <p className="font-medium leading-snug">{release.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {release.quality ? <span>{release.quality}</span> : null}
                        {release.size ? <span>{release.size}</span> : null}
                        {release.seeders !== null ? (
                          <span>{t('card.seeders', { count: release.seeders })}</span>
                        ) : null}
                        {release.tracker ? <span>{release.tracker}</span> : null}
                        {release.createdAt ? (
                          <span>{formatDate(release.createdAt, locale)}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-2 border-t bg-muted/30 p-4">
          <TorrentPreferencesDialog item={item} />
          <Button
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={handleToggle}
            disabled={busy}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Power className="h-4 w-4" aria-hidden />
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-2">{t('card.remove')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrefRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value?.trim() ? value : '—'}</p>
    </div>
  );
}
