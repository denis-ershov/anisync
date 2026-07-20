import { NextResponse } from 'next/server';

import { env } from '@/lib/config';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { checkTmdbHealth } from '@/lib/integrations/tmdb/health';

export async function GET() {
  const tmdb = await checkTmdbHealth(env.TMDB_API_KEY);

  return NextResponse.json({
    module: 'releases',
    enabled: isFeatureEnabled('releases'),
    tmdb,
    timestamp: new Date().toISOString(),
    appEnv: env.LOG_LEVEL,
  });
}
