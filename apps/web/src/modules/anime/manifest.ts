import type { ModuleManifest } from '@/modules/types';

export const animeManifest: ModuleManifest = {
  id: 'anime',
  featureFlag: null,
  enabledByDefault: true,
  nav: [{ href: '/', labelKey: 'anime', order: 10 }],
  apiPrefix: '/api/anime',
};
