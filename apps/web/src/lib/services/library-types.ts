import type { IntegrationServiceName } from '@/lib/integrations/provider-types';
import type { ProviderServiceLink } from '@/lib/integrations/provider-links';

export interface LibraryFilters {
  search?: string;
  status?: string;
  /** Несколько статусов (OR). Если задано вместе с status — оба учитываются. */
  statuses?: string[];
  studio?: string;
  minRating?: number;
  maxRating?: number;
  minYear?: number;
  maxYear?: number;
  minEpisodes?: number;
  maxEpisodes?: number;
  genres?: string[];
  types?: string[];
}

export interface LibraryEntryView {
  id: number;
  animeId: number;
  sourceService: IntegrationServiceName;
  sourceEntryId: string | null;
  externalAnimeId: string | null;
  malId: number | null;
  title: string;
  title_en?: string | null;
  title_jp?: string | null;
  license_name_ru?: string | null;
  synonyms: string[];
  kind?: string | null;
  rating?: string | null;
  score: number;
  status?: string | null;
  episodes: number;
  episodes_aired: number;
  duration?: number | null;
  aired_on?: string | null;
  released_on?: string | null;
  season?: string | null;
  url?: string | null;
  cover_image: string;
  next_episode_date: string | null;
  is_censored: boolean;
  genres: Array<{ id: string; name: string; kind?: string }>;
  studios: Array<{ id: string; name: string; image?: string }>;
  description: string;
  description_html?: string | null;
  watched_episodes: number;
  watch_status: string;
  personal_rating: number | null;
  user_rate_id: string;
  source: IntegrationServiceName;
  serviceLinks: ProviderServiceLink[];
  user_notes: string;
  is_favorite: boolean;
  is_not_interested: boolean;
  out_of_sync: boolean;
  sync_state: 'pending' | 'processing' | 'synced' | 'failed' | 'local_only';
}
