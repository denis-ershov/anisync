'use client';

import { useTranslations } from 'next-intl';

import { TorrentsWatchlistView } from '@/components/torrents/torrents-watchlist-view';
import { PlatformShell } from '@/components/platform-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isClientFeatureEnabled } from '@/lib/feature-flags';

export default function TorrentsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('PlatformModules.torrents');

  if (!isClientFeatureEnabled('torrents')) {
    return (
      <ProtectedRoute>
        <PlatformShell>
          <div className="container max-w-3xl px-4 py-8">
            <Card>
              <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('disabledHint')}</p>
              </CardContent>
            </Card>
          </div>
        </PlatformShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PlatformShell>
        {children}
      </PlatformShell>
    </ProtectedRoute>
  );
}
