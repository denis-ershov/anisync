'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListTodo, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SyncQueueOverview = {
  queuesEnabled: boolean;
  hasActiveWork: boolean;
  counts: {
    jobsPending: number;
    jobsRunning: number;
    entryPending: number;
    entryProcessing: number;
    entryFailed: number;
    outOfSync: number;
  };
  jobs: Array<{
    id: number;
    kind: 'sync_job';
    status: string;
    direction: string;
    primaryService: string;
    summary: Record<string, unknown>;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
  }>;
  entryTasks: Array<{
    id: number;
    kind: 'entry_change';
    libraryEntryId: number;
    animeId: number;
    title: string;
    changeType: string;
    status: string;
    outOfSync: boolean;
    createdAt: string;
    syncedAt: string | null;
  }>;
  generatedAt: string;
};

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'running' || status === 'processing' || status === 'pending') return 'default';
  if (status === 'completed' || status === 'synced') return 'secondary';
  return 'outline';
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function SyncQueuePanel() {
  const t = useTranslations('SettingsIntegrations.SyncQueue');
  const [queue, setQueue] = useState<SyncQueueOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlushing, setIsFlushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/user/integrations/sync/queue', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load queue');
      }
      const data = await response.json();
      setQueue(data.queue);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const flushQueue = useCallback(async () => {
    setIsFlushing(true);
    setFlushMessage(null);
    try {
      const response = await fetch('/api/user/integrations/sync/queue', {
        method: 'POST',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to flush queue');
      }
      const data = await response.json();
      setQueue(data.queue);
      const dispatched = Number(data.flush?.dispatched || 0);
      const found = Number(data.flush?.found || 0);
      setFlushMessage(t('flushResult', { dispatched, found }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flush queue');
    } finally {
      setIsFlushing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!queue?.hasActiveWork) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadQueue();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [queue?.hasActiveWork, loadQueue]);

  const DIRECTION_KEYS: Record<string, string> = {
    primary_import: t('directions.primary_import'),
    primary_catalog_push: t('directions.primary_catalog_push'),
    schedule_refresh: t('directions.schedule_refresh'),
  };

  const CHANGE_TYPE_KEYS: Record<string, string> = {
    manual_update: t('changeTypes.manual_update'),
    retry_sync: t('changeTypes.retry_sync'),
  };

  const directionLabel = (direction: string) => DIRECTION_KEYS[direction] || direction;
  const changeTypeLabel = (changeType: string) => CHANGE_TYPE_KEYS[changeType] || changeType;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('status.pending'),
      running: t('status.running'),
      processing: t('status.processing'),
      completed: t('status.completed'),
      failed: t('status.failed'),
      synced: t('status.synced'),
      local_only: t('status.local_only'),
    };
    return map[status] || status;
  };

  const hasStuckEntries =
    (queue?.counts.entryPending || 0) + (queue?.counts.entryProcessing || 0) + (queue?.counts.entryFailed || 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {hasStuckEntries && (
            <Button
              type="button"
              size="sm"
              className="min-h-9 cursor-pointer"
              onClick={() => void flushQueue()}
              disabled={isLoading || isFlushing}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', isFlushing && 'animate-spin')} />
              {t('flush')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 cursor-pointer"
            onClick={() => {
              setIsLoading(true);
              void loadQueue();
            }}
            disabled={isLoading || isFlushing}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && !isFlushing && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {flushMessage && <p className="text-sm text-muted-foreground">{flushMessage}</p>}

        {queue && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{t('counts.jobsPending', { count: queue.counts.jobsPending })}</Badge>
              <Badge variant="outline">{t('counts.jobsRunning', { count: queue.counts.jobsRunning })}</Badge>
              <Badge variant="outline">{t('counts.entryPending', { count: queue.counts.entryPending })}</Badge>
              <Badge variant="outline">
                {t('counts.entryProcessing', { count: queue.counts.entryProcessing })}
              </Badge>
              <Badge variant={queue.counts.entryFailed > 0 ? 'destructive' : 'outline'}>
                {t('counts.entryFailed', { count: queue.counts.entryFailed })}
              </Badge>
              <Badge variant={queue.counts.outOfSync > 0 ? 'default' : 'outline'}>
                {t('counts.outOfSync', { count: queue.counts.outOfSync })}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              {queue.queuesEnabled ? t('queuesEnabled') : t('queuesDisabled')}
              {' · '}
              {t('updatedAt', { time: formatWhen(queue.generatedAt) })}
              {queue.hasActiveWork ? ` · ${t('autoRefresh')}` : ''}
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('jobsTitle')}</h4>
              {queue.jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('jobsEmpty')}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {queue.jobs.map((job) => (
                    <li key={`job-${job.id}`} className="space-y-1 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            #{job.id} · {directionLabel(job.direction)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {job.primaryService} · {formatWhen(job.createdAt)}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(job.status)}>{statusLabel(job.status)}</Badge>
                      </div>
                      {typeof job.summary?.imported === 'number' && (
                        <p className="text-xs text-muted-foreground">
                          {t('jobImported', { count: Number(job.summary.imported) })}
                        </p>
                      )}
                      {typeof job.summary?.pushed === 'number' && (
                        <p className="text-xs text-muted-foreground">
                          {t('jobPushed', { count: Number(job.summary.pushed) })}
                        </p>
                      )}
                      {job.error && <p className="text-xs text-destructive">{job.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('entriesTitle')}</h4>
              {queue.entryTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('entriesEmpty')}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {queue.entryTasks.map((task) => (
                    <li key={`entry-${task.id}`} className="space-y-1 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {changeTypeLabel(task.changeType)} · #{task.id} · {formatWhen(task.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {task.outOfSync && <Badge variant="outline">{t('outOfSyncBadge')}</Badge>}
                          <Badge variant={statusBadgeVariant(task.status)}>{statusLabel(task.status)}</Badge>
                        </div>
                      </div>
                      {task.syncedAt && (
                        <p className="text-xs text-muted-foreground">
                          {t('syncedAt', { time: formatWhen(task.syncedAt) })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {!queue && isLoading && (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
