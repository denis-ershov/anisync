'use client';

import { PlatformShell } from "@/components/platform-shell";
import { ScheduleView } from "@/components/schedule-view";
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

export default function Home() {
  const locale = useLocale();
  const { user, isLoading } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    // Wait for auth check to complete
    if (!isLoading && !user) {
      // Give a small delay to allow auth context to update after redirect
      // This prevents immediate redirect when coming from login page
      const timeoutId = setTimeout(() => {
        fetch('/api/auth/me', { credentials: 'include' })
          .then(res => {
            if (!res.ok) {
              window.location.href = `/${locale}/login`;
            }
          })
          .catch(() => {
            window.location.href = `/${locale}/login`;
          });
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, isLoading, locale, isClient]);

  // Show loading skeleton while checking authentication
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // If not authenticated, return null (redirecting)
  if (!user) {
    return null;
  }

  return (
    <PlatformShell>
      <ScheduleView />
    </PlatformShell>
  );
}
