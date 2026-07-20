/**
 * Verify migration counts between source and target databases.
 *
 * Compares OnTrash / NightWatcher source tables with AniSync / NW targets
 * and reports deltas (expected after user mapping: source_count vs mapped rows).
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-verify-counts.ts
 *
 * Env (any subset; missing pairs are skipped):
 *   ONTRASH_DATABASE_URL + DATABASE_URL
 *     → users, watchlist_items vs users(@ontrash.migrated), release_watchlist_entries
 *   NW_SOURCE_DATABASE_URL + NW_TARGET_DATABASE_URL (or NIGHTWATCHER_DATABASE_URL / DATABASE_URL)
 *     → imdb_watchlist counts
 *   MAPPING_IN — OnTrash user map (default scripts/.ontrash-user-map.json)
 *   NW_USER_MAP — optional NW user map JSON
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

type CountRow = { count: string | number };

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

function loadMap(path: string | undefined): Record<string, number> {
  if (!path) {
    return {};
  }
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    console.warn(`map file missing: ${resolved}`);
    return {};
  }
  const raw = JSON.parse(readFileSync(resolved, 'utf8')) as
    | Record<string, number>
    | { map: Record<string, number> };
  return 'map' in raw ? raw.map : raw;
}

async function count(sql: postgres.Sql, query: string): Promise<number> {
  const rows = await sql.unsafe<CountRow[]>(query);
  return Number(rows[0]?.count ?? 0);
}

function report(label: string, source: number, target: number, note?: string) {
  const delta = target - source;
  const status = delta === 0 ? 'OK' : delta > 0 ? 'TARGET+' : 'TARGET-';
  console.log(
    `${status.padEnd(8)} ${label.padEnd(42)} source=${source} target=${target} delta=${delta}${note ? `  (${note})` : ''}`
  );
  return delta === 0;
}

async function verifyOnTrash() {
  const sourceUrl = env('ONTRASH_DATABASE_URL');
  const targetUrl = env('DATABASE_URL');
  if (!sourceUrl || !targetUrl) {
    console.log('skip OnTrash: need ONTRASH_DATABASE_URL + DATABASE_URL');
    return true;
  }

  console.log('\n=== OnTrash → AniSync ===');
  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });
  const map = loadMap(env('MAPPING_IN') || 'scripts/.ontrash-user-map.json');
  const mappedUsers = new Set(Object.values(map).filter((id) => id > 0));

  try {
    const srcUsers = await count(source, 'SELECT COUNT(*)::int AS count FROM users');
    const tgtMigrated = await count(
      target,
      `SELECT COUNT(*)::int AS count FROM users WHERE email LIKE '%@ontrash.migrated'`
    );
    const srcWatch = await count(source, 'SELECT COUNT(*)::int AS count FROM watchlist_items');
    const tgtWatch = await count(
      target,
      'SELECT COUNT(*)::int AS count FROM release_watchlist_entries'
    );

    let ok = true;
    ok =
      report(
        'users (migrated emails)',
        srcUsers,
        tgtMigrated,
        `map entries=${Object.keys(map).length}`
      ) && ok;
    ok =
      report(
        'watchlist → release_watchlist_entries',
        srcWatch,
        tgtWatch,
        `mapped users=${mappedUsers.size}`
      ) && ok;

    if (Object.keys(map).length > 0) {
      const mappedSourceIds = Object.keys(map).length;
      ok = report('user map coverage', srcUsers, mappedSourceIds, 'map keys vs source users') && ok;
    }

    return ok;
  } finally {
    await source.end();
    await target.end();
  }
}

async function verifyNightWatcher() {
  const sourceUrl = env('NW_SOURCE_DATABASE_URL');
  const targetUrl =
    env('NW_TARGET_DATABASE_URL') ||
    env('NIGHTWATCHER_DATABASE_URL') ||
    env('DATABASE_URL');
  if (!sourceUrl || !targetUrl) {
    console.log('skip NightWatcher: need NW_SOURCE_DATABASE_URL + target URL');
    return true;
  }

  console.log('\n=== NightWatcher imdb_watchlist ===');
  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });
  const map = loadMap(env('NW_USER_MAP'));

  try {
    const src = await count(source, 'SELECT COUNT(*)::int AS count FROM imdb_watchlist');
    const tgt = await count(target, 'SELECT COUNT(*)::int AS count FROM imdb_watchlist');
    const srcEnabled = await count(
      source,
      'SELECT COUNT(*)::int AS count FROM imdb_watchlist WHERE enabled = true'
    );
    const tgtEnabled = await count(
      target,
      'SELECT COUNT(*)::int AS count FROM imdb_watchlist WHERE enabled = true'
    );

    let ok = true;
    ok = report('imdb_watchlist rows', src, tgt, `userMapKeys=${Object.keys(map).length}`) && ok;
    ok = report('imdb_watchlist enabled', srcEnabled, tgtEnabled) && ok;
    return ok;
  } finally {
    await source.end();
    await target.end();
  }
}

async function main() {
  const a = await verifyOnTrash();
  const b = await verifyNightWatcher();
  const ok = a && b;
  console.log(`\n${ok ? 'All checked pairs match (or skipped).' : 'Mismatch detected — review deltas above.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
