"use client";

import Image from "next/image";
import {
  AlertCircle,
  Bookmark,
  CalendarDays,
  Clapperboard,
  Heart,
  NotebookText,
  Star,
  Trash2,
  Tv,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import React from "react";

import type { Anime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Slider } from "./ui/slider";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";

interface AnimeDetailModalProps {
  anime: Anime;
  children: React.ReactNode;
  onEpisodesUpdate?: (episodes: number) => void;
  onRemoved?: () => void;
}

const statusTranslationKeys: Record<string, string> = {
  ongoing: 'ongoing',
  released: 'released',
  anons: 'anons',
  completed: 'completed',
  currently_airing: 'currently_airing',
  finished_airing: 'finished_airing',
  not_yet_aired: 'not_yet_aired',
  releasing: 'currently_airing',
  finished: 'finished_airing',
  not_yet_released: 'not_yet_aired',
  cancelled: 'cancelled',
  hiatus: 'hiatus',
};

const getAnimeStatusKey = (status: string) => {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return statusTranslationKeys[normalized] || 'unknown';
};

export function AnimeDetailModal({ anime, children, onEpisodesUpdate, onRemoved }: AnimeDetailModalProps) {
  const t = useTranslations('AnimeDetailModal');
  const tAnimeCard = useTranslations('AnimeCard');
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = React.useState(Boolean(anime.isFavorite));
  const [watchStatus, setWatchStatus] = React.useState<string>(anime.watchStatus);
  const [personalRating, setPersonalRating] = React.useState([anime.personalRating || 0]);
  const [watchedEpisodes, setWatchedEpisodes] = React.useState(anime.watchedEpisodes);
  const [notes, setNotes] = React.useState(anime.userNotes || '');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [outOfSync, setOutOfSync] = React.useState(Boolean(anime.outOfSync));
  const [syncState, setSyncState] = React.useState(anime.syncState || (anime.outOfSync ? 'failed' : 'synced'));
  const [open, setOpen] = React.useState(false);
  const primaryTitle = anime.titleRussian || anime.titleRomaji;
  const secondaryTitle = anime.titleRomaji && anime.titleRomaji !== primaryTitle ? anime.titleRomaji : null;
  const animeStatusKey = getAnimeStatusKey(anime.status);

  // Use lowercase with underscores to match API values from Shikimori
  const statuses = ['watching', 'planned', 'completed', 'on_hold', 'dropped', 'rewatching'];
  const syncBadgeLabel =
    syncState === 'pending' || syncState === 'processing'
      ? tAnimeCard('syncPending')
      : syncState === 'failed'
        ? tAnimeCard('syncFailed')
        : syncState === 'local_only'
          ? tAnimeCard('syncLocalOnly')
          : null;

  React.useEffect(() => {
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
          setWatchStatus(result.entry.watch_status);
          setPersonalRating([result.entry.personal_rating || 0]);
          setNotes(result.entry.user_notes || '');
          setIsFavorite(Boolean(result.entry.is_favorite));
          setOutOfSync(Boolean(result.entry.out_of_sync));
          setSyncState(result.entry.sync_state || 'synced');
          onEpisodesUpdate?.(result.entry.watched_episodes);
        }
      } catch {
        // Best-effort polling; leave last known state.
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [anime.userRateId, onEpisodesUpdate, syncState]);

  const patchEntry = async (payload: Record<string, unknown>) => {
    if (!anime.userRateId || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/library/${anime.userRateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.entry) {
          setWatchedEpisodes(result.entry.watched_episodes);
          setWatchStatus(result.entry.watch_status);
          setPersonalRating([result.entry.personal_rating || 0]);
          setNotes(result.entry.user_notes || '');
          setIsFavorite(Boolean(result.entry.is_favorite));
          setOutOfSync(Boolean(result.entry.out_of_sync));
          setSyncState(result.entry.sync_state || 'pending');
          onEpisodesUpdate?.(result.entry.watched_episodes);
        }
      } else {
        throw new Error('Failed to update entry');
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

  const updateEpisodes = async (newValue: number) => {
    await patchEntry({ watchedEpisodes: newValue });
  };

  const incrementEpisode = () => {
    const maxEpisodes = anime.totalEpisodes > 0 ? anime.totalEpisodes : 9999;
    if (watchedEpisodes < maxEpisodes) {
      updateEpisodes(watchedEpisodes + 1);
    }
  };

  const decrementEpisode = () => {
    if (watchedEpisodes > 0) {
      updateEpisodes(watchedEpisodes - 1);
    }
  };

  const updateStatus = async (newStatus: string) => {
    await patchEntry({ watchStatus: newStatus });
  };

  const handleStatusChange = (newStatus: string) => {
    setWatchStatus(newStatus);
    updateStatus(newStatus);
  };

  const handleFavoriteToggle = async () => {
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    await patchEntry({ isFavorite: nextValue });
  };

  const handleRatingCommit = async (value: number[]) => {
    setPersonalRating(value);
    await patchEntry({ personalRating: value[0] });
  };

  const handleNotesBlur = async () => {
    await patchEntry({ notes });
  };

  const retrySync = async () => {
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
      if (result.entry) {
        setOutOfSync(Boolean(result.entry.out_of_sync));
        setSyncState(result.entry.sync_state || 'pending');
      }

      toast({
        title: tAnimeCard('syncQueued'),
        description: tAnimeCard('syncQueuedDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tAnimeCard('syncRetryError'),
        description: error instanceof Error ? error.message : tAnimeCard('syncRetryError'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const removeFromList = async () => {
    if (!anime.userRateId || isUpdating) return;
    if (!window.confirm(tAnimeCard('removeFromListConfirm'))) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/library/${anime.userRateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove entry');
      }

      toast({
        title: tAnimeCard('removeSuccess'),
      });
      setOpen(false);
      onRemoved?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tAnimeCard('removeError'),
        description: error instanceof Error ? error.message : tAnimeCard('removeError'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="relative h-64 md:h-80 overflow-hidden rounded-t-lg p-0">
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src={anime.coverImage}
              alt={`Cover for ${primaryTitle}`}
              fill
              className="object-cover object-top"
              data-ai-hint="anime landscape"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          <div className="relative z-0 flex h-full flex-col justify-end p-6 pointer-events-none">
            <DialogTitle className="text-3xl font-bold font-headline text-foreground">
              {primaryTitle}
            </DialogTitle>
            {secondaryTitle && (
              <DialogDescription className="text-lg text-muted-foreground">
                {secondaryTitle}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-h-[70vh] overflow-y-auto">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 font-headline">{t('synopsis')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {anime.fullSynopsis}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {anime.genres.map((genre) => (
                <Badge key={genre.id} variant="outline">
                  {genre.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-4">
              <div className="flex items-center">
                <Bookmark className="h-4 w-4 mr-3 text-primary" />
                <Select value={watchStatus} onValueChange={handleStatusChange} disabled={isUpdating}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('setStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status} value={status}>{tAnimeCard(`watchStatus.${status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="ml-2" onClick={handleFavoriteToggle}>
                  <Heart className={`h-5 w-5 ${isFavorite ? 'text-red-500 fill-current' : 'text-muted-foreground'}`} />
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                {syncBadgeLabel && (
                  <div className="flex items-center gap-2 rounded-md border border-dashed p-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <span className="flex-1">{syncBadgeLabel}</span>
                    {outOfSync && (
                      <Button variant="outline" size="sm" onClick={retrySync} disabled={isUpdating}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {tAnimeCard('retrySync')}
                      </Button>
                    )}
                  </div>
                )}
                 <div className="flex items-center text-sm">
                  <Star className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('rating')}:</span>
                  <span className="font-semibold">{anime.rating} / 10</span>
                </div>
                <div className="flex items-center text-sm">
                  <Tv className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('status')}:</span>
                  <Badge variant={animeStatusKey === 'ongoing' || animeStatusKey === 'currently_airing' ? 'default' : 'secondary'}>
                    {t(animeStatusKey)}
                  </Badge>
                </div>
                 <div className="flex items-center text-sm">
                  <Clapperboard className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('studio')}:</span>
                  <span className="font-semibold">{anime.studio.name}</span>
                </div>
                <div className="flex items-center text-sm">
                  <CalendarDays className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('year')}:</span>
                  <span className="font-semibold">{anime.releaseYear}</span>
                </div>
              </div>
            </div>
            
             <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-4">
                <h4 className="font-semibold flex items-center">
                    <Star className="h-4 w-4 mr-2 text-primary"/> {t('yourRating')}: <span className="ml-auto font-bold">{personalRating[0]}/10</span>
                </h4>
                <Slider value={personalRating} max={10} step={1} onValueChange={setPersonalRating} onValueCommit={handleRatingCommit}/>
             </div>

            {anime.userRateId && (
              <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
                <h4 className="font-semibold flex items-center justify-between">
                  <span className="flex items-center">
                    <Tv className="h-4 w-4 mr-2 text-primary"/> {t('episodes')}
                  </span>
                  <span className="font-bold">{watchedEpisodes} / {anime.totalEpisodes > 0 ? anime.totalEpisodes : '?'}</span>
                </h4>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementEpisode}
                    disabled={isUpdating || watchedEpisodes === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-2xl font-bold min-w-[60px] text-center">
                    {watchedEpisodes}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementEpisode}
                    disabled={isUpdating || (anime.totalEpisodes > 0 && watchedEpisodes >= anime.totalEpisodes)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-2">
                <h4 className="font-semibold flex items-center">
                    <NotebookText className="h-4 w-4 mr-2 text-primary"/> {t('notes')}
                </h4>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={handleNotesBlur}
                  className="min-h-[100px]"
                />
            </div>

            {anime.userRateId && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={removeFromList}
                disabled={isUpdating}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tAnimeCard('removeFromList')}
              </Button>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
