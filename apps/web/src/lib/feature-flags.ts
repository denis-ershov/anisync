import { env, type AppEnv } from '@/lib/config';

export type FeatureFlag =
  | 'releases'
  | 'torrents'
  | 'registration'
  | 'maintenance';

export function getFeatureFlags(source: AppEnv = env) {
  return {
    releases: source.RELEASES_MODULE_ENABLED ?? false,
    torrents: source.TORRENTS_MODULE_ENABLED ?? false,
    registration: source.REGISTRATION_OPEN ?? true,
    maintenance: source.MAINTENANCE_MODE ?? false,
  } as const;
}

export function isFeatureEnabled(flag: FeatureFlag, source: AppEnv = env) {
  return getFeatureFlags(source)[flag];
}

function readPublicBoolean(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Client-safe flags (NEXT_PUBLIC_* only). */
export function isClientFeatureEnabled(flag: FeatureFlag) {
  const publicFlags: Record<FeatureFlag, string | undefined> = {
    releases: process.env.NEXT_PUBLIC_RELEASES_MODULE_ENABLED,
    torrents: process.env.NEXT_PUBLIC_TORRENTS_MODULE_ENABLED,
    registration: process.env.NEXT_PUBLIC_REGISTRATION_OPEN,
    maintenance: process.env.NEXT_PUBLIC_MAINTENANCE_MODE,
  };

  const raw = publicFlags[flag];
  if (raw === undefined || raw === '') {
    // Match server defaults when public env is unset
    if (flag === 'registration' || flag === 'releases' || flag === 'torrents') {
      return true;
    }
    return false;
  }

  return readPublicBoolean(raw);
}
