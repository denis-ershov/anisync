import { z } from 'zod';

type EnvSource = Record<string, string | undefined>;

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (!value) {
      return false;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const envSchema = z.object({
  APP_BASE_URL: z.string().url(),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16).optional(),
  REDIS_URL: z.string().url().optional(),
  BULLMQ_PREFIX: z.string().min(1).optional().default('anisync'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional().default('info'),
  DEBUG: booleanFromEnv,
  DEBUG_MODULES: z.string().optional().default(''),
  DEBUG_SQL: booleanFromEnv,
  DEBUG_EXTERNAL_API: booleanFromEnv,
  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform((value) => value || undefined),
  SHIKIMORI_BASE_URL: z.string().url(),
  SHIKIMORI_CLIENT_ID: z.string().min(1).optional(),
  SHIKIMORI_CLIENT_SECRET: z.string().min(1).optional(),
  MYANIMELIST_CLIENT_ID: z.string().min(1).optional(),
  MYANIMELIST_CLIENT_SECRET: z.string().min(1).optional(),
  ANILIST_CLIENT_ID: z.string().min(1).optional(),
  ANILIST_CLIENT_SECRET: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),
  PROWLARR_URL: z.string().url().optional(),
  PROWLARR_PUBLIC_URL: z.string().url().optional(),
  PROWLARR_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  RELEASES_MODULE_ENABLED: booleanFromEnv,
  TORRENTS_MODULE_ENABLED: booleanFromEnv,
  INTERNAL_SERVICE_SECRET: z
    .string()
    .min(16)
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  REGISTRATION_OPEN: booleanFromEnv,
  MAINTENANCE_MODE: booleanFromEnv,
});

export type AppEnv = z.infer<typeof envSchema>;

/** Coolify/Docker often pass optional env as empty string — treat as unset. */
function emptyToUndef(value: string | undefined) {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildRawEnv(source: EnvSource) {
  return {
    APP_BASE_URL: emptyToUndef(source.APP_BASE_URL) || emptyToUndef(source.NEXT_PUBLIC_BASE_URL),
    NEXT_PUBLIC_BASE_URL: emptyToUndef(source.NEXT_PUBLIC_BASE_URL) || emptyToUndef(source.APP_BASE_URL),
    DATABASE_URL: emptyToUndef(source.DATABASE_URL),
    JWT_SECRET: emptyToUndef(source.JWT_SECRET),
    CRON_SECRET: emptyToUndef(source.CRON_SECRET),
    REDIS_URL: emptyToUndef(source.REDIS_URL),
    BULLMQ_PREFIX: emptyToUndef(source.BULLMQ_PREFIX),
    LOG_LEVEL: emptyToUndef(source.LOG_LEVEL),
    DEBUG: source.DEBUG,
    DEBUG_MODULES: source.DEBUG_MODULES,
    DEBUG_SQL: source.DEBUG_SQL,
    DEBUG_EXTERNAL_API: source.DEBUG_EXTERNAL_API,
    SENTRY_DSN: emptyToUndef(source.SENTRY_DSN),
    SHIKIMORI_BASE_URL: emptyToUndef(source.SHIKIMORI_BASE_URL) || 'https://shikimori.one',
    SHIKIMORI_CLIENT_ID: emptyToUndef(source.SHIKIMORI_CLIENT_ID),
    SHIKIMORI_CLIENT_SECRET: emptyToUndef(source.SHIKIMORI_CLIENT_SECRET),
    MYANIMELIST_CLIENT_ID: emptyToUndef(source.MYANIMELIST_CLIENT_ID),
    MYANIMELIST_CLIENT_SECRET: emptyToUndef(source.MYANIMELIST_CLIENT_SECRET),
    ANILIST_CLIENT_ID: emptyToUndef(source.ANILIST_CLIENT_ID),
    ANILIST_CLIENT_SECRET: emptyToUndef(source.ANILIST_CLIENT_SECRET),
    TMDB_API_KEY: emptyToUndef(source.TMDB_API_KEY)?.replace(/^["']|["']$/g, ''),
    PROWLARR_URL: emptyToUndef(source.PROWLARR_URL),
    PROWLARR_PUBLIC_URL: emptyToUndef(source.PROWLARR_PUBLIC_URL),
    PROWLARR_API_KEY: emptyToUndef(source.PROWLARR_API_KEY),
    TELEGRAM_BOT_TOKEN: emptyToUndef(source.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: emptyToUndef(source.TELEGRAM_CHAT_ID),
    RELEASES_MODULE_ENABLED: source.RELEASES_MODULE_ENABLED ?? 'true',
    TORRENTS_MODULE_ENABLED: source.TORRENTS_MODULE_ENABLED ?? 'true',
    INTERNAL_SERVICE_SECRET: emptyToUndef(source.INTERNAL_SERVICE_SECRET),
    REGISTRATION_OPEN: source.REGISTRATION_OPEN ?? 'true',
    MAINTENANCE_MODE: source.MAINTENANCE_MODE,
  };
}

export function parseEnv(source: EnvSource = process.env) {
  const parsedEnv = envSchema.safeParse(buildRawEnv(source));

  if (!parsedEnv.success) {
    const message = parsedEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return parsedEnv.data;
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getEnv() must only be called on the server');
  }

  cachedEnv ??= parseEnv();
  return cachedEnv;
}

/** Server-only env; lazy — safe if the module is bundled for the client but not accessed. */
export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, prop) {
    return getEnv()[prop as keyof AppEnv];
  },
});

export function isQueuesEnabled(source: AppEnv = env) {
  return Boolean(source.REDIS_URL);
}

export const providerBaseUrls = {
  get shikimori() {
    return new URL(getEnv().SHIKIMORI_BASE_URL);
  },
  get myanimelist() {
    return new URL('https://myanimelist.net');
  },
  get myanimelistApi() {
    return new URL('https://api.myanimelist.net');
  },
  get anilist() {
    return new URL('https://anilist.co');
  },
  get anilistGraphql() {
    return new URL('https://graphql.anilist.co');
  },
} as const;

export const appConfig = {
  get appBaseUrl() {
    return getEnv().APP_BASE_URL.replace(/\/+$/, '');
  },
  get publicBaseUrl() {
    return getEnv().NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  },
  get bullmqPrefix() {
    return getEnv().BULLMQ_PREFIX;
  },
  /** TTL свежести среза расписания перед фоновым refresh (15 мин). */
  scheduleRefreshTtlMs: 15 * 60 * 1000,
} as const;

export function getProviderCallbackUrl(service: 'shikimori' | 'myanimelist' | 'anilist') {
  return `${appConfig.appBaseUrl}/auth/${service}/callback`;
}

export function getShikimoriApiUrl(pathname: string) {
  return new URL(pathname, providerBaseUrls.shikimori).toString();
}

export function getShikimoriGraphqlUrl() {
  return new URL('/api/graphql', providerBaseUrls.shikimori).toString();
}
