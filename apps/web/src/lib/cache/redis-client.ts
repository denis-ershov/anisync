import Redis from 'ioredis';

import { env, isQueuesEnabled } from '@/lib/config';
import { createLogger } from '@/lib/observability/logger';
import { getQueueConnectionOptions } from '@/lib/queue/redis';

const log = createLogger('cache:redis');

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!isQueuesEnabled()) {
    return null;
  }

  if (!client) {
    const options = getQueueConnectionOptions();
    client = new Redis({
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      db: options.db,
      tls: options.tls,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    client.on('error', (error) => {
      log.error({ err: error }, 'Redis client error');
    });
  }

  return client;
}

export function cacheKey(...parts: string[]) {
  return `${env.BULLMQ_PREFIX}:cache:${parts.join(':')}`;
}

export async function closeRedisClient() {
  if (!client) {
    return;
  }

  await client.quit();
  client = null;
}
