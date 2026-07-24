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
  enqueuePrimarySyncJob,
  enqueueScheduleRefresh,
  getScheduleRefreshJobState,
} from '@/lib/queue/queues';
import { getProvider, resolveAniListIdsByMal } from '@/lib/integrations/providers';
import type {
  IntegrationServiceName,
  LibraryStatus,
  ProviderDeletePayload,
  ProviderSearchResult,
  ProviderUpdatePayload,
} from '@/lib/integrations/provider-types';
import { IntegrationService } from '@/lib/services/integration-service';
import { LibraryService } from '@/lib/services/library-service';
import { UserSettingsService } from '@/lib/services/user-service';

export const STALE_SYNC_JOB_TIMEOUT_MS = 30 * 60 * 1000;

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

  static async syncEntryToProviders(userId: number, entryId: number, payload: ProviderUpdatePayload) {
    const settings = await UserSettingsService.getUserSettings(userId);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!settings?.primaryService || !entry) {
      return null;
    }

    const primaryService = settings.primaryService;
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
      serviceIds.map((row) => [row.serviceName, row.externalAnimeId] as const)
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

    const results: Array<{ serviceName: string; status: 'completed' | 'failed' | 'skipped'; entryId?: string | null; error?: string }> = [];
    let hasLocalOnlyNotes = false;
    let fallbackSource: { serviceName: IntegrationServiceName; entryId: string } | null = null;
    let currentSourceEntryId = entry.sourceEntryId;
    let currentSourceService = entry.sourceService as IntegrationServiceName;

    for (const integration of targets) {
      const serviceName = integration.serviceName as IntegrationServiceName;
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

      // Shikimori: update by entry id OR create by anime id
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
      serviceIds.map((row) => [row.serviceName, row.externalAnimeId] as const)
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
      // Promote pending → running when worker picks up the job
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

    const deleted = await this.cascadeExternalDeletes(userId, connected);

    const primaryService = settings.primaryService;
    const secondaryRank = (serviceName: string) => {
      if (serviceName === 'myanimelist') return 0;
      if (serviceName === 'anilist') return 1;
      if (serviceName === 'shikimori') return 2;
      return 9;
    };

    const primaryIntegrations = connected.filter((integration) => integration.serviceName === primaryService);
    const secondaryIntegrations = connected
      .filter((integration) => integration.serviceName !== primaryService)
      .sort((a, b) => secondaryRank(a.serviceName) - secondaryRank(b.serviceName));

    const beforeRows = await db
      .select({
        id: userLibraryEntries.id,
        animeId: userLibraryEntries.animeId,
        watchedEpisodes: userLibraryEntries.watchedEpisodes,
        watchStatus: userLibraryEntries.watchStatus,
      })
      .from(userLibraryEntries)
      .where(eq(userLibraryEntries.userId, userId));
    const beforeByAnime = new Map(beforeRows.map((row) => [row.animeId, row]));

    const keepAnimeIds = new Set<number>();
    const primaryAnimeIds = new Set<number>();
    const malOwnedAnimeIds = new Set<number>();
    const changedEntryIds = new Set<number>();
    const sources: IntegrationServiceName[] = [];

    for (const integration of primaryIntegrations) {
      const serviceName = integration.serviceName as IntegrationServiceName;
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(integration as UserIntegration);
        const provider = getProvider(serviceName);
        const scheduleEntries = await provider.fetchLibrary(refreshed, { scope: 'schedule' });
        sources.push(serviceName);

        const upserted = await LibraryService.upsertLibraryEntries(userId, serviceName, scheduleEntries);
        for (const row of upserted) {
          keepAnimeIds.add(row.animeId);
          primaryAnimeIds.add(row.animeId);

          const prev = beforeByAnime.get(row.animeId);
          if (
            !prev ||
            prev.watchedEpisodes !== row.watchedEpisodes ||
            prev.watchStatus !== row.watchStatus
          ) {
            changedEntryIds.add(row.id);
          }
        }

        await IntegrationService.updateLastSync(integration.id);
      } catch {
        // Best-effort per provider; continue with others.
      }
    }

    for (const integration of secondaryIntegrations) {
      const serviceName = integration.serviceName as IntegrationServiceName;
      try {
        const refreshed = await IntegrationService.refreshTokenIfNeeded(integration as UserIntegration);
        const provider = getProvider(serviceName);
        const scheduleEntries = await provider.fetchLibrary(refreshed, { scope: 'schedule' });
        sources.push(serviceName);

        const linked = await LibraryService.linkProviderCatalogEntries(serviceName, scheduleEntries, {
          onExisting: 'fill-gaps',
        });

        for (const { animeId, entry } of linked) {
          keepAnimeIds.add(animeId);

          if (primaryAnimeIds.has(animeId)) {
            continue;
          }

          if (serviceName === 'myanimelist') {
            await LibraryService.upsertLibraryEntry(userId, serviceName, entry, {
              onExistingCatalog: 'fill-gaps',
            });
            malOwnedAnimeIds.add(animeId);
            continue;
          }

          if (malOwnedAnimeIds.has(animeId)) {
            continue;
          }

          await LibraryService.upsertLibraryEntry(userId, serviceName, entry, {
            onExistingCatalog: 'fill-gaps',
          });
        }

        await IntegrationService.updateLastSync(integration.id);
      } catch {
        // Best-effort per provider; continue with others.
      }
    }

    await this.enrichAniListServiceIds(userId, connected);
    await LibraryService.pruneLibraryToScheduleSlice(userId, [...keepAnimeIds]);

    let pushed = 0;
    for (const entryId of changedEntryIds) {
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

  /** Удаление на primary → cascade на остальные + local. Secondary не триггерит удаление. */
  private static async cascadeExternalDeletes(userId: number, connected: UserIntegration[]) {
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

    // Только тайтлы, реально привязанные к primary (не secondary-only enrichment).
    const primaryLinked = localEntries.filter((entry) => {
      if (primaryIdsByAnime.has(entry.animeId)) {
        return true;
      }
      return entry.sourceService === primaryService && Boolean(entry.sourceEntryId);
    });

    if (!primaryLinked.length) {
      return 0;
    }

    let membership: Awaited<ReturnType<ReturnType<typeof getProvider>['fetchLibrary']>>;
    try {
      const refreshed = await IntegrationService.refreshTokenIfNeeded(primaryIntegration as UserIntegration);
      const provider = getProvider(primaryService);
      membership = await provider.fetchLibrary(refreshed, { scope: 'membership' });
    } catch {
      // Не удаляем при ошибке membership — иначе ложный wipe primary.
      return 0;
    }

    const present = new Set(
      membership.map((entry) => String(entry.externalAnimeId)).filter(Boolean)
    );

    // Защита: пустой/подозрительно маленький ответ API не должен сносить всю библиотеку.
    if (present.size === 0 && primaryLinked.length >= 3) {
      return 0;
    }
    if (present.size > 0 && primaryLinked.length >= 10 && present.size < Math.ceil(primaryLinked.length * 0.2)) {
      return 0;
    }

    const toDelete = new Set<number>();
    for (const entry of primaryLinked) {
      const id = primaryIdsByAnime.get(entry.animeId);
      if (!id || present.has(id)) {
        continue;
      }
      toDelete.add(entry.id);
    }

    let deleted = 0;
    for (const entryId of toDelete) {
      try {
        // Primary уже без записи — убираем с остальных connected и локально.
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
