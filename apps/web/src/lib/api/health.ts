import type { NextRequest } from 'next/server';

import { env } from '@/lib/config';

export function hasHealthAccess(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (!env.CRON_SECRET) {
    return false;
  }

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerToken = request.headers.get('x-health-secret');

  return bearerToken === env.CRON_SECRET || headerToken === env.CRON_SECRET;
}
