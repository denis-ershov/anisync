'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

type MigrationStatus = {
  ontrashMigratedUsers: number;
  releaseWatchlistEntries: number;
  totalUsers: number;
  ontrashDatabaseConfigured: boolean;
};

export default function AdminImportPage() {
  const t = useTranslations('SettingsAdminImport');
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    const response = await fetch('/api/admin/migrations/ontrash', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      setStatus(null);
      return;
    }
    const data = (await response.json()) as { status: MigrationStatus };
    setStatus(data.status);
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadStatus();
    }
  }, [user?.role]);

  const run = async (mode: 'dry-run' | 'apply') => {
    if (busy) return;
    setBusy(true);
    setLog('');
    try {
      const response = await fetch('/api/admin/migrations/ontrash', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, step: 'all' }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        results?: Array<{ script: string; output: string; code: number | null }>;
        status?: MigrationStatus;
      };
      if (!response.ok) {
        toast({
          title: t('errorTitle'),
          description: data.error || t('errorDescription'),
          variant: 'destructive',
        });
        setLog(data.error || '');
        return;
      }
      if (data.status) {
        setStatus(data.status);
      }
      setLog(
        (data.results || [])
          .map((r) => `=== ${r.script} (exit ${r.code}) ===\n${r.output}`)
          .join('\n\n')
      );
      toast({
        title: mode === 'apply' ? t('applyDone') : t('dryRunDone'),
        description: t('doneDescription'),
      });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t('forbiddenTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('forbiddenDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('totalUsers')}</p>
          <p className="text-2xl font-semibold">{status?.totalUsers ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('migratedUsers')}</p>
          <p className="text-2xl font-semibold">{status?.ontrashMigratedUsers ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('watchlist')}</p>
          <p className="text-2xl font-semibold">{status?.releaseWatchlistEntries ?? '—'}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {status?.ontrashDatabaseConfigured ? t('sourceConfigured') : t('sourceMissing')}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={busy || !status?.ontrashDatabaseConfigured}
          onClick={() => void run('dry-run')}
        >
          {busy ? t('running') : t('dryRun')}
        </Button>
        <Button
          type="button"
          className="min-h-11 cursor-pointer"
          disabled={busy || !status?.ontrashDatabaseConfigured}
          onClick={() => void run('apply')}
        >
          {busy ? t('running') : t('apply')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 cursor-pointer"
          disabled={busy}
          onClick={() => void loadStatus()}
        >
          {t('refresh')}
        </Button>
      </div>

      {log ? (
        <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
