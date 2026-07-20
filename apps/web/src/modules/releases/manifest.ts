import type { ModuleManifest } from '@/modules/types';

export const releasesManifest: ModuleManifest = {
  id: 'releases',
  featureFlag: 'releases',
  enabledByDefault: false,
  nav: [{ href: '/releases/dashboard', labelKey: 'releases', order: 20 }],
  apiPrefix: '/api/releases',
};
