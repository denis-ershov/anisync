'use client';

import { CalendarDays, Download, Tv2, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/navigation';
import { cn } from '@/lib/utils';
import { isClientFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';
import { getNavManifests } from '@/modules/registry';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PlatformNavProps = {
  variant?: 'sidebar' | 'bottom';
  className?: string;
};

const moduleIcons: Record<string, LucideIcon> = {
  anime: Tv2,
  releases: CalendarDays,
  torrents: Download,
};

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname === '';
  }

  const segment = href.split('/').filter(Boolean)[0];
  if (!segment) {
    return false;
  }

  return pathname === `/${segment}` || pathname.startsWith(`/${segment}/`);
}

export function PlatformNav({ variant = 'sidebar', className }: PlatformNavProps) {
  const t = useTranslations('PlatformNav');
  const pathname = usePathname();
  const navModules = getNavManifests();

  const content = navModules.map((module) => {
    const nav = module.nav[0];
    if (!nav) {
      return null;
    }

    const flag = module.featureFlag as FeatureFlag | null;
    const enabled = flag ? isClientFeatureEnabled(flag) : module.enabledByDefault;
    const active = isActivePath(pathname, nav.href);
    const Icon = moduleIcons[module.id] ?? Tv2;

    const itemClass = cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-11',
      variant === 'bottom' && 'flex-col justify-center gap-1 px-2 py-2 text-xs min-w-[4.5rem]',
      active && 'bg-primary/15 text-primary',
      !active && enabled && 'text-muted-foreground hover:bg-muted hover:text-foreground',
      !enabled && 'cursor-not-allowed text-muted-foreground/50'
    );

    const label = t(nav.labelKey as 'anime' | 'releases' | 'torrents');

    if (!enabled) {
      return (
        <Tooltip key={module.id}>
          <TooltipTrigger asChild>
            <span className={itemClass} aria-disabled="true">
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link key={module.id} href={nav.href} className={itemClass}>
        <Icon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  });

  if (variant === 'bottom') {
    return (
      <TooltipProvider>
        <nav
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
            'pb-[env(safe-area-inset-bottom)]',
            className
          )}
          aria-label={t('ariaLabel')}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1">
            {content}
          </div>
        </nav>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <nav
        className={cn('flex w-56 shrink-0 flex-col gap-1 border-r p-3', className)}
        aria-label={t('ariaLabel')}
      >
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('modules')}
        </p>
        {content}
      </nav>
    </TooltipProvider>
  );
}
