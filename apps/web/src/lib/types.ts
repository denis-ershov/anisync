export type IntegrationServiceName = 'shikimori' | 'myanimelist' | 'anilist';
export type WatchStatus =
  | 'watching'
  | 'planned'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'rewatching'
  | 'not_interested';

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role: 'user' | 'admin';
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlatformModule = 'anime' | 'releases' | 'torrents';

export interface NotificationPreferences {
  inApp?: boolean;
  telegram?: boolean;
  email?: boolean;
  telegramChatId?: string | null;
}

export interface UserSettings {
  id: number;
  userId: number;
  theme: 'light' | 'dark';
  language: 'en' | 'ru';
  /** IANA timezone (e.g. Europe/Moscow). Dates in DB are UTC. */
  timezone: string;
  primaryService?: IntegrationServiceName | null;
  secondaryService?: IntegrationServiceName | null;
  enabledModules: PlatformModule[];
  notificationPreferences: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  bio?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  bio?: string;
  displayName?: string;
}

export interface UpdateUserSettingsData {
  theme?: 'light' | 'dark';
  language?: 'en' | 'ru';
  timezone?: string;
  primaryService?: IntegrationServiceName | null;
  secondaryService?: IntegrationServiceName | null;
  enabledModules?: PlatformModule[];
  notificationPreferences?: NotificationPreferences;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
  bio?: string;
  settings: UserSettings;
}

export interface UserIntegration {
  id: number;
  userId: number;
  serviceName: IntegrationServiceName;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  username?: string | null;
  userIdExternal?: string | null;
  automaticSync: boolean;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationData {
  serviceName: IntegrationServiceName;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  username: string;
  userIdExternal: string;
  automaticSync?: boolean;
}

export interface UpdateIntegrationData {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  username?: string | null;
  userIdExternal?: string | null;
  automaticSync?: boolean;
}

export type Genre = {
  id: number;
  name: string;
};

export type Studio = {
  id: number;
  name: string;
};

export type Anime = {
  id: number;
  animeId?: number;
  titleRussian: string;
  titleRomaji: string;
  coverImage: string;
  genres: Genre[];
  watchedEpisodes: number;
  totalEpisodes: number;
  shortDescription: string;
  fullSynopsis: string;
  nextEpisodeDate: string | null;
  releaseYear: number;
  studio: Studio;
  rating: number;
  status: string;
  watchStatus: WatchStatus;
  personalRating: number | null;
  userNotes: string;
  userRateId?: string;
  sourceService?: IntegrationServiceName;
  serviceLinks?: Array<{
    service: IntegrationServiceName;
    externalAnimeId: string;
    url: string;
  }>;
  isFavorite?: boolean;
  isNotInterested?: boolean;
  outOfSync?: boolean;
  syncState?: 'pending' | 'processing' | 'synced' | 'failed' | 'local_only';
};
