export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  theme: 'light' | 'dark';
  language: 'en' | 'ru';
  primary_service?: 'shikimori' | 'myanimelist' | 'anilist' | null;
  created_at: string;
  updated_at: string;
}

export interface UserAnimeList {
  id: number;
  user_id: number;
  anime_id: number;
  status: 'Watching' | 'Planned' | 'Completed' | 'On Hold' | 'Dropped' | 'Not Added';
  rating?: number;
  progress: number;
  notes?: string;
  created_at: string;
  updated_at: string;
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
}

export interface UpdateUserSettingsData {
  theme?: 'light' | 'dark';
  language?: 'en' | 'ru';
  primary_service?: 'shikimori' | 'myanimelist' | 'anilist' | null;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  bio?: string;
  settings: UserSettings;
}

export interface UserIntegration {
  id: number;
  user_id: number;
  service_name: 'shikimori' | 'myanimelist' | 'anilist';
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  username?: string;
  user_id_external?: string;
  automatic_sync: boolean;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIntegrationData {
  service_name: 'shikimori' | 'myanimelist' | 'anilist';
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  username: string;
  user_id_external: string;
  automatic_sync?: boolean;
}

export interface UpdateIntegrationData {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  username?: string;
  user_id_external?: string;
  automatic_sync?: boolean;
}

export type Genre = {
  id: number;
  name: string;
};

export type Studio = {
  id: number;
  name: string;
};

export type Status = 'Ongoing' | 'Completed' | 'Planned' | 'On Hold' | 'Dropped' | 'Watching';

export type Anime = {
  id: number;
  title_russian: string;
  title_romaji: string;
  cover_image: string;
  genres: Genre[];
  watched_episodes: number;
  total_episodes: number;
  short_description: string;
  full_synopsis: string;
  next_episode_date: string | null;
  release_year: number;
  studio: Studio;
  rating: number;
  status: 'Ongoing' | 'Completed';
  watch_status: Status;
  personal_rating: number | null;
  user_notes: string;
  user_rate_id?: string;
};
