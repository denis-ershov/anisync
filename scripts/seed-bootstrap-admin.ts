/**
 * Create bootstrap admin if users table is empty.
 *
 * Usage:
 *   pnpm exec tsx scripts/seed-bootstrap-admin.ts
 *
 * Env (anisync/.env or process):
 *   DATABASE_URL
 *   BOOTSTRAP_ADMIN_USERNAME (default: admin)
 *   BOOTSTRAP_ADMIN_EMAIL (default: admin@anisync.local)
 *   BOOTSTRAP_ADMIN_PASSWORD (required)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

function loadEnv(path: string) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      if (!process.env[key]) {
        process.env[key] = line.slice(eq + 1).trim();
      }
    }
  } catch {
    /* optional */
  }
}

async function main() {
  loadEnv(fileURLToPath(new URL('../.env', import.meta.url)));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const username = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin';
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@anisync.local';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set BOOTSTRAP_ADMIN_PASSWORD (min 8 chars)');
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const [{ c }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM users`;
    if (c > 0) {
      console.log(`users already exist (${c}); skip bootstrap`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
      VALUES (${username}, ${email}, ${passwordHash}, 'admin', NOW(), NOW())
      RETURNING id
    `;

    await sql`
      INSERT INTO user_settings (user_id, theme, language, enabled_modules, notification_preferences, created_at, updated_at)
      VALUES (
        ${user.id},
        'dark',
        'ru',
        ${sql.json(['anime', 'releases', 'torrents'])},
        ${sql.json({ inApp: true, telegram: false, email: false, telegramChatId: null })},
        NOW(),
        NOW()
      )
    `;

    console.log(`bootstrap admin created id=${user.id} username=${username} email=${email}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
