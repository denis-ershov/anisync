import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { listTorrentReleases } from '@/lib/services/torrent-facade';
import { withSloRoute, type SloRouteContext } from '@/lib/api/with-slo';

async function getHandler(request: NextRequest, context: SloRouteContext) {
  const guard = assertTorrentServiceReady();
  if (guard) {
    return guard;
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { imdbId } = await context.params;
  if (!imdbId || !/^tt\d+$/.test(imdbId)) {
    return NextResponse.json({ error: 'Invalid IMDb id' }, { status: 400 });
  }

  try {
    const releases = await listTorrentReleases(userId, imdbId);
    return NextResponse.json(releases);
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}

export const GET = withSloRoute('/api/torrents/releases/[imdbId]', getHandler);
