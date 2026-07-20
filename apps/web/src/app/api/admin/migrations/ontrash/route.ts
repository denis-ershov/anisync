import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { requireAdminUser } from '@/lib/api/auth';
import { db } from '@/lib/db';

type CountRow = { c: number };

async function countQuery(fragment: ReturnType<typeof sql>): Promise<number> {
  const rows = (await db.execute(fragment)) as unknown as CountRow[];
  return Number(rows[0]?.c ?? 0);
}

async function migrationStatus() {
  const ontrashMigratedUsers = await countQuery(sql`
    SELECT COUNT(*)::int AS c FROM users WHERE email LIKE '%@ontrash.migrated'
  `);
  const releaseWatchlistEntries = await countQuery(sql`
    SELECT COUNT(*)::int AS c FROM release_watchlist_entries
  `);
  const totalUsers = await countQuery(sql`
    SELECT COUNT(*)::int AS c FROM users
  `);

  return {
    ontrashMigratedUsers,
    releaseWatchlistEntries,
    totalUsers,
    ontrashDatabaseConfigured: Boolean(process.env.ONTRASH_DATABASE_URL),
  };
}

function resolveRepoRoot() {
  const candidates = [resolve(process.cwd(), '../..'), process.cwd()];
  return (
    candidates.find((p) => existsSync(resolve(p, 'scripts', 'migrate-ontrash-users.ts'))) ||
    process.cwd()
  );
}

function runScript(scriptRelative: string, apply: boolean) {
  return new Promise<{ code: number | null; output: string }>((resolvePromise) => {
    const root = resolveRepoRoot();
    const scriptPath = resolve(root, 'scripts', scriptRelative);
    const child = spawn(
      'pnpm',
      ['exec', 'tsx', scriptPath, apply ? '--apply' : '--dry-run'],
      {
        cwd: root,
        env: process.env,
        shell: true,
      }
    );

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('close', (code) => {
      resolvePromise({ code, output: output.slice(0, 20_000) });
    });
  });
}

function isLegacyOntrashImportEnabled() {
  const raw = process.env.LEGACY_ONTRASH_IMPORT_ENABLED;
  if (!raw) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export async function GET(request: NextRequest) {
  if (!isLegacyOntrashImportEnabled()) {
    return NextResponse.json(
      { error: 'Legacy OnTrash import is disabled (greenfield)' },
      { status: 404 }
    );
  }

  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ status: await migrationStatus() });
}

export async function POST(request: NextRequest) {
  if (!isLegacyOntrashImportEnabled()) {
    return NextResponse.json(
      { error: 'Legacy OnTrash import is disabled (greenfield)' },
      { status: 404 }
    );
  }

  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.ONTRASH_DATABASE_URL) {
    return NextResponse.json(
      { error: 'ONTRASH_DATABASE_URL is not configured on the server' },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: 'dry-run' | 'apply';
    step?: 'users' | 'watchlist' | 'all';
  };

  const mode = body.mode === 'apply' ? 'apply' : 'dry-run';
  const step = body.step || 'all';
  const apply = mode === 'apply';

  const scripts: string[] = [];
  if (step === 'users' || step === 'all') {
    scripts.push('migrate-ontrash-users.ts');
  }
  if (step === 'watchlist' || step === 'all') {
    scripts.push('migrate-ontrash-watchlist.ts');
  }

  const results: Array<{ script: string; code: number | null; output: string }> = [];
  for (const script of scripts) {
    results.push({ script, ...(await runScript(script, apply)) });
  }

  const status = await migrationStatus();
  const failed = results.some((result) => result.code !== 0);
  return NextResponse.json(
    { ok: !failed, mode, results, status },
    { status: failed ? 500 : 200 }
  );
}
