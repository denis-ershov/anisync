'use client';

import { useTranslations } from 'next-intl';

import { ReleaseDetailModal } from '@/components/releases/release-detail-modal';
import { ReleasesModuleProvider } from '@/components/releases/releases-module-context';
import { ReleasesSubnav } from '@/components/releases/releases-subnav';
import { PlatformShell } from '@/components/platform-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isClientFeatureEnabled } from '@/lib/feature-flags';

export default function ReleasesLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('PlatformModules.releases');

  if (!isClientFeatureEnabled('releases')) {
    return (
      <ProtectedRoute>
        <PlatformShell>
          <div className="container max-w-3xl py-8 px-4">
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
        <ReleasesModuleProvider>
          <ReleasesSubnav />
          {children}
          <ReleaseDetailModal />
        </ReleasesModuleProvider>
      </PlatformShell>
    </ProtectedRoute>
  );
}
