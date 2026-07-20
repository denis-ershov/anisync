'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTorrentHealth } from '@/lib/torrents/hooks';

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) {
    return <span className="inline-block size-2 rounded-full bg-muted-foreground/40" aria-hidden />;
  }

  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-destructive'}`}
      aria-hidden
    />
  );
}

export function TorrentsHealthBanner() {
  const t = useTranslations('Torrents');
  const { data, isLoading, error } = useTorrentHealth();

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-xl" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {t('health.unavailable')}
      </div>
    );
  }

  const allOk = data.dbOk && data.prowlarrOk !== false && data.telegramOk !== false;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        allOk ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium">{t('health.title')}</span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <StatusDot ok={data.dbOk} />
          {t('health.db')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <StatusDot ok={data.prowlarrOk} />
          {t('health.prowlarr')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <StatusDot ok={data.telegramOk} />
          {t('health.telegram')}
        </span>
        {data.enabledItems !== null && data.totalItems !== null ? (
          <Badge variant="secondary" className="ml-auto">
            {t('health.tracking', { enabled: data.enabledItems, total: data.totalItems })}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
