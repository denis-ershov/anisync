import { env } from '@/lib/config';

const debugModules = new Set(
  env.DEBUG_MODULES.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

export function isDebugEnabled(module?: string) {
  if (!env.DEBUG) {
    return false;
  }

  if (!module || debugModules.size === 0) {
    return true;
  }

  return debugModules.has(module.toLowerCase());
}

export function isSqlDebugEnabled() {
  return env.DEBUG_SQL || isDebugEnabled('sql');
}

export function isExternalApiDebugEnabled() {
  return env.DEBUG_EXTERNAL_API || isDebugEnabled('external-api');
}
