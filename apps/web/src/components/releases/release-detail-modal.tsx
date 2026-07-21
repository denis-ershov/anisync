'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Clock, CheckCircle2, ExternalLink, Eye, Film, Loader2, Star, Trash2, Tv, Waves } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useReleasesModule } from '@/components/releases/releases-module-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { isClientFeatureEnabled } from '@/lib/feature-flags';
import {
  useAddToReleaseWatchlist,
  useDeleteReleaseWatchlistItem,
  useReleaseContentDetail,
  useReleaseWatchlist,
  useUpdateReleaseWatchlistItem,
} from '@/lib/releases/hooks';
import type { ReleaseWatchlistStatus } from '@/lib/releases/types';
import { useAddTorrentWatchlistItem, useTorrentWatchlist } from '@/lib/torrents/hooks';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function formatDuration(minutes: string | null | undefined, t: (key: string, values?: Record<string, string | number>) => string) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return t('detail.minutes', { count: value });
}

export function ReleaseDetailModal() {
  const locale = useLocale();
  const t = useTranslations('Releases');
  const { toast } = useToast();
  const lang = locale === 'ru' ? 'ru' : 'en';
  const { selectedItem, closeDetail } = useReleasesModule();

  const open = Boolean(selectedItem);
  const tmdbId = selectedItem?.tmdbId ?? null;
  const contentType = selectedItem?.type ?? null;

  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useReleaseContentDetail(tmdbId, contentType, lang);
  const { data: watchlist = [] } = useReleaseWatchlist(lang);

  const addMutation = useAddToReleaseWatchlist();
  const updateMutation = useUpdateReleaseWatchlistItem();
  const deleteMutation = useDeleteReleaseWatchlistItem();
  const addTorrentMutation = useAddTorrentWatchlistItem();
  const { data: torrentWatchlist = [] } = useTorrentWatchlist();

  const actionLoading = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const watchlistItem = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    return watchlist.find((entry) => entry.tmdbId === selectedItem.tmdbId && entry.type === selectedItem.type) ?? null;
  }, [selectedItem, watchlist]);

  useEffect(() => {
    if (!detailError || !selectedItem) {
      return;
    }

    toast({
      variant: 'destructive',
      title: t('detail.loadFailed'),
      description: detailError instanceof Error ? detailError.message : undefined,
    });
    closeDetail();
  }, [closeDetail, detailError, selectedItem, t, toast]);

  const display = detail ?? selectedItem;
  const imdbId = detail?.imdbId ?? null;
  const torrentsEnabled = isClientFeatureEnabled('torrents');
  const torrentWatchlistItem = useMemo(() => {
    if (!imdbId) {
      return null;
    }
    return torrentWatchlist.find((entry) => entry.imdbId === imdbId) ?? null;
  }, [imdbId, torrentWatchlist]);

  const title = useMemo(() => {
    if (!display) {
      return '';
    }
    return locale === 'ru' && display.titleRu ? display.titleRu : display.title;
  }, [display, locale]);

  const overview = useMemo(() => {
    if (!display) {
      return null;
    }
    if (locale === 'ru' && detail?.overviewRu) {
      return detail.overviewRu;
    }
    return detail?.overview ?? display.overview ?? null;
  }, [detail, display, locale]);

  const genre = useMemo(() => {
    if (!display) {
      return null;
    }
    return locale === 'ru' && display.genreRu ? display.genreRu : display.genre;
  }, [display, locale]);

  const posterUrl = display?.posterPath ? `${TMDB_IMAGE_BASE}${display.posterPath}` : null;
  const durationLabel = formatDuration(detail?.duration, t);

  const handleStatus = async (status: ReleaseWatchlistStatus) => {
    if (!display) {
      return;
    }

    try {
      if (watchlistItem) {
        await updateMutation.mutateAsync({ id: watchlistItem.id, status });
      } else {
        await addMutation.mutateAsync({
          tmdbId: display.tmdbId,
          type: display.type,
          status,
          title: display.title,
          titleRu: display.titleRu,
          rating: display.rating,
          popularity: display.popularity,
          posterPath: display.posterPath,
          genre: display.genre,
          genreRu: display.genreRu,
          year: display.year,
          releaseDate: display.releaseDate,
        });
      }

      toast({ title: t('detail.statusUpdated') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.watchlistFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleRemove = async () => {
    if (!watchlistItem) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(watchlistItem.id);
      toast({ title: t('detail.removed') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.watchlistFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleWatchTorrent = async () => {
    if (!display || !imdbId) {
      return;
    }

    try {
      await addTorrentMutation.mutateAsync({ imdbId, input: display.title });
      toast({ title: t('detail.torrentsAdded') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.torrentsFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeDetail()}>
      <DialogContent className="max-h-[90vh] w-[min(100vw-1rem,48rem)] overflow-hidden p-0">
        {display ? (
          <ScrollArea className="max-h-[90vh]">
            <div className="relative h-44 w-full bg-muted sm:h-56">
              {posterUrl ? (
                <Image src={posterUrl} alt={title} fill className="object-cover object-top" sizes="768px" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  {display.type === 'movie' ? <Film className="h-12 w-12" /> : <Tv className="h-12 w-12" />}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {display.type === 'movie' ? t('type.movie') : t('type.show')}
                  </Badge>
                  {watchlistItem ? (
                    <Badge variant="outline">{t(`status.${watchlistItem.status}`)}</Badge>
                  ) : null}
                </div>
                <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400" />
                    {display.rating?.toFixed(1) ?? '—'}
                  </span>
                  {display.year ? <span>{display.year}</span> : null}
                  {genre ? <span>{genre}</span> : null}
                  {durationLabel ? <span>{durationLabel}</span> : null}
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('detail.loading')}
                </div>
              ) : (
                <>
                  {display.nextEpisode ? (
                    <div className="rounded-xl border bg-card/60 px-4 py-3 text-sm">
                      <p className="font-medium">{t('detail.nextEpisode')}</p>
                      <p className="text-muted-foreground">
                        {t('dashboard.episode', {
                          season: display.nextEpisode.season,
                          episode: display.nextEpisode.episode,
                        })}
                        {display.nextEpisode.airDate
                          ? ` · ${display.nextEpisode.airDate}`
                          : null}
                      </p>
                    </div>
                  ) : null}

                  {overview ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">{t('detail.overview')}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{overview}</p>
                    </div>
                  ) : null}

                  {detail?.cast && detail.cast.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">{t('detail.cast')}</h3>
                      <p className="text-sm text-muted-foreground">{detail.cast.join(', ')}</p>
                    </div>
                  ) : null}

                  {detail?.trailerKey ? (
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <a
                        href={`https://www.youtube.com/watch?v=${detail.trailerKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('detail.trailer')}
                      </a>
                    </Button>
                  ) : null}
                </>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!torrentsEnabled ? null : (
                  <Button
                    type="button"
                    variant={torrentWatchlistItem ? 'secondary' : 'outline'}
                    disabled={!imdbId || addTorrentMutation.isPending || detailLoading}
                    onClick={() => void handleWatchTorrent()}
                    className="min-h-11"
                  >
                    {addTorrentMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Waves className="mr-2 h-4 w-4" />
                    )}
                    {torrentWatchlistItem ? t('detail.torrentsAlreadyWatching') : t('detail.torrentsWatch')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={watchlistItem?.status === 'plan' ? 'default' : 'outline'}
                  disabled={actionLoading || detailLoading}
                  onClick={() => void handleStatus('plan')}
                  className="min-h-11"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {t('status.plan')}
                </Button>
                <Button
                  type="button"
                  variant={watchlistItem?.status === 'watching' ? 'default' : 'outline'}
                  disabled={actionLoading || detailLoading}
                  onClick={() => void handleStatus('watching')}
                  className="min-h-11"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {t('status.watching')}
                </Button>
                <Button
                  type="button"
                  variant={watchlistItem?.status === 'watched' ? 'default' : 'outline'}
                  disabled={actionLoading || detailLoading}
                  onClick={() => void handleStatus('watched')}
                  className="min-h-11"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('status.watched')}
                </Button>
                {!watchlistItem ? null : (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={actionLoading || detailLoading}
                    onClick={() => void handleRemove()}
                    className="min-h-11 sm:ml-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('detail.remove')}
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
