/**
 * Smoke-check TMDB + Prowlarr using root `.env` (greenfield integrations).
 * Usage: pnpm exec tsx scripts/probe-integrations.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path: string) {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv(resolve('E:/DEV/Project/anisync/.env'));

async function checkTmdb(apiKey: string | undefined) {
  if (!apiKey) {
    return { ok: false, detail: 'TMDB_API_KEY missing' };
  }
  const key = apiKey.replace(/^["']|["']$/g, '');
  const useBearer = key.startsWith('eyJ') || key.split('.').length >= 3;
  const url = 'https://api.themoviedb.org/3/configuration';
  const response = await fetch(
    useBearer ? url : `${url}?api_key=${encodeURIComponent(key)}`,
    {
      headers: useBearer ? { Authorization: `Bearer ${key}` } : undefined,
    }
  );
  return {
    ok: response.ok,
    detail: `${response.status} (auth=${useBearer ? 'bearer' : 'api_key'})`,
  };
}

async function checkProwlarr(baseUrl: string | undefined, apiKey: string | undefined) {
  if (!baseUrl || !apiKey) {
    return { ok: false, detail: 'PROWLARR_URL / PROWLARR_API_KEY missing' };
  }
  const root = baseUrl.replace(/\/$/, '');
  try {
    const response = await fetch(
      `${root}/api/v1/system/status?apikey=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    let version: string | undefined;
    if (response.ok) {
      const body = (await response.json()) as { version?: string };
      version = body.version;
    }
    return {
      ok: response.ok,
      detail: version ? `${response.status} v${version}` : String(response.status),
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'unreachable',
    };
  }
}

async function main() {
  let tmdb: { ok: boolean; detail: string };
  try {
    tmdb = await checkTmdb(process.env.TMDB_API_KEY);
  } catch (error) {
    tmdb = {
      ok: false,
      detail: error instanceof Error ? error.message : 'unreachable',
    };
  }
  const prowlarr = await checkProwlarr(process.env.PROWLARR_URL, process.env.PROWLARR_API_KEY);

  console.log(JSON.stringify({ tmdb, prowlarr }, null, 2));

  if (!tmdb.ok) {
    process.exitCode = 1;
  }
  // Prowlarr may be firewalled from local network — warn only
  if (!prowlarr.ok) {
    console.warn('WARN: Prowlarr unreachable from this host (often OK if only Coolify/VPS can reach it)');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
