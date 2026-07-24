import { Worker, type Job } from 'bullmq';

import { createLogger } from '@/lib/observability/logger';
import { runRetentionCleanup } from '@/lib/maintenance/retention';
import { closeQueues } from '@/lib/queue/queues';
import { getBullMqPrefix, getQueueConnectionOptions } from '@/lib/queue/redis';
import { JOB_NAMES, QUEUE_NAMES } from '@/lib/queue/names';
import { getModuleJobsRegistry } from '@/modules/registry';
import { ReleaseWatchlistRefreshService } from '@/lib/services/release-watchlist-refresh-service';
import { ReleasesPrecomputeService } from '@/lib/services/releases-precompute-service';
import { SyncService } from '@/lib/services/sync-service';
import { TorrentWatcherService } from '@/lib/services/torrent-watcher-service';

const log = createLogger('queue:worker');

async function handlePrimarySyncJob(job: Job<{ jobId: number }>) {
  const result = await SyncService.processJob(job.data.jobId);
  log.info({ jobId: job.id, syncJobId: job.data.jobId, result }, 'Primary sync job processed');
  return result;
}

async function handleEntrySyncJob(job: Job<{ entryId?: number; changeId?: number }>) {
  if (job.data.changeId) {
    const result = await SyncService.processEntryChange(job.data.changeId);
    log.info({ jobId: job.id, changeId: job.data.changeId }, 'Entry change processed');
    return result;
  }

  if (job.data.entryId) {
    const result = await SyncService.processEntrySyncByEntryId(job.data.entryId);
    log.info({ jobId: job.id, entryId: job.data.entryId }, 'Entry sync processed');
    return result;
  }

  const result = await SyncService.processNextPendingEntrySync();
  log.info({ jobId: job.id, processed: Boolean(result) }, 'Next pending entry sync processed');
  return result;
}

async function handleMaintenanceCleanupJob(job: Job) {
  const result = await runRetentionCleanup();
  log.info({ jobId: job.id, result }, 'Maintenance cleanup executed');
  return result;
}

async function handleReleasesPrecomputeJob(job: Job) {
  const result = await ReleasesPrecomputeService.warmUpcomingCatalog();
  log.info({ jobId: job.id, result }, 'Releases catalog precompute finished');
  return result;
}

async function handleReleaseWatchlistRefreshJob(job: Job) {
  const result = await ReleaseWatchlistRefreshService.refreshShowSchedules();
  log.info({ jobId: job.id, result }, 'Release watchlist refresh finished');
  return result;
}

async function handleTorrentWatcherScanJob(job: Job) {
  const result = await TorrentWatcherService.scanDueItems();
  log.info({ jobId: job.id, result }, 'Torrent watcher scan finished');
  return result;
}

async function handleScheduleRefreshJob(job: Job<{ userId: number }>) {
  const result = await SyncService.refreshScheduleSlice(job.data.userId);
  log.info({ jobId: job.id, userId: job.data.userId, result }, 'Schedule slice refresh finished');
  return result;
}

export function startWorkers() {
  const connection = getQueueConnectionOptions();
  const prefix = getBullMqPrefix();

  const workers = [
    new Worker(QUEUE_NAMES.animeSyncPrimary, handlePrimarySyncJob, {
      connection,
      prefix,
      concurrency: 2,
    }),
    new Worker(QUEUE_NAMES.animeSyncEntry, handleEntrySyncJob, {
      connection,
      prefix,
      concurrency: 4,
    }),
    new Worker(QUEUE_NAMES.animeScheduleRefresh, handleScheduleRefreshJob, {
      connection,
      prefix,
      concurrency: 2,
    }),
    new Worker(QUEUE_NAMES.maintenanceCleanup, handleMaintenanceCleanupJob, {
      connection,
      prefix,
      concurrency: 1,
    }),
    new Worker(QUEUE_NAMES.releasesPrecompute, handleReleasesPrecomputeJob, {
      connection,
      prefix,
      concurrency: 1,
    }),
    new Worker(QUEUE_NAMES.releasesWatchlistRefresh, handleReleaseWatchlistRefreshJob, {
      connection,
      prefix,
      concurrency: 1,
    }),
    new Worker(QUEUE_NAMES.torrentsWatcher, handleTorrentWatcherScanJob, {
      connection,
      prefix,
      concurrency: 1,
    }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job, error) => {
      log.error(
        { jobId: job?.id, name: job?.name, err: error },
        'Queue job failed'
      );
    });
  }

  log.info(
    {
      queues: Object.values(QUEUE_NAMES),
      modules: getModuleJobsRegistry(),
    },
    'BullMQ workers started'
  );
  return workers;
}

export async function shutdownWorkers(workers: Worker[]) {
  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
  log.info('BullMQ workers stopped');
}
