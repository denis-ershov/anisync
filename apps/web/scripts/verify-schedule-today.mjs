/**
 * Проверка: пятничные тайтлы с next=+7 попадают в «Сегодня» после фикса.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const repoRoot = resolve(webRoot, '../..');
const require = createRequire(resolve(webRoot, 'package.json'));
const postgres = require('postgres');

function loadEnv() {
  for (const rel of ['.env', 'apps/web/.env']) {
    try {
      const text = readFileSync(resolve(repoRoot, rel), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m || process.env[m[1]]) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    } catch {}
  }
}

loadEnv();

// Динамический импорт TS через tsx register — проще инлайнить логику как в schedule-day
function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
function toDateKey(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLatestAiredInstant(nextEpisodeDate, now) {
  if (!nextEpisodeDate) return null;
  const next = new Date(nextEpisodeDate);
  if (Number.isNaN(next.getTime())) return null;
  if (next.getTime() <= now.getTime()) return next;
  const today = startOfLocalDay(now);
  const nextDay = startOfLocalDay(next);
  const daysUntil = Math.round((nextDay - today) / 86400000);
  if (daysUntil >= 5 && daysUntil <= 9) {
    const previous = new Date(next);
    previous.setDate(previous.getDate() - 7);
    return previous;
  }
  return null;
}

function isToday(nextEpisodeDate, now) {
  const instant = getLatestAiredInstant(nextEpisodeDate, now);
  if (!instant) return false;
  return toDateKey(startOfLocalDay(instant)) === toDateKey(startOfLocalDay(now));
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const now = new Date();
const rows = await sql`
  SELECT ac.mal_id, ac.title_russian, ac.title_default, ac.next_episode_date, ule.watch_status
  FROM user_library_entries ule
  JOIN anime_catalog ac ON ac.id = ule.anime_id
  WHERE ule.user_id = 2 AND ule.watch_status IN ('watching','rewatching','planned')
`;

const todayHits = [];
for (const r of rows) {
  if (isToday(r.next_episode_date, now)) {
    todayHits.push({
      mal: r.mal_id,
      title: (r.title_russian || r.title_default || '').slice(0, 60),
      next: r.next_episode_date,
    });
  }
}

console.log('now', now.toISOString());
console.log('would show in Сегодня:', todayHits.length);
for (const h of todayHits) console.log(' ', h);

await sql.end({ timeout: 5 });
process.exit(todayHits.length > 0 ? 0 : 1);
