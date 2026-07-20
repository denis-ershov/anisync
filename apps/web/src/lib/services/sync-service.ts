import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
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
import { enqueueEntrySync, enqueuePrimarySyncJob } from '@/lib/queue/queues';
import { getProvider } from '@/lib/integrations/providers';
import type { IntegrationServiceName, ProviderUpdatePayload } from '@/lib/integrations/provider-types';
import { IntegrationService } from '@/lib/services/integration-service';
import { LibraryService } from '@/lib/services/library-service';
import { UserSettingsService } from '@/lib/services/user-service';

export const STALE_SYNC_JOB_TIMEOUT_MS = 30 * 60 * 1000;

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

export class SyncService {
  private static buildInternalUrl(pathname: string, origin?: string) {
    const baseUrl = (origin || appConfig.appBaseUrl).replace(/\/+$/, '');
    return `${baseUrl}${pathname}`;
  }

  static async createJob(userId: number, primaryService: IntegrationServiceName) {
    const [job] = await db
      .insert(syncJobs)
      .values({
        userId,
        primaryService,
        status: 'pending',
        direction: 'primary_import',
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

    const job = await this.createJob(userId, primaryService);
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
      } catch {
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
    } catch {
      return false;
    }
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

      const refreshedIntegration = await IntegrationService.refreshTokenIfNeeded(integration);
      const provider = getProvider(primaryService);
      attempt = await this.startAttempt(job.id, primaryService, { type: 'primary_import' });
      const library = await provider.fetchLibrary(refreshedIntegration);

      await LibraryService.upsertLibraryEntries(userId, primaryService, library);

      await this.finishAttempt(attempt.id, 'completed', { imported: library.length });
      await db
        .update(syncJobs)
        .set({
          status: 'completed',
          finishedAt: new Date(),
          summary: {
            imported: library.length,
          },
        })
        .where(eq(syncJobs.id, job.id));

      await LibraryService.createNotification(userId, {
        type: 'sync_completed',
        title: 'Sync completed',
        message: `Imported ${library.length} entries from ${primaryService}.`,
      });

      return {
        jobId: job.id,
        status: 'completed',
        imported: library.length,
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

  static async syncEntryToProviders(userId: number, entryId: number, payload: ProviderUpdatePayload) {
    const settings = await UserSettingsService.getUserSettings(userId);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!settings?.primaryService || !entry) {
      return null;
    }

    const integrations = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));

    const targets = integrations.filter((integration) => {
      if (!integration.accessToken) {
        return false;
      }
      if (integration.serviceName === settings.primaryService) {
        return true;
      }

      return integration.automaticSync;
    });

    const results: Array<{ serviceName: string; status: 'completed' | 'failed' | 'skipped'; entryId?: string | null; error?: string }> = [];
    let hasLocalOnlyNotes = false;

    for (const integration of targets) {
      const provider = getProvider(integration.serviceName as IntegrationServiceName);
      const refreshed = await IntegrationService.refreshTokenIfNeeded(integration as UserIntegration);

      const requestPayload: ProviderUpdatePayload = {
        ...payload,
        externalEntryId: integration.serviceName === entry.sourceService ? entry.sourceEntryId : payload.externalEntryId,
        externalAnimeId: payload.externalAnimeId,
      };

      if (payload.notes && !provider.capabilities.supportsNotes) {
        hasLocalOnlyNotes = true;
        results.push({
          serviceName: integration.serviceName,
          status: 'skipped',
          error: 'Notes are not supported by provider',
        });
        continue;
      }

      try {
        const result = await provider.updateEntry(refreshed, requestPayload);
        results.push({
          serviceName: integration.serviceName,
          status: 'completed',
          entryId: result.externalEntryId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown provider sync error';
        results.push({
          serviceName: integration.serviceName,
          status: 'failed',
          error: message,
        });
      }
    }

    const hasFailure = results.some((result) => result.status === 'failed');
    if (hasFailure) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
      await LibraryService.createNotification(userId, {
        animeId: entry.animeId,
        type: 'sync_failed',
        title: 'Entry sync failed',
        message: 'One or more providers failed to accept the latest library update.',
      });
    } else {
      await LibraryService.markEntrySynced(entry.id, {
        notesSyncStatus:
          payload.notes !== undefined
            ? hasLocalOnlyNotes
              ? 'local_only'
              : 'synced'
            : entry.notesSyncStatus,
      }, hasLocalOnlyNotes ? 'local_only' : 'synced');
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

  static async ensurePrimaryScheduleSliceLoaded(userId: number) {
    const settings = await UserSettingsService.getUserSettings(userId);
    if (!settings?.primaryService) {
      return null;
    }

    try {
      const integration = await IntegrationService.getIntegrationByUserAndService(userId, settings.primaryService);
      if (!integration) {
        return null;
      }

      const refreshedIntegration = await IntegrationService.refreshTokenIfNeeded(integration);
      const provider = getProvider(settings.primaryService);
      const library = await provider.fetchLibrary(refreshedIntegration);
      const scheduleEntries = library.filter((entry) => entry.watchStatus === 'watching' || entry.watchStatus === 'planned');

      await LibraryService.upsertLibraryEntries(userId, settings.primaryService, scheduleEntries);

      return scheduleEntries.length;
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

    const mappedEntry = await LibraryService.mapLibraryEntry(entry);
    if (!mappedEntry?.externalAnimeId) {
      await LibraryService.markEntrySyncFailed(entry.id, false);
      throw new Error(`Library entry ${entryId} is missing provider anime id`);
    }

    const payload: ProviderUpdatePayload = {
      externalAnimeId: mappedEntry.externalAnimeId,
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
