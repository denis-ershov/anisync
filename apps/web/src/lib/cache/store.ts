import { cacheKey, getRedisClient } from '@/lib/cache/redis-client';

type MemoryEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryEntry>();

function readMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return JSON.parse(entry.value) as T;
}

function writeMemory(key: string, value: unknown, ttlMs: number) {
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt <= now) {
        memoryCache.delete(k);
      }
    }
    // Если после очистки просроченных всё ещё > 1000, удаляем старейшие
    if (memoryCache.size > 1000) {
      const excess = memoryCache.size - 800;
      let count = 0;
      for (const k of memoryCache.keys()) {
        memoryCache.delete(k);
        count++;
        if (count >= excess) break;
      }
    }
  }

  memoryCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value: JSON.stringify(value),
  });
}

export async function cacheRead<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  const namespacedKey = cacheKey(key);

  if (redis) {
    try {
      if (redis.status !== 'ready') {
        await redis.connect();
      }

      const raw = await redis.get(namespacedKey);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Fall back to in-process cache when Redis is unavailable.
    }
  }

  return readMemory<T>(namespacedKey);
}

export async function cacheWrite(key: string, value: unknown, ttlMs: number): Promise<void> {
  const redis = getRedisClient();
  const namespacedKey = cacheKey(key);
  const payload = JSON.stringify(value);

  writeMemory(namespacedKey, value, ttlMs);

  if (!redis) {
    return;
  }

  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }

    await redis.set(namespacedKey, payload, 'PX', ttlMs);
  } catch {
    // In-process cache already updated.
  }
}
