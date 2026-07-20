'use client';

import { usePathname } from '@/navigation';
import { Link } from '@/navigation';
import { Header } from '@/components/header';
import { NotificationsBell } from '@/components/notifications-bell';
import { PlatformNav } from '@/components/platform-nav';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

type PlatformShellProps = {
  children: React.ReactNode;
};

function isAnimeModulePath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '' ||
    (!pathname.includes('/releases') &&
      !pathname.includes('/torrents') &&
      !pathname.includes('/settings') &&
      !pathname.includes('/login') &&
      !pathname.includes('/register') &&
      !pathname.includes('/profile'))
  );
}

export function PlatformShell({ children }: PlatformShellProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const showAnimeHeader = isAnimeModulePath(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showAnimeHeader ? <Header /> : null}
      {!showAnimeHeader ? (
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Link
            href="/"
            className="mr-auto text-sm font-semibold tracking-tight text-foreground transition-colors duration-200 hover:text-primary"
          >
            AniSync
          </Link>
          {user ? <NotificationsBell /> : null}
        </div>
      ) : null}
      <div className="flex min-h-[calc(100vh-4rem)]">
        <PlatformNav variant="sidebar" className="hidden md:flex" />
        <main
          className={cn(
            'flex-1',
            'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'
          )}
        >
          {children}
        </main>
      </div>
      <PlatformNav variant="bottom" className="md:hidden" />
    </div>
  );
}
