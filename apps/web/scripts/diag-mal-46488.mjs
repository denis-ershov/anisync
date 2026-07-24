/**
 * Диагностика: почему MAL 46488 не попадает в каталог AniSync.
 * Usage from repo root: node apps/web/scripts/diag-mal-46488.mjs
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

async function shikiGraphql(token, query) {
  const base = (process.env.SHIKIMORI_BASE_URL || 'https://shikimori.one').replace(/\/+$/, '');
  const url = `${base}/api/graphql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AniSync',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

async function shikiRest(token, path) {
  const base = (process.env.SHIKIMORI_BASE_URL || 'https://shikimori.one').replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    headers: {
      'User-Agent': 'AniSync',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

function isUsable(anime) {
  if (!anime?.id) return false;
  if (anime.isCensored || anime.censored) return false;
  return true;
}

try {
  console.log('=== DB: anime_catalog ===');
  const catalog = await sql`
    SELECT id, mal_id, title_default, title_russian, title_english, is_censored, created_at
    FROM anime_catalog
    WHERE mal_id = ${MAL_ID}
       OR title_default ILIKE ${'%Tai-Ari%'}
       OR title_default ILIKE ${'%Young Ladies Don%'}
       OR title_russian ILIKE ${'%対あり%'}
    LIMIT 20
  `;
  console.log(JSON.stringify(catalog, null, 2));

  console.log('\n=== DB: anime_service_ids ===');
  const sid = await sql`
    SELECT asi.*
    FROM anime_service_ids asi
    LEFT JOIN anime_catalog ac ON ac.id = asi.anime_id
    WHERE asi.external_anime_id = ${String(MAL_ID)}
       OR ac.mal_id = ${MAL_ID}
    ORDER BY asi.service_name
  `;
  console.log(JSON.stringify(sid, null, 2));

  console.log('\n=== DB: user_library_entries ===');
  const lib = await sql`
    SELECT ule.id, ule.user_id, ule.anime_id, ule.watch_status, ule.watched_episodes,
           ule.source_service, ule.source_entry_id, ule.out_of_sync,
           ac.mal_id, ac.title_default, ac.is_censored
    FROM user_library_entries ule
    JOIN anime_catalog ac ON ac.id = ule.anime_id
    WHERE ac.mal_id = ${MAL_ID} OR ule.source_entry_id = ${String(MAL_ID)}
  `;
  console.log(JSON.stringify(lib, null, 2));

  console.log('\n=== DB: user settings + integrations ===');
  const users = await sql`
    SELECT us.user_id, us.primary_service, us.secondary_service, u.email
    FROM user_settings us
    LEFT JOIN users u ON u.id = us.user_id
    ORDER BY us.user_id
  `;
  for (const row of users) {
    const ints = await sql`
      SELECT id, service_name,
             (access_token IS NOT NULL AND access_token <> '') AS has_token,
             left(access_token, 8) AS token_prefix,
             updated_at
      FROM user_integrations WHERE user_id = ${row.user_id}
      ORDER BY service_name
    `;
    console.log(JSON.stringify({ ...row, integrations: ints }, null, 2));
  }

  const tokenRow = await sql`
    SELECT ui.access_token, ui.user_id
    FROM user_integrations ui
    JOIN user_settings us ON us.user_id = ui.user_id
    WHERE ui.service_name = 'shikimori'
      AND ui.access_token IS NOT NULL AND ui.access_token <> ''
    ORDER BY CASE WHEN us.primary_service = 'shikimori' THEN 0 ELSE 1 END, ui.user_id
    LIMIT 1
  `;
  const malTokenRow = await sql`
    SELECT ui.access_token, ui.user_id
    FROM user_integrations ui
    WHERE ui.service_name = 'myanimelist'
      AND ui.access_token IS NOT NULL AND ui.access_token <> ''
    ORDER BY ui.user_id
    LIMIT 1
  `;

  const shikiToken = tokenRow[0]?.access_token || null;
  const malToken = malTokenRow[0]?.access_token || null;
  console.log('\n=== Tokens ===');
  console.log({
    shikiUserId: tokenRow[0]?.user_id ?? null,
    malUserId: malTokenRow[0]?.user_id ?? null,
    hasShiki: Boolean(shikiToken),
    hasMal: Boolean(malToken),
  });

  console.log('\n=== Shikimori REST /api/animes?mal_id=46488 ===');
  const rest = await shikiRest(shikiToken, `/api/animes?mal_id=${MAL_ID}&limit=5`);
  console.log(JSON.stringify({ status: rest.status, json: rest.json }, null, 2));

  const restId = Array.isArray(rest.json) && rest.json[0]?.id ? String(rest.json[0].id) : null;
  console.log('\n=== Shikimori GraphQL ===');
  const gMal = await shikiGraphql(
    shikiToken,
    `{ animes(malId: ${MAL_ID}, limit: 5) { id malId name russian isCensored kind status episodes } }`
  );
  console.log('by malId:', JSON.stringify({ status: gMal.status, json: gMal.json }, null, 2));

  if (restId) {
    const gId = await shikiGraphql(
      shikiToken,
      `{ animes(ids: "${restId}", limit: 1) { id malId name russian isCensored kind status } }`
    );
    console.log('by ids:', JSON.stringify({ status: gId.status, json: gId.json }, null, 2));
    const anime = gId.json?.data?.animes?.[0];
    console.log('usableOnPrimary(probe):', isUsable(anime), 'anime=', anime);
  }

  // search by name
  const gSearch = await shikiGraphql(
    shikiToken,
    `{ animes(search: "対ありでした", limit: 5) { id malId name russian isCensored kind status } }`
  );
  console.log('search 対あり:', JSON.stringify({ status: gSearch.status, json: gSearch.json }, null, 2));

  if (malToken) {
    console.log('\n=== MAL API ===');
    const malAnime = await fetch(
      `https://api.myanimelist.net/v2/anime/${MAL_ID}?fields=id,title,status,num_episodes,start_date,my_list_status`,
      { headers: { Authorization: `Bearer ${malToken}` } }
    );
    console.log(JSON.stringify({ status: malAnime.status, json: await malAnime.json().catch(() => ({})) }, null, 2));

    const malList = await fetch(
      `https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,num_episodes,status,start_date&limit=1000&nsfw=true`,
      { headers: { Authorization: `Bearer ${malToken}` } }
    );
    const malListJson = await malList.json().catch(() => ({}));
    const hit = (malListJson.data || []).find((row) => row.node?.id === MAL_ID);
    console.log('in MAL user list:', hit ? JSON.stringify(hit, null, 2) : `NOT FOUND (list size=${(malListJson.data || []).length})`);
  }

  console.log('\n=== Recent sync jobs ===');
  const jobs = await sql`
    SELECT id, user_id, status, direction, primary_service, error, summary, created_at, finished_at
    FROM sync_jobs
    ORDER BY created_at DESC
    LIMIT 8
  `;
  console.log(JSON.stringify(jobs, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}

console.log('\nDone.');
