/**
 * Migrate NightWatcher imdb_watchlist between databases (legacy → monorepo NW).
 *
 * Until AniSync owns `torrent_watchlist` (фаза 4.2 cutover), data lives in NW PG.
 * This script copies rows with optional user_id remapping.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-nightwatcher-watchlist.ts --dry-run
 *   pnpm exec tsx scripts/migrate-nightwatcher-watchlist.ts --apply
 *
 * Env:
 *   NW_SOURCE_DATABASE_URL — legacy NightWatcher Postgres
 *   NW_TARGET_DATABASE_URL — monorepo / current NightWatcher Postgres
 *     (fallback: NIGHTWATCHER_DATABASE_URL, then DATABASE_URL)
 *   NW_USER_MAP — optional JSON `{ "1": 1, "2": 5 }` legacy user_id → AniSync user_id
 *     default: identity (keep source user_id)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

type SourceRow = {
  id: number;
  user_id: number;
  imdb_id: string;
  title: string | null;
  original_title: string | null;
  type: string | null;
  enabled: boolean | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  poster_url: string | null;
  year: string | null;
  genre: string | null;
  plot: string | null;
  rating: string | null;
  runtime: string | null;
  last_checked: Date | string | null;
  total_seasons: number | null;
  total_episodes: number | null;
  last_notified_season: number | null;
  last_notified_episode: number | null;
  target_season: number | null;
  preferred_quality: string | null;
  preferred_audio: string | null;
  max_releases_count: number | null;
  check_interval: number | null;
  notify_once: boolean | null;
  pinned_release_key: string | null;
  pinned_release_aliases: string | null;
  pinned_release_title: string | null;
  tmdb_id: number | null;
  season_episode_count: number | null;
  telegram_chat_id: string | null;
  status: string | null;
  network: string | null;
  country: string | null;
  language: string | null;
  official_site: string | null;
  schedule: string | null;
  last_air_date: string | null;
  in_production: boolean | null;
  actors: string | null;
  director: string | null;
  creators: string | null;
  tagline: string | null;
  original_language: string | null;
  budget: string | null;
  revenue: string | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');

function requireEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  throw new Error(`Missing env (tried: ${names.join(', ')})`);
}

function loadUserMap(): Record<string, number> {
  const path = process.env.NW_USER_MAP;
  if (!path) {
    return {};
  }
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`NW_USER_MAP file not found: ${resolved}`);
  }
  const raw = JSON.parse(readFileSync(resolved, 'utf8')) as
    | Record<string, number>
    | { map: Record<string, number> };
  return 'map' in raw ? raw.map : raw;
}

function mapUserId(sourceUserId: number, map: Record<string, number>): number {
  const mapped = map[String(sourceUserId)];
  return typeof mapped === 'number' ? mapped : sourceUserId;
}

async function main() {
  const sourceUrl = requireEnv('NW_SOURCE_DATABASE_URL');
  const targetUrl = requireEnv(
    'NW_TARGET_DATABASE_URL',
    'NIGHTWATCHER_DATABASE_URL',
    'DATABASE_URL'
  );
  const userMap = loadUserMap();

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });

  const rows = await source<SourceRow[]>`
    SELECT *
    FROM imdb_watchlist
    ORDER BY id ASC
  `;

  let inserted = 0;
  let skipped = 0;

  console.log(
    `Source watchlist: ${rows.length}; mode=${dryRun ? 'dry-run' : 'apply'}; userMapKeys=${Object.keys(userMap).length}`
  );

  for (const row of rows) {
    const userId = mapUserId(row.user_id ?? 1, userMap);
    const existing = await target<{ id: number }[]>`
      SELECT id FROM imdb_watchlist
      WHERE user_id = ${userId}
        AND imdb_id = ${row.imdb_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      skipped += 1;
      if (dryRun) {
        console.log(
          `would skip existing id=${existing[0].id} user=${userId} imdb=${row.imdb_id}`
        );
      }
      continue;
    }

    if (dryRun) {
      inserted += 1;
      console.log(
        `would insert source=${row.id} user=${userId} imdb=${row.imdb_id} title=${row.title ?? ''}`
      );
      continue;
    }

    await target`
      INSERT INTO imdb_watchlist (
        user_id, imdb_id, title, original_title, type, enabled,
        created_at, updated_at, poster_url, year, genre, plot, rating, runtime,
        last_checked, total_seasons, total_episodes,
        last_notified_season, last_notified_episode, target_season,
        preferred_quality, preferred_audio, max_releases_count, check_interval,
        notify_once, pinned_release_key, pinned_release_aliases, pinned_release_title,
        tmdb_id, season_episode_count, telegram_chat_id,
        status, network, country, language, official_site, schedule, last_air_date,
        in_production, actors, director, creators, tagline, original_language,
        budget, revenue
      ) VALUES (
        ${userId},
        ${row.imdb_id},
        ${row.title},
        ${row.original_title},
        ${row.type},
        ${row.enabled ?? true},
        ${row.created_at ?? new Date()},
        ${row.updated_at ?? new Date()},
        ${row.poster_url},
        ${row.year},
        ${row.genre},
        ${row.plot},
        ${row.rating},
        ${row.runtime},
        ${row.last_checked},
        ${row.total_seasons},
        ${row.total_episodes},
        ${row.last_notified_season ?? 0},
        ${row.last_notified_episode ?? 0},
        ${row.target_season},
        ${row.preferred_quality},
        ${row.preferred_audio},
        ${row.max_releases_count},
        ${row.check_interval},
        ${row.notify_once ?? false},
        ${row.pinned_release_key},
        ${row.pinned_release_aliases},
        ${row.pinned_release_title},
        ${row.tmdb_id},
        ${row.season_episode_count},
        ${row.telegram_chat_id},
        ${row.status},
        ${row.network},
        ${row.country},
        ${row.language},
        ${row.official_site},
        ${row.schedule},
        ${row.last_air_date},
        ${row.in_production},
        ${row.actors},
        ${row.director},
        ${row.creators},
        ${row.tagline},
        ${row.original_language},
        ${row.budget},
        ${row.revenue}
      )
    `;
    inserted += 1;
  }

  console.log(`Done. inserted=${inserted} skipped=${skipped}`);

  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
