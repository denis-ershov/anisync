'use client';

import Image from 'next/image';
import type { Anime } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnimeCardProps {
  anime: Anime;
  onCardClick: (anime: Anime) => void;
}

export function AnimeCard({ anime, onCardClick }: AnimeCardProps) {
  const { t } = useTranslation('common');

  return (
    <Card
      className="overflow-hidden flex flex-col h-full cursor-pointer group transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
      onClick={() => onCardClick(anime)}
      data-ai-hint={`${anime.genres[0]} ${anime.genres[1]}`}
    >
      <CardHeader className="p-0 relative">
        <Image
          src={anime.image_url}
          alt={`Cover for ${anime.title}`}
          width={300}
          height={450}
          className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <Badge variant="secondary" className="absolute top-2 right-2">
          {anime.status}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 flex-grow flex flex-col justify-between">
        <h3 className="font-bold font-headline text-lg text-foreground group-hover:text-primary transition-colors">
          {anime.title}
        </h3>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-accent" />
          <span>{t('score')}: {anime.score.toFixed(1)}</span>
        </div>
        <span>
          {t('episodes_watched')}: {anime.episodes_watched}/{anime.episodes_total || '?'} {t('episodes_short')}
        </span>
      </CardFooter>
    </Card>
  );
}
