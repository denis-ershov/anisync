import { NextResponse } from 'next/server';

import {
  isTorrentsModuleEnabled,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { getTorrentHealth } from '@/lib/services/torrent-facade';
import { isFeatureEnabled } from '@/lib/feature-flags';

export async function GET() {
  const moduleEnabled = isTorrentsModuleEnabled();

  if (!moduleEnabled) {
    return NextResponse.json({
      module: 'torrents',
      enabled: false,
      serviceConfigured: false,
      storage: 'none',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const health = await getTorrentHealth();
    return NextResponse.json({
      module: 'torrents',
      enabled: isFeatureEnabled('torrents'),
      serviceConfigured: Boolean(process.env.PROWLARR_URL && process.env.PROWLARR_API_KEY),
      storage: 'local',
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}
