"use client";

import Image from "next/image";
import { Clock, MoreVertical, Plus, Minus } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Anime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnimeDetailModal } from "./anime-detail-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";

interface AnimeCardProps {
  anime: Anime;
}

export function AnimeCard({ anime }: AnimeCardProps) {
  const t = useTranslations('AnimeCard');
  const locale = useLocale();
  const dateLocale = locale === 'ru' ? ru : enUS;

  const [watchedEpisodes, setWatchedEpisodes] = useState(anime.watched_episodes);
  const [isUpdating, setIsUpdating] = useState(false);

  const nextEpisodeDate = anime.next_episode_date ? parseISO(anime.next_episode_date) : null;
  const timeUntilNext = nextEpisodeDate ? formatDistanceToNow(nextEpisodeDate, { addSuffix: true, locale: dateLocale }) : null;

  // Show "?" if total episodes is unknown (0 or null)
  const totalEpisodesDisplay = anime.total_episodes > 0 ? anime.total_episodes : '?';
  const progressValue = anime.total_episodes > 0
    ? (watchedEpisodes / anime.total_episodes) * 100
    : 0;

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
      } else {
        console.error('Failed to update episodes');
      }
    } catch (error) {
      console.error('Error updating episodes:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const incrementEpisode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxEpisodes = anime.total_episodes > 0 ? anime.total_episodes : 9999;
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
      anime={{...anime, watched_episodes: watchedEpisodes}}
      onEpisodesUpdate={setWatchedEpisodes}
    >
      <Card className="group flex h-full flex-col overflow-hidden border-2 border-transparent transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/20">
        <CardHeader className="relative p-0 overflow-hidden rounded-t-lg">
          <Image
            src={anime.cover_image}
            alt={`Cover for ${anime.title_romaji}`}
            width={400}
            height={600}
            className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            data-ai-hint="anime cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
            <h3 className="font-bold text-lg leading-tight text-white line-clamp-2 font-headline drop-shadow-lg">
              {anime.title_romaji}
            </h3>
            <p className="text-sm text-white/90 line-clamp-1 drop-shadow-md">
              {anime.title_russian}
            </p>
          </div>
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/75 hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem>{t('addToWatchlist')}</DropdownMenuItem>
                <DropdownMenuItem>{t('markAsFavorite')}</DropdownMenuItem>
                <DropdownMenuItem>{t('notInterested')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-grow p-4">
          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="default" className="text-xs">
              {t(`watchStatus.${anime.watch_status}`)}
            </Badge>
            {anime.genres.slice(0, 2).map((genre) => (
              <Badge key={genre.id} variant="secondary">
                {genre.name}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
            {anime.short_description}
          </p>
        </CardContent>
        <Separator className="mx-4 w-auto"/>
        <CardFooter className="flex-col items-start gap-2 p-4">
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{watchedEpisodes} / {totalEpisodesDisplay}</span>
              {anime.user_rate_id && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={decrementEpisode}
                    disabled={isUpdating || watchedEpisodes === 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={incrementEpisode}
                    disabled={isUpdating || (anime.total_episodes > 0 && watchedEpisodes >= anime.total_episodes)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>

          {timeUntilNext && (
            <div className="flex items-center text-xs text-accent-foreground/80">
              <Clock className="mr-1.5 h-3 w-3 text-accent" />
              <span>{t('nextEp', {time: timeUntilNext})}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </AnimeDetailModal>
  );
}
