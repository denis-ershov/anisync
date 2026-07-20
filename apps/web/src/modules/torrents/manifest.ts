import type { ModuleManifest } from '@/modules/types';

export const torrentsManifest: ModuleManifest = {
  id: 'torrents',
  featureFlag: 'torrents',
  enabledByDefault: false,
  nav: [{ href: '/torrents', labelKey: 'torrents', order: 30 }],
  apiPrefix: '/api/torrents',
};
