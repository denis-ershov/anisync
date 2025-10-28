"use client";

import Image from "next/image";
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  Heart,
  NotebookText,
  Star,
  Tv,
  Plus,
  Minus,
} from "lucide-react";
import React from "react";

import type { Anime, Status } from "@/lib/types";
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

interface AnimeDetailModalProps {
  anime: Anime;
  children: React.ReactNode;
  onEpisodesUpdate?: (episodes: number) => void;
}

export function AnimeDetailModal({ anime, children, onEpisodesUpdate }: AnimeDetailModalProps) {
  const t = useTranslations('AnimeDetailModal');
  const tAnimeCard = useTranslations('AnimeCard');
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [watchStatus, setWatchStatus] = React.useState<string>(anime.watch_status);
  const [personalRating, setPersonalRating] = React.useState([anime.personal_rating || 0]);
  const [watchedEpisodes, setWatchedEpisodes] = React.useState(anime.watched_episodes);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Use lowercase with underscores to match API values from Shikimori
  const statuses = ['watching', 'planned', 'completed', 'on_hold', 'dropped', 'rewatching'];

  const updateEpisodes = async (newValue: number) => {
    if (!anime.user_rate_id || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/anime/${anime.user_rate_id}/episodes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ episodes: newValue }),
      });

      if (response.ok) {
        setWatchedEpisodes(newValue);
        onEpisodesUpdate?.(newValue);
      } else {
        console.error('Failed to update episodes');
      }
    } catch (error) {
      console.error('Error updating episodes:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const incrementEpisode = () => {
    const maxEpisodes = anime.total_episodes > 0 ? anime.total_episodes : 9999;
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
    if (!anime.user_rate_id || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/user/anime/${anime.user_rate_id}/episodes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setWatchStatus(newStatus);
      } else {
        console.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setWatchStatus(newStatus);
    updateStatus(newStatus);
  };

  return (
    <Dialog>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl p-0" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="relative h-64 md:h-80 overflow-hidden rounded-t-lg p-0">
          <div className="absolute inset-0">
            <Image
              src={anime.cover_image}
              alt={`Cover for ${anime.title_romaji}`}
              fill
              className="object-cover object-top"
              data-ai-hint="anime landscape"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          <div className="relative z-10 flex h-full flex-col justify-end p-6">
            <DialogTitle className="text-3xl font-bold font-headline text-foreground">
              {anime.title_romaji}
            </DialogTitle>
            <DialogDescription className="text-lg text-muted-foreground">
              {anime.title_russian}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-h-[70vh] overflow-y-auto">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 font-headline">{t('synopsis')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {anime.full_synopsis}
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
                <Button variant="ghost" size="icon" className="ml-2" onClick={() => setIsFavorite(!isFavorite)}>
                  <Heart className={`h-5 w-5 ${isFavorite ? 'text-red-500 fill-current' : 'text-muted-foreground'}`} />
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                 <div className="flex items-center text-sm">
                  <Star className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('rating')}:</span>
                  <span className="font-semibold">{anime.rating} / 10</span>
                </div>
                <div className="flex items-center text-sm">
                  <Tv className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('status')}:</span>
                  <Badge variant={anime.status === 'Ongoing' ? 'default' : 'secondary'}>{t(anime.status.toLowerCase() as 'ongoing' | 'completed')}</Badge>
                </div>
                 <div className="flex items-center text-sm">
                  <Clapperboard className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('studio')}:</span>
                  <span className="font-semibold">{anime.studio.name}</span>
                </div>
                <div className="flex items-center text-sm">
                  <CalendarDays className="h-4 w-4 mr-3 text-primary" />
                  <span className="text-muted-foreground flex-1">{t('year')}:</span>
                  <span className="font-semibold">{anime.release_year}</span>
                </div>
              </div>
            </div>
            
             <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-4">
                <h4 className="font-semibold flex items-center">
                    <Star className="h-4 w-4 mr-2 text-primary"/> {t('yourRating')}: <span className="ml-auto font-bold">{personalRating[0]}/10</span>
                </h4>
                <Slider defaultValue={[0]} value={personalRating} max={10} step={1} onValueChange={setPersonalRating}/>
             </div>

            {anime.user_rate_id && (
              <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
                <h4 className="font-semibold flex items-center justify-between">
                  <span className="flex items-center">
                    <Tv className="h-4 w-4 mr-2 text-primary"/> {t('episodes')}
                  </span>
                  <span className="font-bold">{watchedEpisodes} / {anime.total_episodes > 0 ? anime.total_episodes : '?'}</span>
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
                    disabled={isUpdating || (anime.total_episodes > 0 && watchedEpisodes >= anime.total_episodes)}
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
                <Textarea placeholder={t('notesPlaceholder')} defaultValue={anime.user_notes} className="min-h-[100px]"/>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
