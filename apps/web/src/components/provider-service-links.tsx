'use client';

import type { IntegrationServiceName } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SERVICE_SHORT: Record<IntegrationServiceName, string> = {
  shikimori: 'Shiki',
  myanimelist: 'MAL',
  anilist: 'AL',
};

export function serviceSourceLabelKey(service: IntegrationServiceName) {
  return `source.${service}` as const;
}

export function ServiceSourceBadge({
  service,
  className,
}: {
  service?: IntegrationServiceName | null;
  className?: string;
}) {
  const t = useTranslations('AnimeCard');
  if (!service) {
    return null;
  }

  return (
    <Badge variant="secondary" className={className || 'bg-black/60 text-white backdrop-blur-sm hover:bg-black/70'}>
      {t(serviceSourceLabelKey(service))}
    </Badge>
  );
}

export function ProviderServiceLinks({
  links,
  compact = false,
}: {
  links?: Array<{ service: IntegrationServiceName; url: string }>;
  compact?: boolean;
}) {
  const t = useTranslations('AnimeCard');
  if (!links?.length) {
    return null;
  }

  return (
    <div
      className={compact ? 'flex flex-wrap gap-1' : 'flex flex-wrap gap-2'}
      onClick={(event) => event.stopPropagation()}
    >
      {links.map((link) => (
        <a
          key={link.service}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={
            compact
              ? 'inline-flex items-center gap-1 rounded-md border bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted'
              : 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted'
          }
          title={t(serviceSourceLabelKey(link.service))}
        >
          {compact ? SERVICE_SHORT[link.service] : t(serviceSourceLabelKey(link.service))}
          <ExternalLink className={compact ? 'h-2.5 w-2.5 opacity-70' : 'h-3 w-3 opacity-70'} />
        </a>
      ))}
    </div>
  );
}
