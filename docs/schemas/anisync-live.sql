-- Live schema snapshot: anisync prod
-- Generated: 2026-07-20T12:53:14.103Z
-- Tables: 16

-- TABLE anime_catalog
CREATE TABLE IF NOT EXISTS anime_catalog (
  id integer NOT NULL DEFAULT nextval('anime_catalog_id_seq'::regclass),
  mal_id integer,
  title_default text NOT NULL,
  title_english text,
  title_japanese text,
  title_russian text,
  license_name_ru text,
  synonyms jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text,
  rating text,
  score double precision,
  status text,
  episodes integer,
  episodes_aired integer,
  duration integer,
  aired_on text,
  released_on text,
  season text,
  url text,
  cover_image text,
  next_episode_date text,
  is_censored boolean NOT NULL DEFAULT false,
  genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  studios jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  description_html text,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE anime_service_ids
CREATE TABLE IF NOT EXISTS anime_service_ids (
  id integer NOT NULL DEFAULT nextval('anime_service_ids_id_seq'::regclass),
  anime_id integer NOT NULL,
  service_name text NOT NULL,
  external_anime_id text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE media_external_ids
CREATE TABLE IF NOT EXISTS media_external_ids (
  id integer NOT NULL DEFAULT nextval('media_external_ids_id_seq'::regclass),
  media_type text NOT NULL,
  tmdb_id text,
  imdb_id text,
  mal_id integer,
  anilist_id integer,
  shikimori_id text,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE notifications
CREATE TABLE IF NOT EXISTS notifications (
  id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id integer NOT NULL,
  anime_id integer,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  module text NOT NULL DEFAULT 'anime'::text,
  channel text NOT NULL DEFAULT 'in_app'::text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- TABLE release_watchlist_entries
CREATE TABLE IF NOT EXISTS release_watchlist_entries (
  id integer NOT NULL DEFAULT nextval('release_watchlist_entries_id_seq'::regclass),
  user_id integer NOT NULL,
  tmdb_id integer NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  title_ru text,
  rating double precision,
  popularity double precision,
  poster_path text,
  genre text,
  genre_ru text,
  year integer,
  release_date text,
  next_episode_season integer,
  next_episode_number integer,
  next_episode_date text,
  added_at timestamp without time zone NOT NULL DEFAULT now(),
  schedule_updated_at timestamp without time zone
);

-- TABLE sync_job_attempts
CREATE TABLE IF NOT EXISTS sync_job_attempts (
  id integer NOT NULL DEFAULT nextval('sync_job_attempts_id_seq'::regclass),
  sync_job_id integer NOT NULL,
  service_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamp without time zone,
  finished_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE sync_jobs
CREATE TABLE IF NOT EXISTS sync_jobs (
  id integer NOT NULL DEFAULT nextval('sync_jobs_id_seq'::regclass),
  user_id integer NOT NULL,
  primary_service text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  direction text NOT NULL DEFAULT 'primary_import'::text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamp without time zone,
  finished_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_anime_list
CREATE TABLE IF NOT EXISTS user_anime_list (
  id integer NOT NULL DEFAULT nextval('user_anime_list_id_seq'::regclass),
  user_id integer NOT NULL,
  anime_id integer NOT NULL,
  status text NOT NULL DEFAULT 'Not Added'::text,
  rating integer,
  progress integer DEFAULT 0,
  notes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_entry_changes
CREATE TABLE IF NOT EXISTS user_entry_changes (
  id integer NOT NULL DEFAULT nextval('user_entry_changes_id_seq'::regclass),
  user_id integer NOT NULL,
  library_entry_id integer NOT NULL,
  change_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  synced_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_integrations
CREATE TABLE IF NOT EXISTS user_integrations (
  id integer NOT NULL DEFAULT nextval('user_integrations_id_seq'::regclass),
  user_id integer NOT NULL,
  service_name text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamp without time zone,
  username text,
  user_id_external text,
  automatic_sync boolean NOT NULL DEFAULT false,
  last_sync_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_library_entries
CREATE TABLE IF NOT EXISTS user_library_entries (
  id integer NOT NULL DEFAULT nextval('user_library_entries_id_seq'::regclass),
  user_id integer NOT NULL,
  anime_id integer NOT NULL,
  source_service text NOT NULL,
  source_entry_id text,
  watch_status text NOT NULL DEFAULT 'planned'::text,
  watched_episodes integer NOT NULL DEFAULT 0,
  total_episodes_snapshot integer,
  personal_rating double precision,
  notes text,
  notes_sync_status text NOT NULL DEFAULT 'local_only'::text,
  out_of_sync boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  is_not_interested boolean NOT NULL DEFAULT false,
  last_provider_update_at timestamp without time zone,
  last_synced_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_lists
CREATE TABLE IF NOT EXISTS user_lists (
  id integer NOT NULL DEFAULT nextval('user_lists_id_seq'::regclass),
  user_id integer NOT NULL,
  anime_id integer NOT NULL,
  list_type text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id text NOT NULL,
  user_id integer NOT NULL,
  token text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- TABLE user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id integer NOT NULL DEFAULT nextval('user_settings_id_seq'::regclass),
  user_id integer NOT NULL,
  theme text NOT NULL DEFAULT 'dark'::text,
  language text NOT NULL DEFAULT 'en'::text,
  primary_service text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  enabled_modules jsonb NOT NULL DEFAULT '["anime"]'::jsonb,
  notification_preferences jsonb NOT NULL DEFAULT '{"email": false, "inApp": true, "telegram": false}'::jsonb
);

-- TABLE users
CREATE TABLE IF NOT EXISTS users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  bio text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  display_name text,
  role text NOT NULL DEFAULT 'user'::text
);

-- TABLE watch_history
CREATE TABLE IF NOT EXISTS watch_history (
  id integer NOT NULL DEFAULT nextval('watch_history_id_seq'::regclass),
  user_id integer NOT NULL,
  anime_id integer NOT NULL,
  watched_episodes integer NOT NULL DEFAULT 0,
  watch_status text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);
