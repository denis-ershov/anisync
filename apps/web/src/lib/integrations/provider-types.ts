import type { UserIntegration } from '@/lib/db/schema';

export type IntegrationServiceName = 'shikimori' | 'myanimelist' | 'anilist';
export type LibraryStatus =
  | 'watching'
  | 'planned'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'rewatching'
  | 'not_interested';

export interface ProviderViewer {
  id: string;
  username: string;
}

export interface ProviderTitleGenre {
  id: string;
  name: string;
  kind?: string;
}

export interface ProviderTitleStudio {
  id: string;
  name: string;
  image?: string;
}

export interface ProviderAnimeDetails {
  externalAnimeId: string;
  malId?: number | null;
  titleDefault: string;
  titleEnglish?: string | null;
  titleJapanese?: string | null;
  titleRussian?: string | null;
  licenseNameRu?: string | null;
  synonyms?: string[];
  kind?: string | null;
  rating?: string | null;
  score?: number | null;
  status?: string | null;
  episodes?: number | null;
  episodesAired?: number | null;
  duration?: number | null;
  airedOn?: string | null;
  releasedOn?: string | null;
  season?: string | null;
  url?: string | null;
  coverImage?: string | null;
  nextEpisodeDate?: string | null;
  isCensored?: boolean;
  genres?: ProviderTitleGenre[];
  studios?: ProviderTitleStudio[];
  description?: string | null;
  descriptionHtml?: string | null;
}

export interface ProviderLibraryEntry extends ProviderAnimeDetails {
  externalEntryId: string;
  watchStatus: LibraryStatus;
  watchedEpisodes: number;
  personalRating?: number | null;
  notes?: string | null;
  isFavorite?: boolean;
  isNotInterested?: boolean;
  lastProviderUpdateAt?: string | null;
}

export interface ProviderTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

export interface OAuthExchangeParams {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface ProviderUpdatePayload {
  externalEntryId?: string | null;
  externalAnimeId: string;
  watchStatus?: LibraryStatus;
  watchedEpisodes?: number;
  personalRating?: number | null;
  notes?: string | null;
  isFavorite?: boolean;
  isNotInterested?: boolean;
}

export interface ProviderUpdateResult {
  externalEntryId?: string | null;
  watchStatus?: LibraryStatus;
  watchedEpisodes?: number;
  personalRating?: number | null;
  notes?: string | null;
}

export interface ProviderCapabilities {
  supportsNotes: boolean;
  supportsRating: boolean;
  supportsRefresh: boolean;
}

export interface ProviderAdapter {
  serviceName: IntegrationServiceName;
  capabilities: ProviderCapabilities;
  getAuthorizationUrl(args: {
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  }): string;
  exchangeCode(args: OAuthExchangeParams): Promise<ProviderTokenResponse>;
  refreshToken?(integration: UserIntegration): Promise<ProviderTokenResponse>;
  fetchViewer(accessToken: string): Promise<ProviderViewer>;
  fetchLibrary(integration: UserIntegration): Promise<ProviderLibraryEntry[]>;
  fetchAnimeDetails(integration: UserIntegration, externalAnimeIds: string[]): Promise<ProviderAnimeDetails[]>;
  updateEntry(integration: UserIntegration, payload: ProviderUpdatePayload): Promise<ProviderUpdateResult>;
}
