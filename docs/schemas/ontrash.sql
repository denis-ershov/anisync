-- OnTrash / NextScene schema snapshot (from bootstrap.ts + Drizzle schema)
-- Source: NextScene backend/src/lib/bootstrap.ts, lib/db/src/schema/*
-- Date: 2026-07-20
-- Note: not a live pg_dump; app_sessions is outside Drizzle and created via bootstrap.

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  title_ru text,
  rating real,
  popularity real,
  poster_path text,
  genre text,
  genre_ru text,
  year integer,
  release_date text,
  next_episode_season integer,
  next_episode_number integer,
  next_episode_date text,
  added_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_user_tmdb_type UNIQUE (user_id, tmdb_id, type)
);

CREATE TABLE IF NOT EXISTS app_sessions (
  sid varchar PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS app_sessions_expire_idx ON app_sessions (expire);
