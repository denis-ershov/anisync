'use client';

import Image from 'next/image';
import { CheckCircle2, Clock, Eye, Film, Plus, Star, Tv } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReleaseCatalogItem, ReleaseWatchlistStatus } from '@/lib/releases/types';
import {
  formatReleaseDateLabel,
  isSeasonPremiere,
} from '@/modules/releases/utils';
import { cn } from '@/lib/utils';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const STATUS_OPTIONS: ReleaseWatchlistStatus[] = ['plan', 'watching', 'watched'];

const STATUS_ICONS = {
  plan: Clock,
  watching: Eye,
  watched: CheckCircle2,
} as const;

type ReleaseContentCardProps = {
  item: ReleaseCatalogItem;
  watchlistStatus?: ReleaseWatchlistStatus | null;
  onStatusClick?: (item: ReleaseCatalogItem) => void;
  onStatusChange?: (item: ReleaseCatalogItem, status: ReleaseWatchlistStatus) => void;
  onOpen?: (item: ReleaseCatalogItem) => void;
  className?: string;
  layout?: 'grid' | 'list';
};

export function ReleaseContentCard({
  item,
  watchlistStatus = null,
  onStatusClick,
  onStatusChange,
  onOpen,
  className,
  layout = 'grid',
}: ReleaseContentCardProps) {
  const locale = useLocale();
  const t = useTranslations('Releases');

  const title = locale === 'ru' && item.titleRu ? item.titleRu : item.title;
  const genre = locale === 'ru' && item.genreRu ? item.genreRu : item.genre;
  const posterUrl = item.posterPath ? `${TMDB_IMAGE_BASE}${item.posterPath}` : null;

  const statusLabel = watchlistStatus ? t(`status.${watchlistStatus}`) : t('status.add');
  const StatusIcon = watchlistStatus ? STATUS_ICONS[watchlistStatus] : Plus;

  const scheduleLabel = (() => {
    if (item.type === 'movie') {
      const dateLabel = formatReleaseDateLabel(item.releaseDate, locale);
      return dateLabel ? t('card.digitalRelease', { date: dateLabel }) : null;
    }

    const next = item.nextEpisode;
    if (!next?.airDate) {
      const dateLabel = formatReleaseDateLabel(item.releaseDate, locale);
      return dateLabel ? t('card.premiere', { date: dateLabel }) : null;
    }

    const dateLabel = formatReleaseDateLabel(next.airDate, locale);
    if (!dateLabel) {
      return null;
    }

    if (isSeasonPremiere(next.episode)) {
      return t('card.seasonPremiere', { season: next.season, date: dateLabel });
    }

    return t('card.nextEpisode', {
      season: next.season,
      episode: next.episode,
      date: dateLabel,
    });
  })();

  return (
    <Card
      className={cn(
        'h-full overflow-hidden border-border/70 bg-card/60',
        layout === 'list' && 'flex items-stretch',
        className
      )}
    >
      <button
        type="button"
        className={cn(
          'block w-full text-left',
          layout === 'list' && 'flex min-w-0 items-stretch',
          onOpen && 'cursor-pointer'
        )}
        onClick={() => onOpen?.(item)}
        disabled={!onOpen}
      >
        <div
          className={cn(
            'relative aspect-[2/3] w-full bg-muted',
            layout === 'list' && 'aspect-auto min-h-32 w-24 shrink-0 sm:w-28'
          )}
        >
          {posterUrl ? (
            <Image src={posterUrl} alt={title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 20vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {item.type === 'movie' ? <Film className="h-10 w-10" /> : <Tv className="h-10 w-10" />}
            </div>
          )}
          <Badge className="absolute left-2 top-2" variant="secondary">
            {item.type === 'movie' ? t('type.movie') : t('type.show')}
          </Badge>
        </div>
        <CardContent
          className={cn('space-y-3 p-3', layout === 'list' && 'flex min-w-0 flex-1 flex-col justify-center')}
        >
          <div className="space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{genre}</p>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              {item.rating && item.rating > 0 ? item.rating.toFixed(1) : '—'}
            </span>
            <span className="min-w-0 truncate text-right">{scheduleLabel ?? (item.year ?? '—')}</span>
          </div>
        </CardContent>
      </button>
      {onStatusChange ? (
        <div className={cn('px-3 pb-3', layout === 'list' && 'flex shrink-0 items-center py-3 pl-0')}>
          <div className="flex w-full gap-1" role="group" aria-label={t('filters.status')}>
            {STATUS_OPTIONS.map((status) => {
              const Icon = STATUS_ICONS[status];
              const active = watchlistStatus === status;

              return (
                <Button
                  key={status}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-11 flex-1 px-2"
                  aria-label={t(`status.${status}`)}
                  aria-pressed={active}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!active) {
                      onStatusChange(item, status);
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </div>
      ) : onStatusClick ? (
        <div className={cn('px-3 pb-3', layout === 'list' && 'flex shrink-0 items-center py-3 pl-0')}>
          <Button
            type="button"
            variant={watchlistStatus ? 'secondary' : 'default'}
            size="sm"
            className="min-h-11 w-full"
            onClick={(event) => {
              event.stopPropagation();
              onStatusClick(item);
            }}
          >
            <StatusIcon className="mr-2 h-4 w-4" />
            {statusLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
