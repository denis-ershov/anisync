'use client';

import Image from 'next/image';
import type { Anime } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Star, Tv } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnimeDetailsDialogProps {
  anime: Anime | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AnimeDetailsDialog({ anime, isOpen, onOpenChange }: AnimeDetailsDialogProps) {
  const { t } = useTranslation('common');

  if (!anime) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
        <div className="md:col-span-1">
          <Image
            src={anime.image_url}
            alt={`Cover for ${anime.title}`}
            width={300}
            height={450}
            className="rounded-lg w-full h-auto object-cover shadow-lg"
             data-ai-hint={`${anime.genres[0]} ${anime.genres[1]}`}
          />
        </div>
        <div className="md:col-span-2 flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-3xl font-headline text-primary mb-2">{anime.title}</DialogTitle>
            <div className="flex flex-wrap gap-2 mb-4">
              {anime.genres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {genre}
                </Badge>
              ))}
            </div>
            <div className="flex items-center space-x-4 text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-accent" />
                <span className="font-bold text-lg text-foreground">{t('score')}: {anime.score.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Tv className="w-5 h-5" />
                <span className="font-bold text-lg text-foreground">{t('episodes_watched')}: {anime.episodes_watched} / {anime.episodes_total || '?'} {t('episodes_short')}</span>
              </div>
              <Badge>{anime.status}</Badge>
            </div>
          </DialogHeader>
          <DialogDescription className="text-base text-foreground/80 flex-grow overflow-auto pr-2">
            {t('synopsis')}: {anime.synopsis}
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
}
