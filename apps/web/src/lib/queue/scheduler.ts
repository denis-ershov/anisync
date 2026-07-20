import { Queue } from 'bullmq';

import { createLogger } from '@/lib/observability/logger';
import { closeQueues } from '@/lib/queue/queues';
import { getBullMqPrefix, getQueueConnectionOptions } from '@/lib/queue/redis';
import { JOB_NAMES, QUEUE_NAMES } from '@/lib/queue/names';

const log = createLogger('queue:scheduler');

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

  await precomputeQueue.close();
  await watchlistRefreshQueue.close();
  await torrentWatcherQueue.close();

  log.info('Repeatable scheduler jobs registered');
  await cleanupQueue.close();
}

export async function shutdownScheduler() {
  await closeQueues();
  log.info('Scheduler stopped');
}
