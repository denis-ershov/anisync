import type { IntegrationServiceName } from '@/lib/integrations/provider-types';

export type ProviderServiceLink = {
  service: IntegrationServiceName;
  externalAnimeId: string;
  url: string;
};

const SERVICE_ORDER: IntegrationServiceName[] = ['shikimori', 'myanimelist', 'anilist'];

export function buildProviderAnimeUrl(service: IntegrationServiceName, externalAnimeId: string): string {
  switch (service) {
    case 'shikimori':
      return `https://shikimori.one/animes/${externalAnimeId}`;
    case 'myanimelist':
      return `https://myanimelist.net/anime/${externalAnimeId}`;
    case 'anilist':
      return `https://anilist.co/anime/${externalAnimeId}`;
    default:
      return '#';
  }
}

export function collectProviderServiceLinks(args: {
  serviceIds: Array<{ serviceName: string; externalAnimeId: string }>;
  malId?: number | null;
  catalogUrl?: string | null;
  sourceService?: IntegrationServiceName | null;
}): ProviderServiceLink[] {
  const byService = new Map<IntegrationServiceName, ProviderServiceLink>();

  for (const row of args.serviceIds) {
    const service = row.serviceName as IntegrationServiceName;
    if (!SERVICE_ORDER.includes(service) || !row.externalAnimeId) {
      continue;
    }
    byService.set(service, {
      service,
      externalAnimeId: row.externalAnimeId,
      url: buildProviderAnimeUrl(service, row.externalAnimeId),
    });
  }

  if (args.malId && !byService.has('myanimelist')) {
    const id = String(args.malId);
    byService.set('myanimelist', {
      service: 'myanimelist',
      externalAnimeId: id,
      url: buildProviderAnimeUrl('myanimelist', id),
    });
  }

  if (
    args.catalogUrl &&
    args.sourceService &&
    args.catalogUrl.startsWith('http') &&
    byService.has(args.sourceService)
  ) {
    const existing = byService.get(args.sourceService)!;
    byService.set(args.sourceService, { ...existing, url: args.catalogUrl });
  }

  return SERVICE_ORDER.flatMap((service) => {
    const link = byService.get(service);
    return link ? [link] : [];
  });
}
