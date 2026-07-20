import { NextRequest, NextResponse } from 'next/server';

import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { getLang } from '@/lib/api/releases-request';
import { withSloRoute, type SloRouteContext } from '@/lib/api/with-slo';
import { getContentDetail } from '@/lib/integrations/tmdb';

async function getHandler(request: NextRequest, context: SloRouteContext) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  const { tmdbId: tmdbIdRaw } = await context.params;
  const tmdbId = Number(tmdbIdRaw);
  const type = request.nextUrl.searchParams.get('type');

  if (!Number.isFinite(tmdbId) || (type !== 'movie' && type !== 'show')) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  try {
    const data = await getContentDetail(tmdbId, type, getLang(request));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch content details', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}

export const GET = withSloRoute('/api/releases/content/[tmdbId]', getHandler);
