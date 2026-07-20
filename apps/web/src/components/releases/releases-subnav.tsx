'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'dashboard', href: '/releases/dashboard' },
  { id: 'discover', href: '/releases/discover' },
  { id: 'watchlist', href: '/releases/watchlist' },
] as const;

export function ReleasesSubnav() {
  const t = useTranslations('Releases');
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container space-y-2 px-4 py-3 md:space-y-0 md:flex md:items-center md:gap-2">
        <h1 className="text-lg font-semibold md:mr-2">{t('title')}</h1>
        <nav
          className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:overflow-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={t('subnavAria')}
        >
          {tabs.map((tab) => {
            const active =
              pathname.startsWith(tab.href) ||
              (tab.id === 'dashboard' && (pathname === '/releases' || pathname.endsWith('/releases')));
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-11 inline-flex items-center',
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {t(`tabs.${tab.id}`)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
