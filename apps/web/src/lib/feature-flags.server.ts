import 'server-only';

import { env, type AppEnv } from '@/lib/config';

import type { FeatureFlag } from '@/lib/feature-flags';
import { getFeatureFlags as getFeatureFlagsFromSource, isFeatureEnabled as isFeatureEnabledWithSource } from '@/lib/feature-flags.shared';

export function getFeatureFlags(source: AppEnv = env) {
  return getFeatureFlagsFromSource(source);
}

export function isFeatureEnabled(flag: FeatureFlag, source: AppEnv = env) {
  return isFeatureEnabledWithSource(flag, source);
}
