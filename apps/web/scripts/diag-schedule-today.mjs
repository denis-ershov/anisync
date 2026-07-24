/**
 * Диагностика: почему «Сегодня» пустое в расписании.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    } catch {
      /* optional */
    }
  }
}

loadEnv();
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const now = new Date();
console.log('now UTC=', now.toISOString(), 'local=', now.toString());

const library = await sql`
  SELECT ule.id, ule.watch_status, ule.watched_episodes, ule.source_service,
         ac.id AS anime_id, ac.mal_id, ac.title_russian, ac.title_default,
         ac.next_episode_date, ac.aired_on, ac.episodes, ac.episodes_aired,
         ac.is_censored, ac.status AS anime_status
  FROM user_library_entries ule
  JOIN anime_catalog ac ON ac.id = ule.anime_id
  WHERE ule.user_id = 2
    AND ule.watch_status IN ('watching', 'planned', 'rewatching')
  ORDER BY ac.next_episode_date NULLS LAST, ac.title_default
`;

console.log('library schedule statuses count=', library.length);

const withNext = library.filter((r) => r.next_episode_date);
const withoutNext = library.filter((r) => !r.next_episode_date);
console.log('with next_episode_date=', withNext.length, 'without=', withoutNext.length);

function dayKey(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')} local`;
}
function dayKeyUTC(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')} UTC`;
}

const todayLocal = dayKey(now);
const todayUTC = dayKeyUTC(now);
console.log('todayLocal=', todayLocal, 'todayUTC=', todayUTC);

const byLocalDay = new Map();
for (const row of withNext) {
  const k = dayKey(row.next_episode_date);
  if (!byLocalDay.has(k)) byLocalDay.set(k, []);
  byLocalDay.get(k).push(row);
}

console.log('\n=== next_episode_date by local day (top) ===');
for (const [k, rows] of [...byLocalDay.entries()].sort()) {
  if (!k) continue;
  console.log(k, rows.length);
  if (k === todayLocal || k?.includes('2026-07-24') || k?.includes('2026-07-25')) {
    for (const r of rows.slice(0, 15)) {
      console.log('  ', {
        mal: r.mal_id,
        title: r.title_russian || r.title_default,
        next: r.next_episode_date,
        nextUTC: dayKeyUTC(r.next_episode_date),
        status: r.watch_status,
        eps: `${r.watched_episodes}/${r.episodes_aired ?? r.episodes}`,
      });
    }
  }
}

console.log('\n=== rows whose next is within ±2 days of now ===');
const near = withNext.filter((r) => {
  const t = new Date(r.next_episode_date).getTime();
  return Math.abs(t - now.getTime()) < 3 * 24 * 3600 * 1000;
});
for (const r of near.slice(0, 40)) {
  console.log({
    mal: r.mal_id,
    title: (r.title_russian || r.title_default || '').slice(0, 50),
    next: r.next_episode_date,
    localDay: dayKey(r.next_episode_date),
    utcDay: dayKeyUTC(r.next_episode_date),
    watch: r.watch_status,
    watched: r.watched_episodes,
    aired: r.episodes_aired,
    anime_status: r.anime_status,
  });
}

console.log('\n=== 46488 specifically ===');
const t46488 = await sql`
  SELECT ule.id AS entry_id, ule.watch_status, ule.watched_episodes, ule.source_service,
         ac.id, ac.mal_id, ac.title_default, ac.next_episode_date, ac.aired_on,
         ac.episodes_aired, ac.is_censored, ac.status
  FROM anime_catalog ac
  LEFT JOIN user_library_entries ule ON ule.anime_id = ac.id AND ule.user_id = 2
  WHERE ac.mal_id = 46488
`;
console.log(t46488);

console.log('\n=== watching without next_episode_date (sample) ===');
for (const r of withoutNext.filter((x) => x.watch_status === 'watching').slice(0, 20)) {
  console.log({
    mal: r.mal_id,
    title: (r.title_russian || r.title_default || '').slice(0, 50),
    aired_on: r.aired_on,
    eps: `${r.watched_episodes}/${r.episodes_aired ?? '?'}/${r.episodes ?? '?'}`,
    status: r.anime_status,
  });
}

await sql.end({ timeout: 5 });
