/**
 * Migrate OnTrash watchlist_items → AniSync release_watchlist_entries.
 *
 * Prerequisites: run migrate-ontrash-users.ts first (produces user id map).
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-ontrash-watchlist.ts --dry-run
 *   pnpm exec tsx scripts/migrate-ontrash-watchlist.ts --apply
 *
 * Env:
 *   ONTRASH_DATABASE_URL
 *   DATABASE_URL
 *   MAPPING_IN — default scripts/.ontrash-user-map.json
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

type SourceItem = {
  id: number;
  user_id: number;
  tmdb_id: number;
  type: 'movie' | 'show';
  status: 'watching' | 'plan';
  title: string;
  title_ru: string | null;
  rating: number | null;
  popularity: number | null;
  poster_path: string | null;
  genre: string | null;
  genre_ru: string | null;
  year: number | null;
  release_date: string | null;
  next_episode_season: number | null;
  next_episode_number: number | null;
  next_episode_date: string | null;
  added_at: Date | string | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

async function main() {
  const sourceUrl = requireEnv('ONTRASH_DATABASE_URL');
  const targetUrl = requireEnv('DATABASE_URL');
  const mappingPath = resolve(process.env.MAPPING_IN || 'scripts/.ontrash-user-map.json');
  const mappingFile = JSON.parse(readFileSync(mappingPath, 'utf8')) as {
    map: Record<string, number>;
  };

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });

  const items = await source<SourceItem[]>`
    SELECT
      id, user_id, tmdb_id, type, status, title, title_ru, rating, popularity,
      poster_path, genre, genre_ru, year, release_date,
      next_episode_season, next_episode_number, next_episode_date, added_at
    FROM watchlist_items
    ORDER BY id ASC
  `;

  let inserted = 0;
  let skipped = 0;
  let missingUser = 0;

  console.log(`Source watchlist: ${items.length}; mode=${dryRun ? 'dry-run' : 'apply'}`);

  for (const item of items) {
    const anisyncUserId = mappingFile.map[String(item.user_id)];
    if (!anisyncUserId || anisyncUserId < 0) {
      missingUser += 1;
      console.warn(`no user map for ontrash user_id=${item.user_id} item=${item.id}`);
      continue;
    }

    const existing = await target<{ id: number }[]>`
      SELECT id FROM release_watchlist_entries
      WHERE user_id = ${anisyncUserId}
        AND tmdb_id = ${item.tmdb_id}
        AND type = ${item.type}
      LIMIT 1
    `;

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      inserted += 1;
      console.log(
        `would insert item=${item.id} user=${anisyncUserId} tmdb=${item.tmdb_id} ${item.type}`
      );
      continue;
    }

    await target`
      INSERT INTO release_watchlist_entries (
        user_id, tmdb_id, type, status, title, title_ru, rating, popularity,
        poster_path, genre, genre_ru, year, release_date,
        next_episode_season, next_episode_number, next_episode_date, added_at
      ) VALUES (
        ${anisyncUserId},
        ${item.tmdb_id},
        ${item.type},
        ${item.status},
        ${item.title},
        ${item.title_ru},
        ${item.rating},
        ${item.popularity},
        ${item.poster_path},
        ${item.genre},
        ${item.genre_ru},
        ${item.year},
        ${item.release_date},
        ${item.next_episode_season},
        ${item.next_episode_number},
        ${item.next_episode_date},
        ${item.added_at ?? new Date()}
      )
    `;
    inserted += 1;
  }

  console.log(
    `Done. inserted=${inserted} skipped=${skipped} missingUser=${missingUser}`
  );

  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
