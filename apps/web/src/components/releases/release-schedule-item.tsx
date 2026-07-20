'use client';

import Image from 'next/image';
import { Film, Star, Tv } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useReleasesModule } from '@/components/releases/releases-module-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReleaseWatchlistItem } from '@/lib/releases/types';
import { formatFullDate, scheduleDateOf, watchlistItemToCatalogItem } from '@/lib/releases/utils';
import { cn } from '@/lib/utils';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w154';

type ReleaseScheduleItemProps = {
  item: ReleaseWatchlistItem;
  dateKey: string;
  className?: string;
};

export function ReleaseScheduleItem({ item, dateKey, className }: ReleaseScheduleItemProps) {
  const locale = useLocale();
  const t = useTranslations('Releases');
  const { openDetail } = useReleasesModule();

  const title = locale === 'ru' && item.titleRu ? item.titleRu : item.title;
  const posterUrl = item.posterPath ? `${TMDB_IMAGE_BASE}${item.posterPath}` : null;
  const scheduleDate = scheduleDateOf(item);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'h-auto w-full justify-start gap-3 rounded-xl border bg-card/60 px-3 py-3 text-left hover:bg-muted/60',
        className
      )}
      onClick={() => openDetail(watchlistItemToCatalogItem(item))}
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {posterUrl ? (
          <Image src={posterUrl} alt={title} fill className="object-cover" sizes="48px" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {item.type === 'movie' ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{title}</p>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {item.status === 'watching' ? t('status.watching') : t('status.plan')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {item.type === 'show' && item.nextEpisodeSeason && item.nextEpisodeNumber
            ? t('dashboard.episode', {
                season: item.nextEpisodeSeason,
                episode: item.nextEpisodeNumber,
              })
            : t('dashboard.releaseOn', { date: scheduleDate ? formatFullDate(scheduleDate, locale) : dateKey })}
        </p>
        {item.rating ? (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            {item.rating.toFixed(1)}
          </p>
        ) : null}
      </div>
    </Button>
  );
}
