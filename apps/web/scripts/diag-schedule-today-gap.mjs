/**
 * Ищем тайтлы, у которых серия вероятно вышла сегодня,
 * но next_episode_date уже указывает на следующую неделю.
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
    } catch {}
  }
}

loadEnv();
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const now = new Date();
const todayDow = now.getDay(); // 0 Sun .. 5 Fri
console.log('now', now.toISOString(), 'dow', todayDow);

const rows = await sql`
  SELECT ac.mal_id, ac.title_russian, ac.title_default, ac.next_episode_date,
         ac.episodes_aired, ac.episodes, ule.watched_episodes, ule.watch_status,
         ac.status
  FROM user_library_entries ule
  JOIN anime_catalog ac ON ac.id = ule.anime_id
  WHERE ule.user_id = 2 AND ule.watch_status IN ('watching','rewatching','planned')
`;

function parseNext(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

console.log('\n=== next weekday == today (likely jumped after airing) ===');
for (const r of rows) {
  const next = parseNext(r.next_episode_date);
  if (!next) continue;
  const daysUntil = (startOfDay(next) - startOfDay(now)) / 86400000;
  // next episode same weekday in 6-8 days → previous slot was ~today
  if (next.getDay() === todayDow && daysUntil >= 6 && daysUntil <= 8) {
    console.log({
      mal: r.mal_id,
      title: (r.title_russian || r.title_default || '').slice(0, 55),
      next: r.next_episode_date,
      daysUntil: Math.round(daysUntil),
      watched: r.watched_episodes,
      aired: r.episodes_aired,
      unwatched: (r.episodes_aired ?? 0) - (r.watched_episodes ?? 0),
    });
  }
}

console.log('\n=== unwatched episodes (aired > watched) ===');
for (const r of rows) {
  const aired = r.episodes_aired ?? 0;
  const watched = r.watched_episodes ?? 0;
  if (aired > watched) {
    const next = parseNext(r.next_episode_date);
    console.log({
      mal: r.mal_id,
      title: (r.title_russian || r.title_default || '').slice(0, 55),
      watched,
      aired,
      next: r.next_episode_date,
      nextDow: next?.getDay(),
      daysUntil: next ? Math.round((startOfDay(next) - startOfDay(now)) / 86400000) : null,
    });
  }
}

console.log('\n=== Friday next dates (today is Friday) ===');
for (const r of rows) {
  const next = parseNext(r.next_episode_date);
  if (!next) continue;
  if (next.getDay() === 5) {
    console.log({
      mal: r.mal_id,
      title: (r.title_russian || r.title_default || '').slice(0, 55),
      next: r.next_episode_date,
      daysUntil: Math.round((startOfDay(next) - startOfDay(now)) / 86400000),
      watched: r.watched_episodes,
      aired: r.episodes_aired,
    });
  }
}

// Probe Shikimori calendar for today?
const [shiki] = await sql`
  SELECT access_token FROM user_integrations WHERE service_name='shikimori' AND access_token IS NOT NULL LIMIT 1
`;
const base = (process.env.SHIKIMORI_BASE_URL || 'https://shikimori.io').replace(/\/+$/, '');

// GraphQL calendar?
const g = await fetch(`${base}/api/graphql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'AniSync',
    Authorization: `Bearer ${shiki.access_token}`,
  },
  body: JSON.stringify({
    query: `{
      animes(ids: "57466,60310,61048,21,46488", limit: 10) {
        id malId name russian nextEpisodeAt episodesAired
      }
    }`,
  }),
});
console.log('\n=== live shiki nextEpisodeAt sample ===');
console.log(JSON.stringify(await g.json(), null, 2));

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

await sql.end({ timeout: 5 });
