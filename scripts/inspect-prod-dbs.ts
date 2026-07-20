/**
 * One-off DB inspection for consolidation (no secrets printed).
 * Usage: pnpm exec tsx scripts/inspect-prod-dbs.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

function loadEnvFile(path: string, into: Record<string, string>) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      into[key] = val;
    }
  } catch {
    /* missing file ok */
  }
}

function hostOf(url: string) {
  try {
    return new URL(url.replace(/^postgres(ql)?:/, 'http:')).host;
  } catch {
    return '(parse-error)';
  }
}

async function tryConnect(label: string, url: string) {
  const attempts: Array<{ ssl?: 'require' | false }> = [{ ssl: 'require' }, {}];
  for (const opts of attempts) {
    const sql = postgres(url, { max: 1, prepare: false, ...opts });
    try {
      await sql`SELECT 1 AS ok`;
      console.log(`${label}: connected host=${hostOf(url)} ssl=${opts.ssl ?? 'default'}`);
      return sql;
    } catch (error) {
      await sql.end().catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${label}: fail (${opts.ssl ?? 'default'}) ${message.slice(0, 160)}`);
    }
  }
  return null;
}

async function listPublicTables(sql: postgres.Sql) {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

async function columnExists(sql: postgres.Sql, table: string, column: string) {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function dumpSchemaSql(sql: postgres.Sql, outPath: string, title: string) {
  const tables = await listPublicTables(sql);
  const lines: string[] = [
    `-- Live schema snapshot: ${title}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Tables: ${tables.length}`,
    '',
  ];

  for (const table of tables) {
    const cols = await sql<
      {
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[]
    >`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    lines.push(`-- TABLE ${table}`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
    lines.push(
      cols
        .map((c) => {
          const nullSql = c.is_nullable === 'YES' ? '' : ' NOT NULL';
          const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
          return `  ${c.column_name} ${c.data_type}${nullSql}${def}`;
        })
        .join(',\n')
    );
    lines.push(');');
    lines.push('');
  }

  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`wrote ${outPath} (${tables.length} tables)`);
  return tables;
}

async function main() {
  const anisyncEnv: Record<string, string> = {};
  const nwEnv: Record<string, string> = {};
  loadEnvFile(resolve('E:/DEV/Project/anisync/.env'), anisyncEnv);
  loadEnvFile(resolve('E:/DEV/Project/nightwatcher/.env'), nwEnv);

  const anisyncUrl = anisyncEnv.DATABASE_URL;
  const nwUrl = nwEnv.DATABASE_URL;
  if (!anisyncUrl) throw new Error('anisync DATABASE_URL missing');
  if (!nwUrl) throw new Error('nightwatcher DATABASE_URL missing');

  mkdirSync(resolve('E:/DEV/Project/anisync/docs/schemas'), { recursive: true });

  const anisync = await tryConnect('anisync', anisyncUrl);
  const nw = await tryConnect('nightwatcher', nwUrl);

  if (anisync) {
    const tables = await dumpSchemaSql(
      anisync,
      resolve('E:/DEV/Project/anisync/docs/schemas/anisync-live.sql'),
      'anisync prod'
    );
    const important = [
      'users',
      'user_sessions',
      'user_settings',
      'notifications',
      'media_external_ids',
      'release_watchlist_entries',
      'sync_jobs',
      '__drizzle_migrations',
    ];
    for (const t of important) {
      console.log(`anisync has ${t}: ${tables.includes(t)}`);
    }
    if (tables.includes('users')) {
      const cols = ['role', 'display_name'];
      for (const c of cols) {
        console.log(`users.${c}: ${await columnExists(anisync, 'users', c)}`);
      }
      const counts = await anisync<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM users`;
      console.log(`anisync users count: ${counts[0]?.c}`);
    }
    if (tables.includes('notifications')) {
      for (const c of ['module', 'channel', 'payload']) {
        console.log(`notifications.${c}: ${await columnExists(anisync, 'notifications', c)}`);
      }
    }
    if (tables.includes('release_watchlist_entries')) {
      const counts = await anisync<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM release_watchlist_entries
      `;
      console.log(`release_watchlist_entries count: ${counts[0]?.c}`);
    }
    if (tables.includes('__drizzle_migrations')) {
      const migs = await anisync<{ hash: string; created_at: string | number }[]>`
        SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at
      `;
      console.log(`drizzle migrations: ${migs.length}`);
    }
    await anisync.end();
  }

  if (nw) {
    const tables = await dumpSchemaSql(
      nw,
      resolve('E:/DEV/Project/anisync/docs/schemas/nightwatcher-live.sql'),
      'nightwatcher prod'
    );
    console.log(`nw has imdb_watchlist: ${tables.includes('imdb_watchlist')}`);
    if (tables.includes('imdb_watchlist')) {
      for (const c of ['user_id', 'telegram_chat_id', 'check_interval', 'last_checked']) {
        console.log(`imdb_watchlist.${c}: ${await columnExists(nw, 'imdb_watchlist', c)}`);
      }
      const counts = await nw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM imdb_watchlist`;
      console.log(`imdb_watchlist count: ${counts[0]?.c}`);
    }
    await nw.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
