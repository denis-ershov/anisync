import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  animeCatalog,
  animeServiceIds,
  syncJobAttempts,
  syncJobs,
  userEntryChanges,
  userIntegrations,
  userLibraryEntries,
  type SyncJob,
  type UserEntryChange,
  type UserIntegration,
} from '@/lib/db';
import { appConfig, env, isQueuesEnabled } from '@/lib/config';
import {
  enqueueEntrySync,
  enqueueEntrySyncDrain,
  enqueuePrimarySyncJob,
  enqueueScheduleRefresh,
  getScheduleRefreshJobState,
} from '@/lib/queue/queues';
import { createLogger } from '@/lib/observability/logger';
import { getProvider, probeShikimoriAnimeExists, resolveAniListIdsByMal, resolveShikimoriIdByMalId } from '@/lib/integrations/providers';
import { filterLibraryForPrimaryAuthoritativeImport } from '@/lib/integrations/library-schedule-import';
import type {
  IntegrationServiceName,
  LibraryStatus,
  ProviderDeletePayload,
  ProviderLibraryEntry,
  ProviderSearchResult,
  ProviderUpdatePayload,
} from '@/lib/integrations/provider-types';
import {
  isPrimaryWriteUnavailableStatus,
  isProviderHttpError,
} from '@/lib/integrations/provider-types';
import { IntegrationService } from '@/lib/services/integration-service';
import { LibraryService } from '@/lib/services/library-service';
import { UserSettingsService } from '@/lib/services/user-service';

export const STALE_SYNC_JOB_TIMEOUT_MS = 30 * 60 * 1000;

const log = createLogger('sync-service');
const scheduleRefreshInFlight = new Set<number>();

export type ScheduleSyncStatus = 'idle' | 'queued' | 'running';

type ClaimedIdRow = { id: number };

function claimedId(rows: unknown): number | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const first = rows[0] as ClaimedIdRow;
  return typeof first?.id === 'number' ? first.id : Number(first?.id) || null;
}

export function isRunningSyncJobStale(
  startedAt?: Date | string | null,
  now: Date = new Date(),
  timeoutMs: number = STALE_SYNC_JOB_TIMEOUT_MS
) {
  if (!startedAt) {
    return false;
  }

  const started = new Date(startedAt);
  return now.getTime() - started.getTime() > timeoutMs;
}

type ProviderSyncResult = {
  serviceName: string;
  status: 'completed' | 'failed' | 'skipped';
  entryId?: string | null;
  error?: string;
};

export class SyncService {
  private static buildInternalUrl(pathname: string, origin?: string) {
    const baseUrl = (origin || appConfig.appBaseUrl).replace(/\/+$/, '');
    return `${baseUrl}${pathname}`;
  }

  static async createJob(
    userId: number,
    primaryService: IntegrationServiceName,
    direction: string = 'primary_import'
  ) {
    const [job] = await db
      .insert(syncJobs)
      .values({
        userId,
        primaryService,
        status: 'pending',
        direction,
        summary: {},
        createdAt: new Date(),
      })
      .returning();

    return job;
  }

  static async getJobById(jobId: number, userId?: number) {
    const whereClause = userId
      ? and(eq(syncJobs.id, jobId), eq(syncJobs.userId, userId))
      : eq(syncJobs.id, jobId);
    const [job] = await db.select().from(syncJobs).where(whereClause).limit(1);
    if (!job) {
      return null;
    }

    const attempts = await db
      .select()
      .from(syncJobAttempts)
      .where(eq(syncJobAttempts.syncJobId, job.id))
      .orderBy(asc(syncJobAttempts.createdAt));

    return {
      ...job,
      attempts,
    };
  }

  /**
   * Обзор очереди для UI интеграций: jobs + entry-задачи с названиями тайтлов.
   */
  static async getSyncQueueOverview(userId: number) {
    const recentJobs = await db
      .select({
        id: syncJobs.id,
        status: syncJobs.status,
        direction: syncJobs.direction,
        primaryService: syncJobs.primaryService,
        summary: syncJobs.summary,
        error: syncJobs.error,
        startedAt: syncJobs.startedAt,
        finishedAt: syncJobs.finishedAt,
        createdAt: syncJobs.createdAt,
      })
      .from(syncJobs)
      .where(eq(syncJobs.userId, userId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(20);

    const activeEntryRows = await db
      .select({
        id: userEntryChanges.id,
        libraryEntryId: userEntryChanges.libraryEntryId,
        changeType: userEntryChanges.changeType,
        status: userEntryChanges.status,
        createdAt: userEntryChanges.createdAt,
        syncedAt: userEntryChanges.syncedAt,
        animeId: userLibraryEntries.animeId,
        outOfSync: userLibraryEntries.outOfSync,
        titleDefault: animeCatalog.titleDefault,
        titleRussian: animeCatalog.titleRussian,
        titleEnglish: animeCatalog.titleEnglish,
      })
      .from(userEntryChanges)
      .innerJoin(userLibraryEntries, eq(userEntryChanges.libraryEntryId, userLibraryEntries.id))
      .innerJoin(animeCatalog, eq(userLibraryEntries.animeId, animeCatalog.id))
      .where(
        and(
          eq(userEntryChanges.userId, userId),
          inArray(userEntryChanges.status, ['pending', 'processing', 'failed'])
        )
      )
      .orderBy(desc(userEntryChanges.createdAt))
      .limit(40);

    const recentSyncedRows = await db
      .select({
        id: userEntryChanges.id,
        libraryEntryId: userEntryChanges.libraryEntryId,
        changeType: userEntryChanges.changeType,
        status: userEntryChanges.status,
        createdAt: userEntryChanges.createdAt,
        syncedAt: userEntryChanges.syncedAt,
        animeId: userLibraryEntries.animeId,
        outOfSync: userLibraryEntries.outOfSync,
        titleDefault: animeCatalog.titleDefault,
        titleRussian: animeCatalog.titleRussian,
        titleEnglish: animeCatalog.titleEnglish,
      })
      .from(userEntryChanges)
      .innerJoin(userLibraryEntries, eq(userEntryChanges.libraryEntryId, userLibraryEntries.id))
      .innerJoin(animeCatalog, eq(userLibraryEntries.animeId, animeCatalog.id))
      .where(and(eq(userEntryChanges.userId, userId), eq(userEntryChanges.status, 'synced')))
      .orderBy(desc(userEntryChanges.syncedAt))
      .limit(10);

    const [outOfSyncCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userLibraryEntries)
      .where(and(eq(userLibraryEntries.userId, userId), eq(userLibraryEntries.outOfSync, true)));

    const mapEntryTask = (row: (typeof activeEntryRows)[number]) => ({
      id: row.id,
      kind: 'entry_change' as const,
      libraryEntryId: row.libraryEntryId,
      animeId: row.animeId,
      title: row.titleRussian || row.titleEnglish || row.titleDefault || `#${row.animeId}`,
      changeType: row.changeType,
      status: row.status,
      outOfSync: row.outOfSync,
      createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
      syncedAt: row.syncedAt ? row.syncedAt.toISOString?.() ?? String(row.syncedAt) : null,
    });

    const jobs = recentJobs.map((job) => ({
      id: job.id,
      kind: 'sync_job' as const,
      status: job.status,
      direction: job.direction,
      primaryService: job.primaryService,
      summary: job.summary || {},
      error: job.error,
      startedAt: job.startedAt ? job.startedAt.toISOString?.() ?? String(job.startedAt) : null,
      finishedAt: job.finishedAt ? job.finishedAt.toISOString?.() ?? String(job.finishedAt) : null,
      createdAt: job.createdAt?.toISOString?.() ?? String(job.createdAt),
    }));

    const [jobsPendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncJobs)
      .where(and(eq(syncJobs.userId, userId), eq(syncJobs.status, 'pending')));
    const [jobsRunningRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncJobs)
      .where(and(eq(syncJobs.userId, userId), eq(syncJobs.status, 'running')));
    const [entryPendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userEntryChanges)
      .where(and(eq(userEntryChanges.userId, userId), eq(userEntryChanges.status, 'pending')));
    const [entryProcessingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userEntryChanges)
      .where(and(eq(userEntryChanges.userId, userId), eq(userEntryChanges.status, 'processing')));
    const [entryFailedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userEntryChanges)
      .where(and(eq(userEntryChanges.userId, userId), eq(userEntryChanges.status, 'failed')));

    const counts = {
      jobsPending: Number(jobsPendingRow?.count || 0),
      jobsRunning: Number(jobsRunningRow?.count || 0),
      entryPending: Number(entryPendingRow?.count || 0),
      entryProcessing: Number(entryProcessingRow?.count || 0),
      entryFailed: Number(entryFailedRow?.count || 0),
      outOfSync: Number(outOfSyncCountRow?.count || 0),
    };

    const hasActiveWork =
      counts.jobsPending > 0 ||
      counts.jobsRunning > 0 ||
      counts.entryPending > 0 ||
      counts.entryProcessing > 0;

    return {
      queuesEnabled: isQueuesEnabled(),
      hasActiveWork,
      counts,
      jobs,
      entryTasks: [...activeEntryRows.map(mapEntryTask), ...recentSyncedRows.map(mapEntryTask)],
      generatedAt: new Date().toISOString(),
    };
  }

  static async getRecentJobs(userId: number, limit: number = 10) {
    await this.failStaleRunningJobs(userId);

    return db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.userId, userId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(limit);
  }

  static async getActiveJob(userId: number) {
    await this.failStaleRunningJobs(userId);

    const [job] = await db
      .select()
      .from(syncJobs)
      .where(and(eq(syncJobs.userId, userId), inArray(syncJobs.status, ['pending', 'running'])))
      .orderBy(desc(syncJobs.createdAt))
      .limit(1);

    return job || null;
  }

  static async redispatchActiveJob(userId: number, origin?: string) {
    const job = await this.getActiveJob(userId);
    if (!job) {
      return null;
    }

    const isUndispatchedPending = job.status === 'pending' && !job.startedAt;
    if (isUndispatchedPending) {
      const dispatched = await this.dispatchJob(job.id, origin);
      return { job, dispatched };
    }

    return { job, dispatched: false };
  }

  static async enqueuePrimaryImport(userId: number, primaryService: IntegrationServiceName) {
    const activeJob = await this.getActiveJob(userId);
    if (activeJob) {
      return {
        job: activeJob,
        created: false,
      };
    }

    const job = await this.createJob(userId, primaryService, 'primary_import');
    return {
      job,
      created: true,
    };
  }

  static async enqueuePrimaryCatalogPush(userId: number, primaryService: IntegrationServiceName) {
    const activeJob = await this.getActiveJob(userId);
    if (activeJob) {
      return {
        job: activeJob,
        created: false,
      };
    }

    const job = await this.createJob(userId, primaryService, 'primary_catalog_push');
    return {
      job,
      created: true,
    };
  }

  static async dispatchJob(jobId: number, origin?: string) {
    if (isQueuesEnabled()) {
      try {
        await enqueuePrimarySyncJob(jobId);
        return true;
      } catch {
        return false;
      }
    }

    const url = this.buildInternalUrl('/api/internal/sync-jobs/process', origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.CRON_SECRET) {
      headers.Authorization = `Bearer ${env.CRON_SECRET}`;
      headers['x-health-secret'] = env.CRON_SECRET;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId }),
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async dispatchEntrySync(entryId?: number, origin?: string) {
    if (isQueuesEnabled()) {
      try {
        await enqueueEntrySync(entryId ? { entryId } : {});
        return true;
      } catch (error) {
        log.error({ err: error, entryId }, 'Failed to enqueue entry sync');
        return false;
      }
    }

    const url = this.buildInternalUrl('/api/internal/entry-sync/process', origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.CRON_SECRET) {
      headers.Authorization = `Bearer ${env.CRON_SECRET}`;
      headers['x-health-secret'] = env.CRON_SECRET;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(entryId ? { entryId } : {}),
        cache: 'no-store',
      });
      return response.ok;
    } catch (error) {
      log.error({ err: error, entryId }, 'Failed to dispatch entry sync via HTTP');
      return false;
    }
  }

  /**
   * Перепоставить в очередь все pending/failed правки пользователя
   * (или глобальный drain, если userId не задан).
   */
  static async flushPendingEntrySyncs(userId?: number, origin?: string) {
    if (userId) {
      const pending = await db
        .select({
          id: userEntryChanges.id,
          libraryEntryId: userEntryChanges.libraryEntryId,
          status: userEntryChanges.status,
        })
        .from(userEntryChanges)
        .where(
          and(
            eq(userEntryChanges.userId, userId),
            inArray(userEntryChanges.status, ['pending', 'failed', 'processing'])
          )
        )
        .orderBy(asc(userEntryChanges.createdAt))
        .limit(200);

      // Застрявшие processing → снова pending перед enqueue
      const stuckProcessingIds = pending.filter((row) => row.status === 'processing').map((row) => row.id);
      if (stuckProcessingIds.length) {
        await db
          .update(userEntryChanges)
          .set({ status: 'pending' })
          .where(inArray(userEntryChanges.id, stuckProcessingIds));
      }

      const failedIds = pending.filter((row) => row.status === 'failed').map((row) => row.id);
      if (failedIds.length) {
        await db
          .update(userEntryChanges)
          .set({ status: 'pending', syncedAt: null })
          .where(inArray(userEntryChanges.id, failedIds));
      }

      let dispatched = 0;
      const seenEntries = new Set<number>();
      for (const row of pending) {
        if (seenEntries.has(row.libraryEntryId)) {
          continue;
        }
        seenEntries.add(row.libraryEntryId);
        const ok = await this.dispatchEntrySync(row.libraryEntryId, origin);
        if (ok) {
          dispatched += 1;
        }
      }

      // Подстраховка: пакетный drain на случай пропущенных change rows
      if (isQueuesEnabled()) {
        await enqueueEntrySyncDrain(Math.min(Math.max(pending.length, 10), 50));
      } else {
        await this.dispatchEntrySync(undefined, origin);
      }

      return {
        found: pending.length,
        uniqueEntries: seenEntries.size,
        dispatched,
      };
    }

    if (isQueuesEnabled()) {
      await enqueueEntrySyncDrain(50);
      return { found: null, uniqueEntries: null, dispatched: 1 };
    }

    await this.dispatchEntrySync(undefined, origin);
    return { found: null, uniqueEntries: null, dispatched: 1 };
  }

  static async processJob(jobId: number) {
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return {
        jobId: job.id,
        status: job.status,
        imported: Number(job.summary?.imported || 0),
      };
    }

    if (job.direction === 'primary_catalog_push') {
      return this.runPrimaryCatalogPush(job.userId, job.primaryService as IntegrationServiceName, job);
    }

    return this.runPrimaryImport(job.userId, job.primaryService as IntegrationServiceName, job);
  }

  static async processNextPendingJob() {
    const claimed = await db.execute(sql`
      UPDATE sync_jobs AS sj
      SET status = 'running',
          started_at = COALESCE(sj.started_at, NOW())
      WHERE sj.id = (
        SELECT id
        FROM sync_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING sj.id
    `);

    const jobId = claimedId(claimed);
    if (!jobId) {
      return null;
    }

    return this.processJob(jobId);
  }

  static async processEntryChange(changeId: number) {
    const [change] = await db
      .select()
      .from(userEntryChanges)
      .where(eq(userEntryChanges.id, changeId))
      .limit(1);

    if (!change) {
      throw new Error(`Entry change ${changeId} not found`);
    }

    if (change.status === 'synced' || change.status === 'local_only') {
      return {
        changeId: change.id,
        status: change.status,
      };
    }

    return this.processEntrySyncForEntry(change.userId, change.libraryEntryId, change);
  }

  static async processNextPendingEntrySync() {
    const claimed = await db.execute(sql`
      UPDATE user_entry_changes AS uec
      SET status = 'processing'
      WHERE uec.id = (
        SELECT id
        FROM user_entry_changes
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING uec.id
    `);

    const changeId = claimedId(claimed);
    if (!changeId) {
      return null;
    }

    return this.processEntryChange(changeId);
  }

  static async processEntrySyncByEntryId(entryId: number) {
    const [change] = await db
      .select()
      .from(userEntryChanges)
      .where(and(eq(userEntryChanges.libraryEntryId, entryId), inArray(userEntryChanges.status, ['pending', 'processing'])))
      .orderBy(asc(userEntryChanges.createdAt))
      .limit(1);

    if (!change) {
      return null;
    }

    return this.processEntrySyncForEntry(change.userId, change.libraryEntryId, change);
  }

  static async runPrimaryImport(userId: number, primaryService: IntegrationServiceName, existingJob?: SyncJob) {
    const job = existingJob || (await this.createJob(userId, primaryService));
    await db
      .update(syncJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(syncJobs.id, job.id));

    let attempt: Awaited<ReturnType<typeof this.startAttempt>> | null = null;

    try {
      const integration = await IntegrationService.getIntegrationByUserAndService(userId, primaryService);
      if (!integration) {
        throw new Error(`Primary integration ${primaryService} is not connected`);
      }

      await IntegrationService.refreshTokenIfNeeded(integration);
      attempt = await this.startAttempt(job.id, primaryService, { type: 'primary_import' });
      const refreshed = await this.refreshScheduleSlice(userId);

      await this.finishAttempt(attempt.id, 'completed', {
        imported: refreshed.imported,
        scope: 'schedule',
        sources: refreshed.sources,
      });
      await db
        .update(syncJobs)
        .set({
          status: 'completed',
          finishedAt: new Date(),
          summary: {
            imported: refreshed.imported,
            scope: 'schedule',
            sources: refreshed.sources,
          },
        })
        .where(eq(syncJobs.id, job.id));

      await LibraryService.createNotification(userId, {
        type: 'sync_completed',
        title: 'Sync completed',
        message: `Imported ${refreshed.imported} watching (incl. catching-up) and planned (next 2 weeks) titles from ${refreshed.sources.join(', ') || primaryService}.`,
      });

      return {
        jobId: job.id,
        status: 'completed',
        imported: refreshed.imported,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      if (attempt) {
        await this.finishAttempt(attempt.id, 'failed', {}, message);
      }

      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: message,
        })
        .where(eq(syncJobs.id, job.id));

      await LibraryService.createNotification(userId, {
        type: 'sync_failed',
        title: 'Sync failed',
        message,
      });

      throw error;
    }
  }

  /**
   * Полный каталог primary → local upsert + outbound на все остальные connected.
   * Тайтлы, которых нет на primary, не трогаем.
   */
  static async runPrimaryCatalogPush(
    userId: number,
    primaryService: IntegrationServiceName,
    existingJob?: SyncJob
  ) {
    const job = existingJob || (await this.createJob(userId, primaryService, 'primary_catalog_push'));
    await db
      .update(syncJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(syncJobs.id, job.id));

    let attempt: Awaited<ReturnType<typeof this.startAttempt>> | null = null;

    try {
      const integration = await IntegrationService.getIntegrationByUserAndService(userId, primaryService);
      if (!integration?.accessToken) {
        throw new Error(`Primary integration ${primaryService} is not connected`);
      }

      const refreshed = await IntegrationService.refreshTokenIfNeeded(integration);
      attempt = await this.startAttempt(job.id, primaryService, { type: 'primary_catalog_push' });

      const provider = getProvider(primaryService);
      const membership = await provider.fetchLibrary(refreshed, { scope: 'membership' });
      const upserted = await LibraryService.upsertLibraryEntries(userId, primaryService, membership, {
        preserveOutOfSync: true,
      });

      let pushed = 0;
      for (const row of upserted) {
        try {
          await LibraryService.requeueEntrySync(userId, row.id);
          await this.dispatchEntrySync(row.id);
          pushed += 1;
        } catch {
          // best-effort per entry
        }
      }

      const summary = {
        imported: upserted.length,
        pushed,
        scope: 'membership',
        direction: 'primary_catalog_push',
      };

      await this.finishAttempt(attempt.id, 'completed', summary);
      await db
        .update(syncJobs)
        .set({
          status: 'completed',
          finishedAt: new Date(),
          summary,
        })
        .where(eq(syncJobs.id, job.id));

      await LibraryService.createNotification(userId, {
        type: 'sync_completed',
        title: 'Catalog sync completed',
        message: `Synced ${upserted.length} titles from ${primaryService} to other services (${pushed} queued).`,
      });

      return {
        jobId: job.id,
        status: 'completed' as const,
        imported: upserted.length,
        pushed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown catalog sync error';
      if (attempt) {
        await this.finishAttempt(attempt.id, 'failed', {}, message);
      }

      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: message,
        })
        .where(eq(syncJobs.id, job.id));

      await LibraryService.createNotification(userId, {
        type: 'sync_failed',
        title: 'Catalog sync failed',
        message,
      });

      throw error;
    }
  }

  /**
   * Primary (Shikimori) write невозможен (каталог скрыт/удалён, rate «застрял»).
   * DELETE rate на Shiki → source = secondary → push на остальные без Shiki.
   */
  static async recoverFromUnavailablePrimary(
    userId: number,
    entryId: number,
    payload?: ProviderUpdatePayload
  ): Promise<ProviderSyncResult[] | null> {
    const settings = await UserSettingsService.getUserSettings(userId);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!settings?.primaryService || !entry) {
      return null;
    }

    const primaryService = settings.primaryService as IntegrationServiceName;
    if (primaryService !== 'shikimori') {
      return null;
    }

    const integrations = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));
    const connected = integrations.filter((row) => Boolean(row.accessToken));
    const shikiIntegration = connected.find((row) => row.serviceName === 'shikimori');

    if (shikiIntegration && entry.sourceEntryId && entry.sourceService === 'shikimori') {
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(shikiIntegration as UserIntegration);
        await getProvider('shikimori').deleteEntry(refreshed, {
          externalEntryId: entry.sourceEntryId,
          externalAnimeId: null,
        });
      } catch {
        // best-effort delete; 404 already treated as success in fetchVoid
      }
    }

    const secondaryService = (settings.secondaryService as IntegrationServiceName | null) || null;
    const pickFallback = (): IntegrationServiceName | null => {
      const order: IntegrationServiceName[] = [];
      if (secondaryService && secondaryService !== primaryService) {
        order.push(secondaryService);
      }
      for (const name of ['myanimelist', 'anilist', 'shikimori'] as const) {
        if (name !== primaryService && !order.includes(name)) {
          order.push(name);
        }
      }
      for (const name of order) {
        if (connected.some((row) => row.serviceName === name)) {
          return name;
        }
      }
      return null;
    };

    const fallback = pickFallback();
    if (!fallback) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
      await LibraryService.createNotification(userId, {
        animeId: entry.animeId,
        type: 'sync_failed',
        title: 'Shikimori unavailable',
        message: 'Title is unavailable on Shikimori and no secondary service is connected.',
      });
      return [{ serviceName: 'shikimori', status: 'failed' as const, error: 'primary_unavailable_no_fallback' }];
    }

    const serviceIds = await LibraryService.listServiceIdsForAnime([entry.animeId]);
    const fallbackAnimeId =
      serviceIds.find((row) => row.serviceName === fallback)?.externalAnimeId ||
      (fallback === 'myanimelist'
        ? (
            await db
              .select({ malId: animeCatalog.malId })
              .from(animeCatalog)
              .where(eq(animeCatalog.id, entry.animeId))
              .limit(1)
          )[0]?.malId?.toString()
        : null);

    await LibraryService.rebindEntrySource(entry.id, fallback, fallbackAnimeId ? String(fallbackAnimeId) : null);

    const syncPayload: ProviderUpdatePayload = payload || {
      externalAnimeId: fallbackAnimeId || String(entry.animeId),
      externalEntryId: fallbackAnimeId ? String(fallbackAnimeId) : null,
      watchedEpisodes: entry.watchedEpisodes,
      watchStatus: entry.watchStatus,
      personalRating: entry.personalRating,
      notes: entry.notes,
      isFavorite: entry.isFavorite,
      isNotInterested: entry.isNotInterested,
    };

    const results = await this.syncEntryToProviders(userId, entry.id, syncPayload, {
      skipServices: ['shikimori'],
      skipPrimaryRecovery: true,
    });

    await LibraryService.createNotification(userId, {
      animeId: entry.animeId,
      type: 'system',
      title: 'Shikimori unavailable',
      message: `Title is unavailable on Shikimori; sync moved to ${fallback}.`,
    });

    return [
      { serviceName: 'shikimori', status: 'skipped' as const, error: 'primary_unavailable_recovered' },
      ...(results || []),
    ];
  }

  static async syncEntryToProviders(
    userId: number,
    entryId: number,
    payload: ProviderUpdatePayload,
    options?: {
      skipServices?: IntegrationServiceName[];
      skipPrimaryRecovery?: boolean;
    }
  ): Promise<ProviderSyncResult[] | null> {
    const settings = await UserSettingsService.getUserSettings(userId);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!settings?.primaryService || !entry) {
      return null;
    }

    const primaryService = settings.primaryService as IntegrationServiceName;
    const skipServices = new Set(options?.skipServices || []);
    const [anime] = await db
      .select({ malId: animeCatalog.malId })
      .from(animeCatalog)
      .where(eq(animeCatalog.id, entry.animeId))
      .limit(1);

    const serviceIds = await db
      .select()
      .from(animeServiceIds)
      .where(eq(animeServiceIds.animeId, entry.animeId));

    const externalByService = new Map(
      serviceIds.map((row) => [row.serviceName, String(row.externalAnimeId)] as const)
    );

    const integrations = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));

    const rank = (serviceName: string) => {
      if (serviceName === primaryService) return 0;
      if (serviceName === 'myanimelist') return 1;
      if (serviceName === 'anilist') return 2;
      return 3;
    };

    const targets = integrations
      .filter((integration) => Boolean(integration.accessToken))
      .sort((a, b) => rank(a.serviceName) - rank(b.serviceName));

    const results: ProviderSyncResult[] = [];
    let hasLocalOnlyNotes = false;
    let fallbackSource: { serviceName: IntegrationServiceName; entryId: string } | null = null;
    let currentSourceEntryId = entry.sourceEntryId;
    let currentSourceService = entry.sourceService as IntegrationServiceName;

    for (const integration of targets) {
      const serviceName = integration.serviceName as IntegrationServiceName;
      if (skipServices.has(serviceName)) {
        results.push({
          serviceName,
          status: 'skipped',
          error: serviceName === 'shikimori' ? 'primary_unavailable' : 'skipped_by_options',
        });
        continue;
      }

      const provider = getProvider(serviceName);
      const refreshed = await IntegrationService.refreshTokenIfNeeded(integration as UserIntegration);

      const externalAnimeId =
        externalByService.get(serviceName) ||
        (serviceName === 'myanimelist' && anime?.malId ? String(anime.malId) : null) ||
        null;

      const externalEntryId =
        serviceName === currentSourceService ? currentSourceEntryId : null;

      if (!externalAnimeId && !externalEntryId) {
        results.push({
          serviceName,
          status: 'skipped',
          error: 'Missing provider identifiers for update',
        });
        continue;
      }

      if (serviceName === 'shikimori' && !externalEntryId && !externalAnimeId) {
        results.push({
          serviceName,
          status: 'skipped',
          error: 'Missing provider identifiers for update',
        });
        continue;
      }

      const requestPayload: ProviderUpdatePayload = {
        ...payload,
        externalEntryId,
        externalAnimeId: externalAnimeId || payload.externalAnimeId,
      };

      if (payload.notes && !provider.capabilities.supportsNotes) {
        hasLocalOnlyNotes = true;
        results.push({
          serviceName,
          status: 'skipped',
          error: 'Notes are not supported by provider',
        });
        continue;
      }

      try {
        const result = await provider.updateEntry(refreshed, requestPayload);
        results.push({
          serviceName,
          status: 'completed',
          entryId: result.externalEntryId,
        });

        if (result.externalEntryId && externalAnimeId) {
          await LibraryService.ensureServiceIdForAnime(entry.animeId, serviceName, externalAnimeId);
          externalByService.set(serviceName, externalAnimeId);
        }

        if (serviceName === primaryService && result.externalEntryId) {
          currentSourceService = serviceName;
          currentSourceEntryId = String(result.externalEntryId);
          await db
            .update(userLibraryEntries)
            .set({
              sourceService: serviceName,
              sourceEntryId: currentSourceEntryId,
              updatedAt: new Date(),
            })
            .where(eq(userLibraryEntries.id, entry.id));
        } else if (
          !fallbackSource &&
          serviceName !== primaryService &&
          result.externalEntryId
        ) {
          fallbackSource = {
            serviceName,
            entryId: String(result.externalEntryId),
          };
        } else if (
          serviceName === currentSourceService &&
          result.externalEntryId &&
          result.externalEntryId !== currentSourceEntryId
        ) {
          currentSourceEntryId = String(result.externalEntryId);
          await db
            .update(userLibraryEntries)
            .set({
              sourceEntryId: currentSourceEntryId,
              updatedAt: new Date(),
            })
            .where(eq(userLibraryEntries.id, entry.id));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown provider sync error';

        if (
          !options?.skipPrimaryRecovery &&
          serviceName === primaryService &&
          primaryService === 'shikimori' &&
          isProviderHttpError(error) &&
          isPrimaryWriteUnavailableStatus(error.status)
        ) {
          const shikiAnimeId = externalAnimeId || payload.externalAnimeId;
          let animeExists = true;
          try {
            animeExists = await probeShikimoriAnimeExists(
              refreshed.accessToken || '',
              String(shikiAnimeId || '')
            );
          } catch {
            animeExists = false;
          }

          if (!animeExists) {
            return this.recoverFromUnavailablePrimary(userId, entry.id, payload);
          }
        }

        results.push({
          serviceName,
          status: 'failed',
          error: message,
        });
      }
    }

    const primaryResult = results.find((result) => result.serviceName === primaryService);
    const primaryMissing =
      !primaryResult || primaryResult.status === 'skipped' || primaryResult.status === 'failed';

    if (primaryMissing && fallbackSource && entry.sourceService === primaryService) {
      await db
        .update(userLibraryEntries)
        .set({
          sourceService: fallbackSource.serviceName,
          sourceEntryId: fallbackSource.entryId,
          updatedAt: new Date(),
        })
        .where(eq(userLibraryEntries.id, entry.id));
    }

    const actionable = results.filter((result) => result.status !== 'skipped');
    const hasFailure = actionable.some((result) => result.status === 'failed');
    const hasSuccess = actionable.some((result) => result.status === 'completed');

    if (hasFailure && !hasSuccess) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
      await LibraryService.createNotification(userId, {
        animeId: entry.animeId,
        type: 'sync_failed',
        title: 'Entry sync failed',
        message: 'One or more providers failed to accept the latest library update.',
      });
    } else if (hasSuccess) {
      await LibraryService.markEntrySynced(entry.id, {
        notesSyncStatus:
          payload.notes !== undefined
            ? hasLocalOnlyNotes
              ? 'local_only'
              : 'synced'
            : entry.notesSyncStatus,
      }, hasLocalOnlyNotes ? 'local_only' : 'synced');
    } else if (!actionable.length) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
    }

    return results;
  }

  static async deleteEntryFromProviders(userId: number, entryId: number) {
    const settings = await UserSettingsService.getUserSettings(userId);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      return [] as Array<{ serviceName: string; status: 'completed' | 'failed' | 'skipped'; error?: string }>;
    }

    const primaryService = settings?.primaryService;
    const [anime] = await db
      .select({ malId: animeCatalog.malId })
      .from(animeCatalog)
      .where(eq(animeCatalog.id, entry.animeId))
      .limit(1);

    const serviceIds = await db
      .select()
      .from(animeServiceIds)
      .where(eq(animeServiceIds.animeId, entry.animeId));

    const externalByService = new Map(
      serviceIds.map((row) => [row.serviceName, String(row.externalAnimeId)] as const)
    );

    const integrations = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));

    const rank = (serviceName: string) => {
      if (primaryService && serviceName === primaryService) return 0;
      if (serviceName === 'myanimelist') return 1;
      if (serviceName === 'anilist') return 2;
      return 3;
    };

    const targets = integrations
      .filter((integration) => Boolean(integration.accessToken))
      .sort((a, b) => rank(a.serviceName) - rank(b.serviceName));

    const results: Array<{ serviceName: string; status: 'completed' | 'failed' | 'skipped'; error?: string }> = [];

    for (const integration of targets) {
      const serviceName = integration.serviceName as IntegrationServiceName;
      const provider = getProvider(serviceName);
      const refreshed = await IntegrationService.refreshTokenIfNeeded(integration as UserIntegration);

      const payload: ProviderDeletePayload = {
        externalEntryId: serviceName === entry.sourceService ? entry.sourceEntryId : null,
        externalAnimeId:
          externalByService.get(serviceName) ||
          (serviceName === 'myanimelist' && anime?.malId ? String(anime.malId) : null),
      };

      if (
        (serviceName === 'shikimori' && !payload.externalEntryId) ||
        (serviceName === 'myanimelist' && !payload.externalAnimeId) ||
        (serviceName === 'anilist' && !payload.externalEntryId && !payload.externalAnimeId)
      ) {
        results.push({
          serviceName,
          status: 'skipped',
          error: 'Missing provider identifiers for delete',
        });
        continue;
      }

      try {
        await provider.deleteEntry(refreshed, payload);
        results.push({
          serviceName,
          status: 'completed',
        });
      } catch (error) {
        results.push({
          serviceName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown provider delete error',
        });
      }
    }

    return results;
  }

  static async ensurePrimaryLibraryLoaded(userId: number) {
    const settings = await UserSettingsService.getUserSettings(userId);
    if (!settings?.primaryService) {
      return null;
    }

    const [existing] = await db
      .select()
      .from(userLibraryEntries)
      .where(eq(userLibraryEntries.userId, userId))
      .limit(1);

    if (existing) {
      return null;
    }

    return this.runPrimaryImport(userId, settings.primaryService);
  }

  static async isScheduleSliceStale(userId: number): Promise<boolean> {
    const lastSyncedAt = await LibraryService.getMaxLibrarySyncedAt(userId);
    if (!lastSyncedAt) {
      return true;
    }
    return Date.now() - lastSyncedAt.getTime() > appConfig.scheduleRefreshTtlMs;
  }

  /** Durable marker for UI: schedule refresh pending/running across requests. */
  private static async beginScheduleRefreshMarker(userId: number, status: 'pending' | 'running' = 'running') {
    const settings = await UserSettingsService.getUserSettings(userId);
    if (!settings?.primaryService) {
      return;
    }

    await db
      .update(syncJobs)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        error: 'superseded by newer schedule refresh',
      })
      .where(
        and(
          eq(syncJobs.userId, userId),
          eq(syncJobs.direction, 'schedule_refresh'),
          inArray(syncJobs.status, ['pending', 'running'])
        )
      );

    await db.insert(syncJobs).values({
      userId,
      primaryService: settings.primaryService,
      status,
      direction: 'schedule_refresh',
      summary: {},
      startedAt: status === 'running' ? new Date() : null,
      createdAt: new Date(),
    });
  }

  private static async finishScheduleRefreshMarker(
    userId: number,
    outcome: 'completed' | 'failed',
    summary?: Record<string, unknown>,
    error?: string
  ) {
    await db
      .update(syncJobs)
      .set({
        status: outcome,
        finishedAt: new Date(),
        summary: summary ?? {},
        error: error ?? null,
      })
      .where(
        and(
          eq(syncJobs.userId, userId),
          eq(syncJobs.direction, 'schedule_refresh'),
          inArray(syncJobs.status, ['pending', 'running'])
        )
      );
  }

  private static async getScheduleRefreshMarkerStatus(userId: number): Promise<ScheduleSyncStatus | null> {
    const [job] = await db
      .select()
      .from(syncJobs)
      .where(
        and(
          eq(syncJobs.userId, userId),
          eq(syncJobs.direction, 'schedule_refresh'),
          inArray(syncJobs.status, ['pending', 'running'])
        )
      )
      .orderBy(desc(syncJobs.createdAt))
      .limit(1);

    if (!job) {
      return null;
    }

    const startedOrCreated = job.startedAt || job.createdAt;
    if (isRunningSyncJobStale(startedOrCreated)) {
      await this.finishScheduleRefreshMarker(userId, 'failed', {}, 'Schedule refresh timed out');
      return null;
    }

    return job.status === 'pending' ? 'queued' : 'running';
  }

  static async getScheduleSyncStatus(userId: number): Promise<ScheduleSyncStatus> {
    if (scheduleRefreshInFlight.has(userId)) {
      return 'running';
    }

    const marker = await this.getScheduleRefreshMarkerStatus(userId);
    if (marker) {
      return marker;
    }

    if (isQueuesEnabled()) {
      try {
        const state = await getScheduleRefreshJobState(userId);
        if (state === 'active') {
          return 'running';
        }
        if (state === 'waiting' || state === 'delayed' || state === 'prioritized' || state === 'waiting-children') {
          return 'queued';
        }
      } catch {
        // ignore queue inspection errors
      }
    }

    return 'idle';
  }

  static async requestScheduleRefresh(
    userId: number,
    options?: { force?: boolean; origin?: string }
  ): Promise<{ status: ScheduleSyncStatus; stale: boolean; dispatched: boolean }> {
    const stale = await this.isScheduleSliceStale(userId);
    const current = await this.getScheduleSyncStatus(userId);

    if (!options?.force && !stale) {
      return { status: current, stale, dispatched: false };
    }

    if (current === 'running' || current === 'queued') {
      return { status: current, stale, dispatched: false };
    }

    if (isQueuesEnabled()) {
      try {
        await this.beginScheduleRefreshMarker(userId, 'pending');
        const result = await enqueueScheduleRefresh(userId);
        return {
          status: 'queued',
          stale,
          dispatched: result.enqueued,
        };
      } catch {
        await this.finishScheduleRefreshMarker(userId, 'failed', {}, 'Failed to enqueue schedule refresh');
        // fall through to fire-and-forget
      }
    }

    if (!scheduleRefreshInFlight.has(userId)) {
      scheduleRefreshInFlight.add(userId);
      await this.beginScheduleRefreshMarker(userId, 'running');
      void this.refreshScheduleSlice(userId)
        .catch(() => undefined)
        .finally(() => {
          scheduleRefreshInFlight.delete(userId);
        });
    }

    return { status: 'running', stale, dispatched: true };
  }

  /**
   * Mixed-provider schedule import + membership cascade delete + push изменений.
   */
  static async refreshScheduleSlice(userId: number) {
    try {
      const result = await this.refreshScheduleSliceInner(userId);
      await this.finishScheduleRefreshMarker(userId, 'completed', {
        imported: result.imported,
        sources: result.sources,
        deleted: result.deleted,
        pushed: result.pushed,
      });
      return result;
    } catch (error) {
      await this.finishScheduleRefreshMarker(
        userId,
        'failed',
        {},
        error instanceof Error ? error.message : 'Schedule refresh failed'
      );
      throw error;
    }
  }

  private static async refreshScheduleSliceInner(userId: number) {
    const settings = await UserSettingsService.getUserSettings(userId);
    if (!settings?.primaryService) {
      return { imported: 0, sources: [] as IntegrationServiceName[], deleted: 0, pushed: 0 };
    }

    const existingMarker = await this.getScheduleRefreshMarkerStatus(userId);
    if (!existingMarker) {
      await this.beginScheduleRefreshMarker(userId, 'running');
    } else {
      await db
        .update(syncJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(
          and(
            eq(syncJobs.userId, userId),
            eq(syncJobs.direction, 'schedule_refresh'),
            eq(syncJobs.status, 'pending')
          )
        );
    }

    const integrations = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));

    const connected = integrations.filter((integration) => Boolean(integration.accessToken));
    if (!connected.length) {
      return { imported: 0, sources: [] as IntegrationServiceName[], deleted: 0, pushed: 0 };
    }

    const primaryService = settings.primaryService as IntegrationServiceName;
    const secondaryService = (settings.secondaryService as IntegrationServiceName | null) || null;
    const primaryIntegration = connected.find((integration) => integration.serviceName === primaryService);

    const fallbackRank = (serviceName: string) => {
      if (secondaryService && serviceName === secondaryService) return -1;
      if (serviceName === 'myanimelist') return 0;
      if (serviceName === 'anilist') return 1;
      if (serviceName === 'shikimori') return 2;
      return 9;
    };

    const secondaryIntegrations = connected
      .filter((integration) => integration.serviceName !== primaryService)
      .sort((a, b) => fallbackRank(a.serviceName) - fallbackRank(b.serviceName));

    // 1) Primary membership — эталон при сравнении сервисов.
    let primaryMembership: ProviderLibraryEntry[] = [];
    if (primaryIntegration?.accessToken) {
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(primaryIntegration as UserIntegration);
        primaryMembership = await getProvider(primaryService).fetchLibrary(refreshed, { scope: 'membership' });
      } catch {
        primaryMembership = [];
      }
    }

    // Orphan Shiki rates (anime null): recovery → secondary, без upsert с битыми данными.
    if (primaryService === 'shikimori') {
      const orphans = primaryMembership.filter((entry) => entry.animeMissing && entry.externalEntryId);
      for (const orphan of orphans) {
        try {
          const local = await LibraryService.getEntryBySourceEntryId(
            userId,
            'shikimori',
            orphan.externalEntryId
          );
          if (local) {
            await this.recoverFromUnavailablePrimary(userId, local.id, {
              externalAnimeId: String(local.animeId),
              watchedEpisodes: local.watchedEpisodes,
              watchStatus: local.watchStatus as LibraryStatus,
              personalRating: local.personalRating,
              notes: local.notes,
              isFavorite: local.isFavorite,
              isNotInterested: local.isNotInterested,
            });
          }
        } catch {
          // best-effort per orphan rate
        }
      }
      primaryMembership = primaryMembership.filter((entry) => !entry.animeMissing);
    }

    const deleted = await this.cascadeExternalDeletes(userId, connected, primaryMembership);

    const beforeRows = await db
      .select({
        id: userLibraryEntries.id,
        animeId: userLibraryEntries.animeId,
      })
      .from(userLibraryEntries)
      .where(eq(userLibraryEntries.userId, userId));

    const localAnimeIds = beforeRows.map((row) => row.animeId);
    const serviceIdRows = localAnimeIds.length
      ? await LibraryService.listServiceIdsForAnime(localAnimeIds)
      : [];
    const knownPrimaryExternalIds = new Set(
      serviceIdRows
        .filter((row) => row.serviceName === primaryService)
        .map((row) => String(row.externalAnimeId))
    );

    const keepAnimeIds = new Set<number>();
    const primaryEntryIdsToPush = new Set<number>();
    const malOwnedAnimeIds = new Set<number>();
    const sources: IntegrationServiceName[] = [];

    const primaryPresentExternalIds = new Set(
      primaryMembership.map((entry) => String(entry.externalAnimeId)).filter(Boolean)
    );
    const primaryPresentMalIds = new Set(
      primaryMembership
        .map((entry) => entry.malId)
        .filter((malId): malId is number => typeof malId === 'number')
    );

    let primaryToken: string | null = null;
    if (primaryIntegration?.accessToken) {
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(primaryIntegration as UserIntegration);
        primaryToken = refreshed.accessToken || null;
      } catch {
        primaryToken = primaryIntegration.accessToken || null;
      }
    }

    // Кэш: malId / primaryExt → существует ли тайтл на primary-сервисе (не в membership, а в каталоге).
    const usableOnPrimaryByKey = new Map<string, boolean>();
    const resolveUsableOnPrimary = async (args: {
      primaryExt?: string | null;
      malId?: number | null;
    }): Promise<boolean> => {
      if (primaryService !== 'shikimori' || !primaryToken) {
        // Для не-Shiki primary: наличие id в membership = есть; иначе считаем unknown→gap только без id.
        return Boolean(args.primaryExt && primaryPresentExternalIds.has(args.primaryExt));
      }

      if (args.primaryExt) {
        const key = `id:${args.primaryExt}`;
        const cached = usableOnPrimaryByKey.get(key);
        if (cached !== undefined) {
          return cached;
        }
        let usable = false;
        try {
          usable = await probeShikimoriAnimeExists(primaryToken, args.primaryExt);
        } catch {
          usable = false;
        }
        usableOnPrimaryByKey.set(key, usable);
        return usable;
      }

      if (typeof args.malId === 'number') {
        const key = `mal:${args.malId}`;
        const cached = usableOnPrimaryByKey.get(key);
        if (cached !== undefined) {
          return cached;
        }
        let usable = false;
        try {
          const shikiId = await resolveShikimoriIdByMalId(primaryToken, args.malId);
          usable = Boolean(shikiId);
          if (shikiId) {
            usableOnPrimaryByKey.set(`id:${shikiId}`, true);
          }
        } catch {
          usable = false;
        }
        usableOnPrimaryByKey.set(key, usable);
        return usable;
      }

      return false;
    };

    // 2) Primary → local: эталон статусов (кроме явных локальных outOfSync правок).
    if (primaryMembership.length && primaryIntegration) {
      sources.push(primaryService);
      const toUpsert = filterLibraryForPrimaryAuthoritativeImport(primaryMembership, knownPrimaryExternalIds);
      const upserted = await LibraryService.upsertLibraryEntries(userId, primaryService, toUpsert, {
        // Primary побеждает secondary/stale local; preserveOutOfSync бережёт ручные правки.
        preserveOutOfSync: true,
      });

      for (const row of upserted) {
        keepAnimeIds.add(row.animeId);
        // Пушим состояние primary на остальные (не трогаем pending ручные правки).
        if (!row.outOfSync) {
          primaryEntryIdsToPush.add(row.id);
        }
      }

      await IntegrationService.updateLastSync(primaryIntegration.id);
    }

    // 3) Secondary/fallback: только настоящие gap (тайтла нет на primary-сервисе).
    // Если на primary тайтл есть, а статуса у пользователя нет — primary эталон (не импортируем secondary).
    for (const integration of secondaryIntegrations) {
      const serviceName = integration.serviceName as IntegrationServiceName;
      try {
        const refreshedIntegration = await IntegrationService.refreshTokenIfNeeded(
          integration as UserIntegration
        );
        const provider = getProvider(serviceName);
        const scheduleEntries = await provider.fetchLibrary(refreshedIntegration, { scope: 'schedule' });
        sources.push(serviceName);

        const catalogMode = serviceName === 'anilist' ? 'fill-gaps-next-date' : 'fill-gaps';
        const linked = await LibraryService.linkProviderCatalogEntries(serviceName, scheduleEntries, {
          onExisting: catalogMode,
        });

        const linkedAnimeIds = linked.map((row) => row.animeId);
        const linkedServiceIds = linkedAnimeIds.length
          ? await LibraryService.listServiceIdsForAnime(linkedAnimeIds)
          : [];
        const primaryExtByAnime = new Map<number, string>();
        for (const row of linkedServiceIds) {
          if (row.serviceName === primaryService && row.externalAnimeId) {
            primaryExtByAnime.set(row.animeId, String(row.externalAnimeId));
          }
        }

        for (const { animeId, entry } of linked) {
          const onPrimaryList =
            (typeof entry.malId === 'number' && primaryPresentMalIds.has(entry.malId)) ||
            (() => {
              const primaryExt = primaryExtByAnime.get(animeId);
              return Boolean(primaryExt && primaryPresentExternalIds.has(primaryExt));
            })();

          if (onPrimaryList) {
            keepAnimeIds.add(animeId);
            continue;
          }

          const primaryExt = primaryExtByAnime.get(animeId) || null;
          const usableOnPrimary = await resolveUsableOnPrimary({
            primaryExt,
            malId: entry.malId,
          });

          // На primary usable (есть и не цензура), статуса нет → эталон primary, secondary не импортируем.
          // Цензура / нет в каталоге → gap, берём secondary.
          if (usableOnPrimary) {
            continue;
          }

          keepAnimeIds.add(animeId);

          // Gap: тайтла физически нет на primary — secondary может добавить (без outOfSync / без push как «правка»).
          const existingLocal = await LibraryService.getEntryByAnimeId(userId, animeId);
          if (existingLocal) {
            if (existingLocal.outOfSync) {
              try {
                await LibraryService.requeueEntrySync(userId, existingLocal.id);
                await this.dispatchEntrySync(existingLocal.id);
              } catch {
                // best-effort
              }
            }
            if (serviceName === 'myanimelist' || (secondaryService && serviceName === secondaryService)) {
              malOwnedAnimeIds.add(animeId);
            }
            continue;
          }

          const isConfiguredSecondary = Boolean(secondaryService && serviceName === secondaryService);
          const isMalFallback = !secondaryService && serviceName === 'myanimelist';

          if (isConfiguredSecondary || isMalFallback) {
            await LibraryService.upsertLibraryEntry(userId, serviceName, entry, {
              onExistingCatalog: catalogMode,
              onExistingLibrary: 'keep',
            });
            if (serviceName === 'myanimelist' || isConfiguredSecondary) {
              malOwnedAnimeIds.add(animeId);
            }
            continue;
          }

          if (malOwnedAnimeIds.has(animeId)) {
            continue;
          }

          await LibraryService.upsertLibraryEntry(userId, serviceName, entry, {
            onExistingCatalog: catalogMode,
            onExistingLibrary: 'keep',
          });
        }

        await IntegrationService.updateLastSync(integration.id);
      } catch {
        // Best-effort per provider; continue with others.
      }
    }

    await this.enrichAniListServiceIds(userId, connected);
    await LibraryService.pruneLibraryToScheduleSlice(userId, [...keepAnimeIds]);

    // 4) Outbound:
    // - состояние primary → остальные connected;
    // - только явные локальные правки (manual_update / retry_sync), не импорт с secondary.
    const pushEntryIds = new Set(primaryEntryIdsToPush);
    try {
      const intentional = await LibraryService.listIntentionalPendingSyncEntries(userId);
      for (const entry of intentional) {
        pushEntryIds.add(entry.id);
      }
    } catch {
      // best-effort
    }

    let pushed = 0;
    for (const entryId of pushEntryIds) {
      const stillExists = await LibraryService.getEntryById(userId, entryId);
      if (!stillExists) {
        continue;
      }
      try {
        await LibraryService.requeueEntrySync(userId, entryId);
        await this.dispatchEntrySync(entryId);
        pushed += 1;
      } catch {
        // best-effort push
      }
    }

    return {
      imported: keepAnimeIds.size,
      sources,
      deleted,
      pushed,
    };
  }

  /**
   * Cascade delete по эталону primary:
   * - нет в membership primary + тайтл существует на primary → удаляем локально и с провайдеров
   *   (в т.ч. «на primary тайтл есть, статуса нет» — secondary не удерживает запись);
   * - тайтл физически отсутствует на primary → не удаляем (gap);
   * - явные локальные правки (outOfSync) не сносим.
   */
  private static async cascadeExternalDeletes(
    userId: number,
    connected: UserIntegration[],
    prefetchedPrimaryMembership?: ProviderLibraryEntry[]
  ) {
    const settings = await UserSettingsService.getUserSettings(userId);
    const primaryService = settings?.primaryService as IntegrationServiceName | undefined;
    if (!primaryService) {
      return 0;
    }

    const primaryIntegration = connected.find((integration) => integration.serviceName === primaryService);
    if (!primaryIntegration?.accessToken) {
      return 0;
    }

    const localEntries = await db
      .select({
        id: userLibraryEntries.id,
        animeId: userLibraryEntries.animeId,
        sourceService: userLibraryEntries.sourceService,
        sourceEntryId: userLibraryEntries.sourceEntryId,
        outOfSync: userLibraryEntries.outOfSync,
      })
      .from(userLibraryEntries)
      .where(eq(userLibraryEntries.userId, userId));

    if (!localEntries.length) {
      return 0;
    }

    const animeIds = localEntries.map((row) => row.animeId);
    const serviceIdRows = await LibraryService.listServiceIdsForAnime(animeIds);
    const primaryIdsByAnime = new Map<number, string>();

    for (const row of serviceIdRows) {
      if (row.serviceName === primaryService && row.externalAnimeId) {
        primaryIdsByAnime.set(row.animeId, String(row.externalAnimeId));
      }
    }

    const catalogRows = await db
      .select({ id: animeCatalog.id, malId: animeCatalog.malId })
      .from(animeCatalog)
      .where(inArray(animeCatalog.id, animeIds));
    const malIdByAnime = new Map<number, number>();
    for (const row of catalogRows) {
      if (row.malId) {
        malIdByAnime.set(row.id, row.malId);
      }
    }

    let membership = prefetchedPrimaryMembership;
    if (!membership) {
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(primaryIntegration as UserIntegration);
        const provider = getProvider(primaryService);
        membership = await provider.fetchLibrary(refreshed, { scope: 'membership' });
      } catch {
        return 0;
      }
    }

    const present = new Set(
      membership.map((entry) => String(entry.externalAnimeId)).filter(Boolean)
    );
    const presentMalIds = new Set(
      membership
        .map((entry) => entry.malId)
        .filter((malId): malId is number => typeof malId === 'number')
    );

    // Кандидаты на выравнивание: нет в membership primary.
    const candidates = localEntries.filter((entry) => {
      if (entry.outOfSync) {
        return false;
      }
      const primaryId = primaryIdsByAnime.get(entry.animeId);
      if (primaryId && present.has(primaryId)) {
        return false;
      }
      const malId = malIdByAnime.get(entry.animeId);
      if (malId && presentMalIds.has(malId)) {
        return false;
      }
      return true;
    });

    if (!candidates.length) {
      return 0;
    }

    // Safety: не массово сносить, если membership выглядит сломанным.
    if (present.size === 0 && localEntries.length >= 3) {
      return 0;
    }
    if (present.size > 0 && localEntries.length >= 10 && present.size < Math.ceil(localEntries.length * 0.2)) {
      return 0;
    }

    let primaryToken: string | null = null;
    if (primaryService === 'shikimori') {
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(primaryIntegration as UserIntegration);
        primaryToken = refreshed.accessToken || null;
      } catch {
        primaryToken = primaryIntegration.accessToken || null;
      }
    }

    const existsCache = new Map<string, boolean>();
    const toDelete = new Set<number>();

    for (const entry of candidates) {
      const primaryId = primaryIdsByAnime.get(entry.animeId);
      const malId = malIdByAnime.get(entry.animeId);

      if (primaryService === 'shikimori' && primaryToken) {
        let usable = false;
        if (primaryId) {
          const key = `id:${primaryId}`;
          const cached = existsCache.get(key);
          if (cached !== undefined) {
            usable = cached;
          } else {
            try {
              usable = await probeShikimoriAnimeExists(primaryToken, primaryId);
            } catch {
              usable = false;
            }
            existsCache.set(key, usable);
          }
        } else if (malId) {
          const key = `mal:${malId}`;
          const cached = existsCache.get(key);
          if (cached !== undefined) {
            usable = cached;
          } else {
            try {
              const resolved = await resolveShikimoriIdByMalId(primaryToken, malId);
              usable = Boolean(resolved);
              if (resolved) {
                existsCache.set(`id:${resolved}`, true);
                await LibraryService.ensureServiceIdForAnime(entry.animeId, 'shikimori', resolved);
              }
            } catch {
              usable = false;
            }
            existsCache.set(key, usable);
          }
        } else {
          // Нет primary id и нет mal — не угадываем; gap/ручное — не удаляем.
          continue;
        }

        if (!usable) {
          // Нет на primary или цензура → gap, secondary может держать.
          continue;
        }

        // Usable на primary, нет в membership → эталон «без статуса» → удаляем везде.
        toDelete.add(entry.id);
        continue;
      }

      // Primary не Shiki: удаляем только если была явная привязка к primary id и его нет в membership.
      if (primaryId && !present.has(primaryId)) {
        toDelete.add(entry.id);
      }
    }

    let deleted = 0;
    for (const entryId of toDelete) {
      try {
        await this.deleteEntryFromProviders(userId, entryId);
        const removed = await LibraryService.deleteEntry(userId, entryId);
        if (removed) {
          deleted += 1;
        }
      } catch {
        // continue
      }
    }

    return deleted;
  }

  private static async enrichAniListServiceIds(userId: number, integrations: UserIntegration[]) {
    const anilist = integrations.find((integration) => integration.serviceName === 'anilist' && integration.accessToken);
    if (!anilist) {
      return;
    }

    const animeIds = await LibraryService.getAnimeIdsForUserLibrary(userId);
    if (!animeIds.length) {
      return;
    }

    const serviceIds = await LibraryService.listServiceIdsForAnime(animeIds);
    const hasAniList = new Set(
      serviceIds.filter((row) => row.serviceName === 'anilist').map((row) => row.animeId)
    );

    const catalogRows = await db
      .select({ id: animeCatalog.id, malId: animeCatalog.malId })
      .from(animeCatalog)
      .where(inArray(animeCatalog.id, animeIds));

    const missing = catalogRows.filter((row) => row.malId && !hasAniList.has(row.id));
    if (!missing.length) {
      return;
    }

    try {
      const refreshed = await IntegrationService.refreshTokenIfNeeded(anilist as UserIntegration);
      const resolved = await resolveAniListIdsByMal(
        refreshed.accessToken!,
        missing.map((row) => row.malId!)
      );
      const byMal = new Map(resolved.map((row) => [row.malId, row.anilistId]));

      for (const row of missing) {
        const anilistId = row.malId ? byMal.get(row.malId) : null;
        if (anilistId) {
          await LibraryService.ensureServiceIdForAnime(row.id, 'anilist', anilistId);
        }
      }
    } catch {
      // optional enrichment
    }
  }

  /** @deprecated use refreshScheduleSlice — kept for call-site compatibility */
  static async ensurePrimaryScheduleSliceLoaded(userId: number) {
    try {
      const result = await this.refreshScheduleSlice(userId);
      return result.imported;
    } catch {
      return null;
    }
  }

  private static async processEntrySyncForEntry(userId: number, entryId: number, seedChange?: UserEntryChange) {
    await db
      .update(userEntryChanges)
      .set({
        status: 'processing',
      })
      .where(
        and(
          eq(userEntryChanges.userId, userId),
          eq(userEntryChanges.libraryEntryId, entryId),
          eq(userEntryChanges.status, 'pending')
        )
      );

    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      await db
        .update(userEntryChanges)
        .set({
          status: 'failed',
        })
        .where(
          and(
            eq(userEntryChanges.userId, userId),
            eq(userEntryChanges.libraryEntryId, entryId),
            inArray(userEntryChanges.status, ['pending', 'processing'])
          )
        );

      throw new Error(`Library entry ${entryId} not found`);
    }

    const serviceIds = await db
      .select()
      .from(animeServiceIds)
      .where(eq(animeServiceIds.animeId, entry.animeId));

    const [anime] = await db
      .select({ malId: animeCatalog.malId })
      .from(animeCatalog)
      .where(eq(animeCatalog.id, entry.animeId))
      .limit(1);

    const mappedEntry = await LibraryService.mapLibraryEntry(entry);
    const externalAnimeId =
      mappedEntry?.externalAnimeId ||
      serviceIds.find((row) => row.serviceName === entry.sourceService)?.externalAnimeId ||
      serviceIds[0]?.externalAnimeId ||
      (anime?.malId ? String(anime.malId) : null);

    if (!externalAnimeId && !entry.sourceEntryId) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
      throw new Error(`Library entry ${entryId} is missing provider anime id`);
    }

    const payload: ProviderUpdatePayload = {
      externalAnimeId: externalAnimeId || String(entry.animeId),
      externalEntryId: entry.sourceEntryId,
      watchedEpisodes: entry.watchedEpisodes,
      watchStatus: entry.watchStatus,
      personalRating: entry.personalRating,
      notes: entry.notes,
      isFavorite: entry.isFavorite,
      isNotInterested: entry.isNotInterested,
    };

    const syncResults = await this.syncEntryToProviders(userId, entry.id, payload);

    return {
      changeId: seedChange?.id || null,
      entryId: entry.id,
      status: syncResults?.some((result) => result.status === 'failed') ? 'failed' : 'completed',
      syncResults,
    };
  }

  static async searchAnime(
    userId: number,
    query: string,
    service?: IntegrationServiceName,
    limit: number = 20
  ): Promise<{ service: IntegrationServiceName; results: ProviderSearchResult[] }> {
    const settings = await UserSettingsService.getUserSettings(userId);
    const serviceName = service || settings?.primaryService;
    if (!serviceName) {
      throw new Error('Primary service is not configured');
    }

    const integration = await IntegrationService.getIntegrationByUserAndService(userId, serviceName);
    if (!integration?.accessToken) {
      throw new Error(`Integration ${serviceName} is not connected`);
    }

    const refreshed = await IntegrationService.refreshTokenIfNeeded(integration);
    const provider = getProvider(serviceName);
    const results = await provider.searchAnime(refreshed, query, limit);
    return { service: serviceName, results };
  }

  static async addAnimeToLibrary(
    userId: number,
    args: {
      service: IntegrationServiceName;
      externalAnimeId: string;
      watchStatus?: LibraryStatus;
      watchedEpisodes?: number;
    },
    origin?: string
  ) {
    const watchStatus = args.watchStatus ?? 'planned';
    const watchedEpisodes = args.watchedEpisodes ?? 0;
    const externalAnimeId = String(args.externalAnimeId).trim();
    if (!externalAnimeId) {
      throw new Error('externalAnimeId is required');
    }

    const integration = await IntegrationService.getIntegrationByUserAndService(userId, args.service);
    if (!integration?.accessToken) {
      throw new Error(`Integration ${args.service} is not connected`);
    }

    const refreshed = await IntegrationService.refreshTokenIfNeeded(integration);
    const provider = getProvider(args.service);
    const [details] = await provider.fetchAnimeDetails(refreshed, [externalAnimeId]);
    if (!details) {
      throw new Error('Anime not found on provider');
    }

    const entry = await LibraryService.upsertLibraryEntry(
      userId,
      args.service,
      {
        ...details,
        externalEntryId: '',
        watchStatus,
        watchedEpisodes,
      },
      { onExistingCatalog: 'fill-gaps' }
    );

    await LibraryService.requeueEntrySync(userId, entry.id);
    const dispatched = await this.dispatchEntrySync(entry.id, origin);

    return {
      entry: await LibraryService.mapLibraryEntry(entry),
      queued: true,
      dispatched,
    };
  }

  private static async startAttempt(syncJobId: number, serviceName: IntegrationServiceName, requestPayload: Record<string, unknown>) {
    const [attempt] = await db
      .insert(syncJobAttempts)
      .values({
        syncJobId,
        serviceName,
        status: 'running',
        requestPayload,
        startedAt: new Date(),
        createdAt: new Date(),
      })
      .returning();

    return attempt;
  }

  private static async failStaleRunningJobs(userId?: number) {
    const whereClause = userId
      ? and(eq(syncJobs.userId, userId), eq(syncJobs.status, 'running'))
      : eq(syncJobs.status, 'running');
    const runningJobs = await db.select().from(syncJobs).where(whereClause);
    const staleJobs = runningJobs.filter((job) => isRunningSyncJobStale(job.startedAt));

    for (const job of staleJobs) {
      const message = `Sync job timed out after ${Math.round(STALE_SYNC_JOB_TIMEOUT_MS / 60000)} minutes`;
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: message,
        })
        .where(eq(syncJobs.id, job.id));

      await db
        .update(syncJobAttempts)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: message,
        })
        .where(and(eq(syncJobAttempts.syncJobId, job.id), eq(syncJobAttempts.status, 'running')));
    }
  }

  private static async finishAttempt(attemptId: number, status: 'completed' | 'failed', responsePayload: Record<string, unknown>, error?: string) {
    await db
      .update(syncJobAttempts)
      .set({
        status,
        responsePayload,
        error: error || null,
        finishedAt: new Date(),
      })
      .where(eq(syncJobAttempts.id, attemptId));
  }
}
