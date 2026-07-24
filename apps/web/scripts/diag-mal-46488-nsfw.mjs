/**
 * Проверка гипотез для MAL 46488: nsfw list + shiki mal_id REST.
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

const [mal] = await sql`
  SELECT access_token FROM user_integrations
  WHERE service_name = 'myanimelist' AND access_token IS NOT NULL
  ORDER BY user_id LIMIT 1
`;
const token = mal.access_token;

async function listWatching(nsfw) {
  const url = new URL('https://api.myanimelist.net/v2/users/@me/animelist');
  url.searchParams.set('status', 'watching');
  url.searchParams.set('fields', 'list_status,status,nsfw');
  url.searchParams.set('limit', '100');
  if (nsfw) url.searchParams.set('nsfw', 'true');

  const ids = [];
  let next = url.toString();
  while (next) {
    const res = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    for (const row of json.data || []) ids.push(row.node.id);
    next = json.paging?.next || null;
  }
  return ids;
}

const without = await listWatching(false);
const withNsfw = await listWatching(true);

console.log('watching without nsfw:', without.length, 'has 46488:', without.includes(MAL_ID));
console.log('watching with nsfw=true:', withNsfw.length, 'has 46488:', withNsfw.includes(MAL_ID));
console.log(
  'only with nsfw:',
  withNsfw.filter((id) => !without.includes(id)).slice(0, 30)
);

// Shiki REST mal_id param behavior
const base = (process.env.SHIKIMORI_BASE_URL || 'https://shikimori.io').replace(/\/+$/, '');
const [shiki] = await sql`
  SELECT access_token FROM user_integrations
  WHERE service_name = 'shikimori' AND access_token IS NOT NULL
  ORDER BY user_id LIMIT 1
`;
const shikiTok = shiki.access_token;

for (const path of [
  `/api/animes?mal_id=${MAL_ID}&limit=3`,
  `/api/animes?search=${encodeURIComponent('Tai-Ari deshita')}&limit=3`,
  `/api/animes/${MAL_ID}`,
]) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'User-Agent': 'AniSync', Authorization: `Bearer ${shikiTok}` },
  });
  const json = await res.json();
  const summary = Array.isArray(json)
    ? json.map((a) => ({ id: a.id, name: a.name, mal_id: a.mal_id, censored: a.censored }))
    : { id: json.id, name: json.name, mal_id: json.mal_id, censored: json.censored, code: json.code };
  console.log('\n', path, '→', JSON.stringify(summary, null, 2));
}

await sql.end({ timeout: 5 });
