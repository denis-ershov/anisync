import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { refreshTorrentMetadata } from '@/lib/services/torrent-facade';
import { withSloRoute, type SloRouteContext } from '@/lib/api/with-slo';

async function postHandler(request: NextRequest, context: SloRouteContext) {
  const guard = assertTorrentServiceReady();
  if (guard) {
    return guard;
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id } = await context.params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  let fields: import('@/lib/db').TorrentMetadataRefreshField[] | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text);
      if (body && Array.isArray(body.fields)) {
        const { normalizeRefreshFields } = await import(
          '@/lib/services/torrent-metadata-refresh-service'
        );
        fields = normalizeRefreshFields(body.fields);
      }
    }
  } catch {
    // Body is optional
  }

  try {
    const item = await refreshTorrentMetadata(userId, itemId, fields);
    return NextResponse.json(item);
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}

export const POST = withSloRoute('/api/torrents/watchlist/[id]/refresh', postHandler);
