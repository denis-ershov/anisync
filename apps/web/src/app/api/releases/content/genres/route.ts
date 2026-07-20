import { NextRequest, NextResponse } from 'next/server';

import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { getLang } from '@/lib/api/releases-request';
import { withSloRoute } from '@/lib/api/with-slo';
import { getGenres } from '@/lib/integrations/tmdb';

async function getHandler(request: NextRequest) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  try {
    const data = await getGenres(getLang(request));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch genres', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}

export const GET = withSloRoute('/api/releases/content/genres', getHandler);
