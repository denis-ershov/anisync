import pino from 'pino';

import { env } from '@/lib/config';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.DEBUG ? 'debug' : env.LOG_LEVEL,
  base: {
    service: process.env.ANISYNC_PROCESS ?? 'web',
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});

export function createLogger(name: string) {
  return logger.child({ module: name });
}
