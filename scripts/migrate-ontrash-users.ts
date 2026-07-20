/**
 * Migrate OnTrash (NextScene) users → AniSync users.
 *
 * Usage (from repo root):
 *   pnpm exec tsx scripts/migrate-ontrash-users.ts --dry-run
 *   pnpm exec tsx scripts/migrate-ontrash-users.ts --apply
 *
 * Env:
 *   ONTRASH_DATABASE_URL  — source Postgres
 *   DATABASE_URL          — AniSync target Postgres
 *   MAPPING_OUT           — optional path for id map JSON (default scripts/.ontrash-user-map.json)
 *
 * Notes:
 * - OnTrash users have no email → synthetic `{username}@ontrash.migrated`
 * - bcrypt hashes are copied as-is (cost is embedded in the hash)
 * - Username collisions: skip source row (logged); use --prefix to rename
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

type SourceUser = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: Date | string | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');
const prefix = (() => {
  const idx = process.argv.indexOf('--prefix');
  return idx >= 0 ? process.argv[idx + 1] : '';
})();

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
  const mappingOut = resolve(
    process.env.MAPPING_OUT || 'scripts/.ontrash-user-map.json'
  );

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });

  const rows = await source<SourceUser[]>`
    SELECT id, username, password_hash, role, created_at
    FROM users
    ORDER BY id ASC
  `;

  const map: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;

  console.log(`Source users: ${rows.length}; mode=${dryRun ? 'dry-run' : 'apply'}`);

  for (const row of rows) {
    const username = `${prefix}${row.username}`.slice(0, 64);
    const email = `${username.replace(/[^a-zA-Z0-9._-]/g, '_')}@ontrash.migrated`;
    const role = row.role === 'admin' ? 'admin' : 'user';

    const existing = await target<{ id: number }[]>`
      SELECT id FROM users WHERE username = ${username} OR email = ${email} LIMIT 1
    `;

    if (existing.length > 0) {
      map[String(row.id)] = existing[0].id;
      skipped += 1;
      console.log(`skip collision ontrash=${row.id} → anisync=${existing[0].id} (${username})`);
      continue;
    }

    if (dryRun) {
      console.log(`would insert ontrash=${row.id} username=${username} role=${role}`);
      map[String(row.id)] = -row.id;
      inserted += 1;
      continue;
    }

    const insertedRows = await target<{ id: number }[]>`
      INSERT INTO users (username, email, password_hash, display_name, role, created_at, updated_at)
      VALUES (
        ${username},
        ${email},
        ${row.password_hash},
        ${row.username},
        ${role},
        ${row.created_at ?? new Date()},
        NOW()
      )
      RETURNING id
    `;

    const newId = insertedRows[0].id;
    map[String(row.id)] = newId;

    const settingsExisting = await target<{ id: number }[]>`
      SELECT id FROM user_settings WHERE user_id = ${newId} LIMIT 1
    `;
    if (settingsExisting.length === 0) {
      await target`
        INSERT INTO user_settings (user_id, theme, language, enabled_modules, notification_preferences)
        VALUES (
          ${newId},
          'dark',
          'ru',
          ${JSON.stringify(['anime', 'releases'])}::jsonb,
          ${JSON.stringify({ inApp: true, telegram: false, email: false })}::jsonb
        )
      `;
    }

    inserted += 1;
    console.log(`inserted ontrash=${row.id} → anisync=${newId}`);
  }

  writeFileSync(mappingOut, JSON.stringify({ generatedAt: new Date().toISOString(), map }, null, 2));
  console.log(`Done. inserted=${inserted} skipped=${skipped} map=${mappingOut}`);

  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
