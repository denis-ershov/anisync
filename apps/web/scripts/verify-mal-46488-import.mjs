/**
 * После фикса nsfw: 46488 должен быть в MAL schedule-slice и пройти shouldIncludeInScheduleImport.
 * Usage: node apps/web/scripts/verify-mal-46488-import.mjs
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
const MAL_ID = 46488;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

function normalizeMalStatus(status) {
  const map = {
    watching: 'watching',
    completed: 'completed',
    on_hold: 'on_hold',
    dropped: 'dropped',
    plan_to_watch: 'planned',
  };
  return map[status] || 'planned';
}

function isProviderCurrentlyAiring(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (
    normalized === 'currently_airing' ||
    normalized === 'ongoing' ||
    normalized === 'releasing' ||
    normalized === 'airing'
  );
}

function shouldInclude({ watchStatus, status }) {
  if (!['watching', 'planned', 'rewatching'].includes(watchStatus)) return false;
  if (watchStatus === 'watching' || watchStatus === 'rewatching') return true;
  if (watchStatus === 'planned' && isProviderCurrentlyAiring(status)) return true;
  return false;
}

const [mal] = await sql`
  SELECT access_token FROM user_integrations
  WHERE service_name = 'myanimelist' AND access_token IS NOT NULL
  ORDER BY user_id LIMIT 1
`;

async function fetchMalSchedule(nsfw) {
  const entries = [];
  for (const status of ['watching', 'plan_to_watch']) {
    let next = new URL('https://api.myanimelist.net/v2/users/@me/animelist');
    next.searchParams.set('status', status);
    next.searchParams.set(
      'fields',
      'list_status,status,start_date,num_episodes,nsfw'
    );
    next.searchParams.set('limit', '100');
    if (nsfw) next.searchParams.set('nsfw', 'true');

    let url = next.toString();
    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${mal.access_token}` } });
      const json = await res.json();
      for (const row of json.data || []) {
        entries.push({
          malId: row.node.id,
          title: row.node.title,
          watchStatus: normalizeMalStatus(row.list_status?.status),
          status: row.node.status,
          nsfw: row.node.nsfw,
        });
      }
      url = json.paging?.next || null;
    }
  }
  return entries;
}

const before = await fetchMalSchedule(false);
const after = await fetchMalSchedule(true);
const hitBefore = before.find((e) => e.malId === MAL_ID);
const hitAfter = after.find((e) => e.malId === MAL_ID);

console.log('without nsfw: found=', Boolean(hitBefore), 'schedulePass=', hitBefore ? shouldInclude(hitBefore) : null);
console.log('with nsfw: found=', Boolean(hitAfter), hitAfter, 'schedulePass=', hitAfter ? shouldInclude(hitAfter) : null);

const [shiki] = await sql`
  SELECT access_token FROM user_integrations
  WHERE service_name = 'shikimori' AND access_token IS NOT NULL
  ORDER BY user_id LIMIT 1
`;
const base = (process.env.SHIKIMORI_BASE_URL || 'https://shikimori.io').replace(/\/+$/, '');
const g = await fetch(`${base}/api/graphql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'AniSync',
    Authorization: `Bearer ${shiki.access_token}`,
  },
  body: JSON.stringify({
    query: `{ animes(ids: "${MAL_ID}", limit: 1) { id malId isCensored } }`,
  }),
});
const gj = await g.json();
const anime = gj.data?.animes?.[0];
const usable = Boolean(anime?.id) && !anime.isCensored && String(anime.malId) === String(MAL_ID);
console.log('shiki probe:', anime, 'usableOnPrimary=', usable, '→ gapImportAllowed=', !usable);

const ok = Boolean(hitAfter) && shouldInclude(hitAfter) && !usable;
console.log(ok ? '\nPASS: после фикса 46488 должен импортироваться с MAL secondary' : '\nFAIL');

await sql.end({ timeout: 5 });
process.exit(ok ? 0 : 1);
