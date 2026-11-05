import { after, NextRequest, NextResponse } from 'next/server';

import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { getLang, parseCatalogOptions } from '@/lib/api/releases-request';
import { withSloRoute } from '@/lib/api/with-slo';
import { ReleaseCatalogAggregator } from '@/lib/services/release-catalog-aggregator';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('api:releases:upcoming');

async function getHandler(request: NextRequest) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  try {
    const lang = getLang(request);
    const options = parseCatalogOptions(request);
    after(async () => {
      try {
        await ReleaseCatalogAggregator.refreshUpcoming(lang, options);
      } catch (err) {
        log.error({ err }, 'Не удалось обновить каталог релизов');
      }
    });
    const data = await ReleaseCatalogAggregator.getUpcoming(lang, options);
    const response = NextResponse.json(data);
    response.headers.set(
      'Cache-Control',
      data.partial ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800'
    );
    return response;
  } catch (error) {
    log.error({ err: error }, 'Не удалось загрузить каталог релизов');
    return NextResponse.json(
      { error: 'Failed to fetch upcoming content' },
      { status: 502 }
    );
  }
}

export const GET = withSloRoute('/api/releases/content/upcoming', getHandler);
