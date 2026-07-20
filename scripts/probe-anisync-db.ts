/**
 * Probe anisync DB and optionally run drizzle migrations.
 * Usage:
 *   pnpm exec tsx scripts/probe-anisync-db.ts
 *   pnpm exec tsx scripts/probe-anisync-db.ts --migrate
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

function loadEnv(path: string) {
  const env: Record<string, string> = {};
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

async function main() {
  const doMigrate = process.argv.includes('--migrate');
  const env = loadEnv(resolve('E:/DEV/Project/anisync/.env'));
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const meta = await sql<{ db: string; schema: string; user: string }[]>`
      SELECT current_database() AS db, current_schema() AS schema, current_user AS user
    `;
    console.log('meta', meta[0]);

    const schemas = await sql<{ nspname: string }[]>`
      SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
      ORDER BY nspname
    `;
    console.log(
      'schemas',
      schemas.map((s) => s.nspname)
    );

    const tables = await sql<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY c.relname
    `;
    console.log(
      'public tables',
      tables.length,
      tables.map((t) => t.relname).slice(0, 40)
    );

    if (doMigrate) {
      console.log('running drizzle migrate...');
      const db = drizzle(sql);
      await migrate(db, {
        migrationsFolder: resolve('E:/DEV/Project/anisync/apps/web/drizzle'),
      });
      const after = await sql<{ relname: string }[]>`
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public'
        ORDER BY c.relname
      `;
      console.log(
        'after migrate tables',
        after.length,
        after.map((t) => t.relname)
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
