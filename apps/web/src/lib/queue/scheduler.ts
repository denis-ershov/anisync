import { Queue } from 'bullmq';

import { createLogger } from '@/lib/observability/logger';
import { closeQueues } from '@/lib/queue/queues';
import { getBullMqPrefix, getQueueConnectionOptions } from '@/lib/queue/redis';
import { JOB_NAMES, QUEUE_NAMES } from '@/lib/queue/names';

const log = createLogger('queue:scheduler');

/** Open queues kept so the Node process does not drain and exit. */
let keepAliveQueues: Queue[] = [];

export async function registerRepeatableJobs() {
  const connection = getQueueConnectionOptions();
  const prefix = getBullMqPrefix();

  const cleanupQueue = new Queue(QUEUE_NAMES.maintenanceCleanup, {
    connection,
    prefix,
  });

  await cleanupQueue.add(
    JOB_NAMES.runMaintenanceCleanup,
    {},
    {
      repeat: {
        pattern: '0 3 * * *',
      },
      jobId: 'maintenance-cleanup-daily',
    }
  );

  const precomputeQueue = new Queue(QUEUE_NAMES.releasesPrecompute, {
    connection,
    prefix,
  });

  await precomputeQueue.add(
    JOB_NAMES.precomputeReleasesCatalog,
    {},
    {
      repeat: {
        pattern: '*/30 * * * *',
      },
      jobId: 'releases-precompute-catalog',
    }
  );

  const watchlistRefreshQueue = new Queue(QUEUE_NAMES.releasesWatchlistRefresh, {
    connection,
    prefix,
  });

  await watchlistRefreshQueue.add(
    JOB_NAMES.refreshReleaseWatchlist,
    {},
    {
      repeat: {
        pattern: '0 * * * *',
      },
      jobId: 'releases-watchlist-refresh-hourly',
    }
  );

  const torrentWatcherQueue = new Queue(QUEUE_NAMES.torrentsWatcher, {
    connection,
    prefix,
  });

  await torrentWatcherQueue.add(
    JOB_NAMES.runTorrentWatcherScan,
    {},
    {
      repeat: {
        pattern: '*/30 * * * *',
      },
      jobId: 'torrents-watcher-scan',
    }
  );

  // Не закрываем очереди: иначе нет активных Redis-хендлов и Node сразу exit 0
  // (Docker restart loop). Repeatable jobs уже в Redis; соединения держат процесс живым.
  keepAliveQueues = [cleanupQueue, precomputeQueue, watchlistRefreshQueue, torrentWatcherQueue];

  log.info('Repeatable scheduler jobs registered');
}

export async function shutdownScheduler() {
  await Promise.all(
    keepAliveQueues.map(async (queue) => {
      await queue.close().catch(() => undefined);
    })
  );
  keepAliveQueues = [];
  await closeQueues();
  log.info('Scheduler stopped');
}
