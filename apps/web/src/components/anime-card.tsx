"use client";

import Image from "next/image";
import { Clock, MoreVertical, Plus, Minus, RotateCcw, Star, Trash2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

import type { Anime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnimeDetailModal } from "./anime-detail-modal";
import { ProviderServiceLinks, ServiceSourceBadge } from "@/components/provider-service-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";

interface AnimeCardProps {
  anime: Anime;
  onRemoved?: () => void;
}

export function AnimeCard({ anime, onRemoved }: AnimeCardProps) {
  const t = useTranslations('AnimeCard');
  const locale = useLocale();
  const dateLocale = locale === 'ru' ? ru : enUS;
  const { toast } = useToast();

  const [watchedEpisodes, setWatchedEpisodes] = useState(anime.watchedEpisodes);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFavorite, setIsFavorite] = useState(Boolean(anime.isFavorite));
  const [isNotInterested, setIsNotInterested] = useState(Boolean(anime.isNotInterested));
  const [outOfSync, setOutOfSync] = useState(Boolean(anime.outOfSync));
  const [syncState, setSyncState] = useState(anime.syncState || (anime.outOfSync ? 'failed' : 'synced'));
  const primaryTitle = anime.titleRussian || anime.titleRomaji;
  const secondaryTitle = anime.titleRomaji && anime.titleRomaji !== primaryTitle ? anime.titleRomaji : null;

  const nextEpisodeDate = anime.nextEpisodeDate ? parseISO(anime.nextEpisodeDate) : null;
  const timeUntilNext = nextEpisodeDate ? formatDistanceToNow(nextEpisodeDate, { addSuffix: true, locale: dateLocale }) : null;

  // Show "?" if total episodes is unknown (0 or null)
  const totalEpisodesDisplay = anime.totalEpisodes > 0 ? anime.totalEpisodes : '?';
  const progressValue = anime.totalEpisodes > 0
    ? (watchedEpisodes / anime.totalEpisodes) * 100
    : 0;
  const watchStatusLabel =
    anime.watchStatus === 'not_interested' ? t('notInterested') : t(`watchStatus.${anime.watchStatus}`);
  const syncBadgeLabel =
    syncState === 'pending' || syncState === 'processing'
      ? t('syncPending')
      : syncState === 'failed'
        ? t('syncFailed')
        : syncState === 'local_only'
          ? t('syncLocalOnly')
          : null;
  const showPrimaryUnavailable =
    anime.sourceService &&
    anime.sourceService !== 'shikimori' &&
    Boolean(anime.serviceLinks?.some((link) => link.service === 'shikimori'));

  useEffect(() => {
    if (!anime.userRateId || (syncState !== 'pending' && syncState !== 'processing')) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/user/library/${anime.userRateId}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (result.entry) {
          setWatchedEpisodes(result.entry.watched_episodes);
          setOutOfSync(Boolean(result.entry.out_of_sync));
          setSyncState(result.entry.sync_state || 'synced');
        }
      } catch {
        // Best-effort polling; leave last known state.
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [anime.userRateId, syncState]);

  const updateEpisodes = async (newValue: number) => {
    if (!anime.userRateId || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/library/${anime.userRateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ watchedEpisodes: newValue }),
      });

      if (response.ok) {
        const result = await response.json();
        setWatchedEpisodes(result.entry?.watched_episodes ?? newValue);
        setOutOfSync(Boolean(result.entry?.out_of_sync));
        setSyncState(result.entry?.sync_state || 'pending');
      } else {
        throw new Error('Failed to update episodes');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const patchEntry = async (payload: Record<string, unknown>) => {
    if (!anime.userRateId) return;

    const response = await fetch(`/api/user/library/${anime.userRateId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to update entry');
    }

    const result = await response.json();
    setOutOfSync(Boolean(result.entry?.out_of_sync));
    setSyncState(result.entry?.sync_state || 'pending');
    return result;
  };

  const removeFromList = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!anime.userRateId || isUpdating) return;
    if (!window.confirm(t('removeFromListConfirm'))) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/library/${anime.userRateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove entry');
      }

      toast({
        title: t('removeSuccess'),
      });
      onRemoved?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('removeError'),
        description: error instanceof Error ? error.message : t('removeError'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const retrySync = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!anime.userRateId || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/library/${anime.userRateId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry sync');
      }

      const result = await response.json();
      setOutOfSync(Boolean(result.entry?.out_of_sync));
      setSyncState(result.entry?.sync_state || 'pending');
      toast({
        title: t('syncQueued'),
        description: t('syncQueuedDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('syncRetryError'),
        description: error instanceof Error ? error.message : t('syncRetryError'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const incrementEpisode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxEpisodes = anime.totalEpisodes > 0 ? anime.totalEpisodes : 9999;
    if (watchedEpisodes < maxEpisodes) {
      updateEpisodes(watchedEpisodes + 1);
    }
  };

  const decrementEpisode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watchedEpisodes > 0) {
      updateEpisodes(watchedEpisodes - 1);
    }
  };

  return (
    <AnimeDetailModal
      anime={{...anime, watchedEpisodes: watchedEpisodes}}
      onEpisodesUpdate={setWatchedEpisodes}
      onRemoved={onRemoved}
    >
      <Card className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border/60 transition-colors duration-200 hover:border-primary sm:border-2 sm:border-transparent sm:transition-all sm:duration-300 sm:hover:shadow-lg sm:hover:shadow-primary/20">
        <CardHeader className="relative overflow-hidden rounded-t-lg p-0">
          <Image
            src={anime.coverImage}
            alt={`Cover for ${primaryTitle}`}
            width={400}
            height={600}
            className="aspect-[2/3] w-full object-cover transition-transform duration-300 md:group-hover:scale-105"
            data-ai-hint="anime cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-4">
            <h3 className="font-headline text-sm font-bold leading-tight text-white line-clamp-2 drop-shadow-lg sm:text-lg">
              {primaryTitle}
            </h3>
            {secondaryTitle && (
              <p className="hidden text-sm text-white/90 line-clamp-1 drop-shadow-md sm:block">
                {secondaryTitle}
              </p>
            )}
          </div>
          {/* Rating + source - Left side */}
          <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1 sm:left-2 sm:top-2 sm:gap-1.5">
            {anime.rating > 0 && (
              <div className="flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm sm:gap-1 sm:px-2.5 sm:py-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 sm:h-3.5 sm:w-3.5" />
                <span className="text-[11px] font-semibold text-white sm:text-sm">{anime.rating.toFixed(1)}</span>
              </div>
            )}
            <ServiceSourceBadge service={anime.sourceService} className="text-[9px] bg-black/60 text-white backdrop-blur-sm border-0 sm:text-[10px]" />
          </div>
          {/* Menu - Right side */}
          <div className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('moreActions')}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors duration-200 hover:bg-black/75 hover:text-white sm:h-auto sm:w-auto sm:p-1.5"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => patchEntry({ watchStatus: 'planned' })}>{t('addToWatchlist')}</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const nextValue = !isFavorite;
                    setIsFavorite(nextValue);
                    await patchEntry({ isFavorite: nextValue });
                  }}
                >
                  {t('markAsFavorite')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const nextValue = !isNotInterested;
                    setIsNotInterested(nextValue);
                    await patchEntry({ isNotInterested: nextValue, watchStatus: nextValue ? 'not_interested' : anime.watchStatus });
                  }}
                >
                  {t('notInterested')}
                </DropdownMenuItem>
                {outOfSync && syncState !== 'pending' && syncState !== 'processing' && (
                  <DropdownMenuItem onClick={retrySync}>
                    {t('retrySync')}
                  </DropdownMenuItem>
                )}
                {anime.userRateId && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={removeFromList}
                    disabled={isUpdating}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('removeFromList')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 p-2 sm:space-y-0 sm:p-4">
          <div className="mb-0 flex flex-wrap gap-1 sm:mb-2">
            <Badge variant="default" className="text-[10px] sm:text-xs">
              {watchStatusLabel}
            </Badge>
            {anime.genres.slice(0, 2).map((genre) => (
              <Badge key={genre.id} variant="secondary" className="hidden text-xs sm:inline-flex">
                {genre.name}
              </Badge>
            ))}
            {syncBadgeLabel && (
              <Badge variant={syncState === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">
                {syncBadgeLabel}
              </Badge>
            )}
            {showPrimaryUnavailable && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                {t('primaryUnavailable')}
              </Badge>
            )}
          </div>
          {anime.serviceLinks && anime.serviceLinks.length > 0 && (
            <div className="mb-0 sm:mb-2">
              <ProviderServiceLinks links={anime.serviceLinks} compact />
            </div>
          )}
          <p className="mt-0 hidden text-sm text-muted-foreground line-clamp-3 sm:mt-3 sm:block">
            {anime.shortDescription}
          </p>
        </CardContent>
        <Separator className="mx-2 w-auto sm:mx-4"/>
        <CardFooter className="flex-col items-start gap-1.5 p-2 sm:gap-2 sm:p-4">
          <div className="w-full space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium sm:text-sm">{watchedEpisodes} / {totalEpisodesDisplay}</span>
              {anime.userRateId && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 cursor-pointer sm:h-6 sm:w-6"
                    onClick={decrementEpisode}
                    disabled={isUpdating || watchedEpisodes === 0}
                    aria-label={t('decrementEpisode')}
                  >
                    <Minus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 cursor-pointer sm:h-6 sm:w-6"
                    onClick={incrementEpisode}
                    disabled={isUpdating || (anime.totalEpisodes > 0 && watchedEpisodes >= anime.totalEpisodes)}
                    aria-label={t('incrementEpisode')}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>

          {timeUntilNext && (
            <div className="flex items-center text-[11px] text-accent-foreground/80 sm:text-xs">
              <Clock className="mr-1 h-3 w-3 shrink-0 text-accent sm:mr-1.5" />
              <span className="line-clamp-1">{t('nextEp', {time: timeUntilNext})}</span>
            </div>
          )}
          {outOfSync && syncState !== 'pending' && syncState !== 'processing' && (
            <Button variant="outline" size="sm" onClick={retrySync} disabled={isUpdating} className="mt-0.5 min-h-9 w-full cursor-pointer sm:mt-1 sm:w-auto">
              <RotateCcw className="mr-1.5 h-3 w-3" />
              {t('retrySync')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </AnimeDetailModal>
  );
}
