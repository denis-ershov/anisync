import type { AppEnv } from '@/lib/config';

import type { FeatureFlag } from '@/lib/feature-flags';

export function getFeatureFlags(source: AppEnv) {
  return {
    releases: source.RELEASES_MODULE_ENABLED ?? false,
    torrents: source.TORRENTS_MODULE_ENABLED ?? false,
    registration: source.REGISTRATION_OPEN ?? true,
    maintenance: source.MAINTENANCE_MODE ?? false,
  } as const;
}

export function isFeatureEnabled(flag: FeatureFlag, source: AppEnv) {
  return getFeatureFlags(source)[flag];
}
