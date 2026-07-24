import type { IntegrationServiceName } from '@/lib/integrations/provider-types';

export type ProviderServiceLink = {
  service: IntegrationServiceName;
  externalAnimeId: string;
  url: string;
};

const SERVICE_ORDER: IntegrationServiceName[] = ['shikimori', 'myanimelist', 'anilist'];

const SERVICE_HOST_MARKERS: Record<IntegrationServiceName, string[]> = {
  shikimori: ['shikimori.one', 'shikimori.org'],
  myanimelist: ['myanimelist.net'],
  anilist: ['anilist.co'],
};

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

export function detectProviderFromUrl(url: string): IntegrationServiceName | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const service of SERVICE_ORDER) {
      if (SERVICE_HOST_MARKERS[service].some((marker) => host === marker || host.endsWith(`.${marker}`))) {
        return service;
      }
    }
  } catch {
    return null;
  }
  return null;
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

  // catalog.url может быть с другого провайдера — не подменять чужой бейдж.
  if (args.catalogUrl && args.catalogUrl.startsWith('http')) {
    const urlService = detectProviderFromUrl(args.catalogUrl);
    const targetService =
      urlService && byService.has(urlService)
        ? urlService
        : args.sourceService &&
            byService.has(args.sourceService) &&
            (!urlService || urlService === args.sourceService)
          ? args.sourceService
          : null;

    if (targetService) {
      const existing = byService.get(targetService)!;
      byService.set(targetService, { ...existing, url: args.catalogUrl });
    }
  }

  return SERVICE_ORDER.flatMap((service) => {
    const link = byService.get(service);
    return link ? [link] : [];
  });
}
