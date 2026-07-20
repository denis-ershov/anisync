/**
 * Apply NightWatcher additive tables onto AniSync DB (greenfield shared PG).
 * Skips recreate of existing `torrent_releases` (AniSync drizzle owns it).
 * Usage: pnpm exec tsx scripts/apply-nw-tables-on-anisync.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

function loadEnv(path: string) {
  const env: Record<string, string> = {};
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const DDL = `
CREATE TABLE IF NOT EXISTS imdb_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    imdb_id TEXT NOT NULL,
    title TEXT,
    original_title TEXT,
    type TEXT CHECK (type IN ('movie', 'tv')),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    poster_url TEXT,
    year TEXT,
    genre TEXT,
    plot TEXT,
    rating TEXT,
    runtime TEXT,
    last_checked TIMESTAMP,
    total_seasons INTEGER,
    total_episodes INTEGER,
    last_notified_season INTEGER DEFAULT 0,
    last_notified_episode INTEGER DEFAULT 0,
    target_season INTEGER,
    preferred_quality TEXT,
    preferred_audio TEXT,
    max_releases_count INTEGER DEFAULT NULL,
    check_interval INTEGER DEFAULT NULL,
    notify_once BOOLEAN DEFAULT FALSE,
    pinned_release_key TEXT DEFAULT NULL,
    pinned_release_aliases TEXT DEFAULT NULL,
    pinned_release_title TEXT DEFAULT NULL,
    tmdb_id INTEGER DEFAULT NULL,
    season_episode_count INTEGER DEFAULT NULL,
    telegram_chat_id TEXT DEFAULT NULL,
    status TEXT,
    network TEXT,
    country TEXT,
    language TEXT,
    official_site TEXT,
    schedule TEXT,
    last_air_date TEXT,
    in_production BOOLEAN,
    actors TEXT,
    director TEXT,
    creators TEXT,
    tagline TEXT,
    original_language TEXT,
    budget TEXT,
    revenue TEXT
);

DO $$
BEGIN
    ALTER TABLE imdb_watchlist
        ADD CONSTRAINT imdb_watchlist_user_imdb_unique UNIQUE (user_id, imdb_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications_history (
    id SERIAL PRIMARY KEY,
    imdb_id TEXT NOT NULL,
    release_title TEXT,
    notification_text TEXT,
    sent_at TIMESTAMP DEFAULT now(),
    success BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_watchlist_enabled ON imdb_watchlist(enabled);
CREATE INDEX IF NOT EXISTS idx_watchlist_imdb_id ON imdb_watchlist(imdb_id);
CREATE INDEX IF NOT EXISTS idx_imdb_watchlist_user_id ON imdb_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_imdb_watchlist_user_enabled ON imdb_watchlist(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_notifications_imdb ON notifications_history(imdb_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications_history(sent_at);
`;

async function main() {
  const env = loadEnv(resolve('E:/DEV/Project/anisync/.env'));
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql.unsafe(DDL);
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('imdb_watchlist', 'notifications_history', 'torrent_watchlist', 'torrent_releases')
      ORDER BY table_name
    `;
    console.log('ok', tables.map((t) => t.table_name));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
