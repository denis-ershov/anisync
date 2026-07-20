import { and, eq, lt } from 'drizzle-orm';

import { env } from '@/lib/config';
import { db, syncJobAttempts, syncJobs, userSessions } from '@/lib/db';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('maintenance:retention');

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function runRetentionCleanup() {
  const now = new Date();
  const syncJobsRetentionDays = Number(process.env.RETENTION_SYNC_JOBS_DAYS || 180);
  const syncAttemptsRetentionDays = Number(process.env.RETENTION_SYNC_JOB_ATTEMPTS_DAYS || 90);

  const expiredSessions = await db
    .delete(userSessions)
    .where(lt(userSessions.expiresAt, now))
    .returning({ id: userSessions.id });

  const oldSyncJobs = await db
    .delete(syncJobs)
    .where(
      and(
        eq(syncJobs.status, 'completed'),
        lt(syncJobs.createdAt, daysAgo(syncJobsRetentionDays))
      )
    )
    .returning({ id: syncJobs.id });

  const oldAttempts = await db
    .delete(syncJobAttempts)
    .where(lt(syncJobAttempts.createdAt, daysAgo(syncAttemptsRetentionDays)))
    .returning({ id: syncJobAttempts.id });

  const summary = {
    expiredSessions: expiredSessions.length,
    oldSyncJobs: oldSyncJobs.length,
    oldSyncAttempts: oldAttempts.length,
    retentionSyncJobsDays: syncJobsRetentionDays,
    retentionSyncAttemptsDays: syncAttemptsRetentionDays,
    logLevel: env.LOG_LEVEL,
  };

  log.info(summary, 'Retention cleanup completed');
  return summary;
}
