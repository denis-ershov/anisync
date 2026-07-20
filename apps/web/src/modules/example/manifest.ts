import type { ModuleManifest } from '@/modules/types';

/**
 * Stub module — always off. Used to verify registry wiring without prod impact.
 * See docs/MODULE_CONTRACT.md checklist item 10.
 */
export const exampleManifest: ModuleManifest = {
  id: 'example',
  featureFlag: null,
  enabledByDefault: false,
  nav: [],
  apiPrefix: '/api/example',
};
