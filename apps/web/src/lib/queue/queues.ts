import { Queue } from 'bullmq';

import { getBullMqPrefix, getQueueConnectionOptions } from '@/lib/queue/redis';
import { JOB_NAMES, QUEUE_NAMES, type QueueName } from '@/lib/queue/names';

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName) {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const queue = new Queue(name, {
    connection: getQueueConnectionOptions(),
    prefix: getBullMqPrefix(),
    defaultJobOptions: {
      removeOnComplete: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 30 * 24 * 60 * 60,
        count: 5000,
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  queues.set(name, queue);
  return queue;
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

export async function enqueuePrimarySyncJob(jobId: number) {
  const queue = getQueue(QUEUE_NAMES.animeSyncPrimary);
  await queue.add(
    JOB_NAMES.processSyncJob,
    { jobId },
    {
      jobId: `sync-job-${jobId}`,
    }
  );
}

export async function enqueueEntrySync(payload: { entryId?: number; changeId?: number } = {}) {
  const queue = getQueue(QUEUE_NAMES.animeSyncEntry);
  const jobId = payload.entryId
    ? `entry-sync-entry-${payload.entryId}`
    : payload.changeId
      ? `entry-sync-change-${payload.changeId}`
      : `entry-sync-next-${Date.now()}`;

  await queue.add(JOB_NAMES.processEntrySync, payload, { jobId });
}

export async function enqueueMaintenanceCleanup() {
  const queue = getQueue(QUEUE_NAMES.maintenanceCleanup);
  await queue.add(JOB_NAMES.runMaintenanceCleanup, {}, { jobId: `cleanup-${Date.now()}` });
}

export async function enqueueReleasesPrecompute() {
  const queue = getQueue(QUEUE_NAMES.releasesPrecompute);
  await queue.add(
    JOB_NAMES.precomputeReleasesCatalog,
    {},
    {
      jobId: 'releases-precompute-catalog',
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

export async function enqueueReleaseWatchlistRefresh() {
  const queue = getQueue(QUEUE_NAMES.releasesWatchlistRefresh);
  await queue.add(
    JOB_NAMES.refreshReleaseWatchlist,
    {},
    {
      jobId: 'releases-watchlist-refresh',
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

export async function enqueueTorrentWatcherScan() {
  const queue = getQueue(QUEUE_NAMES.torrentsWatcher);
  await queue.add(
    JOB_NAMES.runTorrentWatcherScan,
    {},
    {
      jobId: `torrents-watcher-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}
