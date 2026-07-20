import { NextRequest, NextResponse } from 'next/server';

import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { getLang, parseCatalogOptions } from '@/lib/api/releases-request';
import { withSloRoute } from '@/lib/api/with-slo';
import { getUpcoming } from '@/lib/integrations/tmdb';

async function getHandler(request: NextRequest) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  try {
    const data = await getUpcoming(getLang(request), parseCatalogOptions(request));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch upcoming content', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}

export const GET = withSloRoute('/api/releases/content/upcoming', getHandler);
