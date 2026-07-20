/**
 * Promote a user to admin by username or email.
 *
 * Usage:
 *   pnpm exec tsx scripts/promote-admin.ts --username alice
 *   pnpm exec tsx scripts/promote-admin.ts --email alice@example.com
 *
 * Env: DATABASE_URL (or loads anisync/.env)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  loadEnv(resolve('E:/DEV/Project/anisync/.env'));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const username = argValue('--username');
  const email = argValue('--email');
  if (!username && !email) {
    throw new Error('Provide --username or --email');
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rows = username
      ? await sql<{ id: number; username: string; email: string; role: string }[]>`
          SELECT id, username, email, role FROM users WHERE username = ${username} LIMIT 1
        `
      : await sql<{ id: number; username: string; email: string; role: string }[]>`
          SELECT id, username, email, role FROM users WHERE email = ${email!} LIMIT 1
        `;

    if (!rows[0]) {
      throw new Error('User not found');
    }

    const user = rows[0];
    if (user.role === 'admin') {
      console.log(`already admin: id=${user.id} username=${user.username}`);
      return;
    }

    await sql`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = ${user.id}`;
    console.log(`promoted to admin: id=${user.id} username=${user.username}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
