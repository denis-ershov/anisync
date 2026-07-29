import { formatReleaseDateLabel, isSeasonPremiere } from '@/modules/releases/utils';

import type { TorrentWatchlistItem } from './types';

type TorrentScheduleTranslator = (
  key: 'card.digitalRelease' | 'card.seasonPremiere' | 'card.nextEpisode',
  values?: Record<string, string | number>
) => string;

export function getTorrentScheduleLine(
  item: TorrentWatchlistItem,
  locale: string,
  t: TorrentScheduleTranslator
): string | null {
  if (item.type === 'movie' && item.digitalReleaseDate) {
    const date = formatReleaseDateLabel(item.digitalReleaseDate, locale);
    return date ? t('card.digitalRelease', { date }) : null;
  }

  if (
    item.type === 'tv' &&
    item.nextEpisodeDate &&
    item.nextEpisodeSeason != null &&
    item.nextEpisodeNumber != null
  ) {
    const date = formatReleaseDateLabel(item.nextEpisodeDate, locale);
    if (!date) {
      return null;
    }

    if (isSeasonPremiere(item.nextEpisodeNumber)) {
      return t('card.seasonPremiere', { season: item.nextEpisodeSeason, date });
    }

    return t('card.nextEpisode', {
      season: item.nextEpisodeSeason,
      episode: item.nextEpisodeNumber,
      date,
    });
  }

  return null;
}

export function getTorrentScheduleDetail(
  item: TorrentWatchlistItem,
  locale: string
): {
  titleKey: 'detail.digitalRelease' | 'detail.seasonPremiere' | 'detail.nextEpisode';
  line: string | null;
} | null {
  if (item.type === 'movie' && item.digitalReleaseDate) {
    const date = formatReleaseDateLabel(item.digitalReleaseDate, locale);
    return date ? { titleKey: 'detail.digitalRelease', line: date } : null;
  }

  if (
    item.type === 'tv' &&
    item.nextEpisodeDate &&
    item.nextEpisodeSeason != null &&
    item.nextEpisodeNumber != null
  ) {
    const date = formatReleaseDateLabel(item.nextEpisodeDate, locale);
    if (!date) {
      return null;
    }

    if (isSeasonPremiere(item.nextEpisodeNumber)) {
      return {
        titleKey: 'detail.seasonPremiere',
        line: `S${item.nextEpisodeSeason} · ${date}`,
      };
    }

    return {
      titleKey: 'detail.nextEpisode',
      line: `S${item.nextEpisodeSeason} · E${item.nextEpisodeNumber} · ${date}`,
    };
  }

  return null;
}
