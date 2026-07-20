import { NextResponse } from 'next/server';

import { isQueuesEnabled } from '@/lib/config';
import { testConnection } from '@/lib/db';
import { pingRedis } from '@/lib/queue/redis';

function bounded<T>(promise: Promise<T>, timeoutMs = 5_000) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Readiness check timed out')), timeoutMs)
    ),
  ]);
}

export async function GET() {
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {
    database: 'error',
    redis: 'skipped',
  };

  const databaseCheck = bounded(testConnection())
    .then((ok) => {
      checks.database = ok ? 'ok' : 'error';
    })
    .catch(() => {
      checks.database = 'error';
    });
  const redisCheck = isQueuesEnabled()
    ? bounded(pingRedis())
        .then((ok) => {
          checks.redis = ok ? 'ok' : 'error';
        })
        .catch(() => {
          checks.redis = 'error';
        })
    : Promise.resolve();
  await Promise.all([databaseCheck, redisCheck]);

  const isReady =
    checks.database === 'ok' &&
    (checks.redis === 'ok' || checks.redis === 'skipped');

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: isReady ? 200 : 503 }
  );
}
