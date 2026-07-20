import { Queue } from 'bullmq';

import { appConfig, env, isQueuesEnabled, type AppEnv } from '@/lib/config';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('queue:redis');

export type QueueConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
  tls?: Record<string, never>;
};

export function getQueueConnectionOptions(source: AppEnv = env): QueueConnectionOptions {
  if (!source.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }

  const url = new URL(source.REDIS_URL);
  const dbPath = url.pathname.replace(/^\//, '');
  const db = dbPath ? Number(dbPath) : undefined;

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    maxRetriesPerRequest: null,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

export function getBullMqPrefix() {
  return appConfig.bullmqPrefix;
}

export async function pingRedis(source: AppEnv = env) {
  if (!isQueuesEnabled(source)) {
    return false;
  }

  const queue = new Queue('health-check', {
    connection: getQueueConnectionOptions(source),
    prefix: getBullMqPrefix(),
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      queue.waitUntilReady(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis health check timed out')), 5_000);
      }),
    ]);
    return true;
  } catch (error) {
    log.error({ err: error }, 'Redis ping failed');
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
    await queue.disconnect().catch(() => undefined);
  }
}
