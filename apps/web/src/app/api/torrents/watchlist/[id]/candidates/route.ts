import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { createLogger } from '@/lib/observability/logger';
import { TorrentWatcherService } from '@/lib/services/torrent-watcher-service';

export const maxDuration = 60;
const log = createLogger('api:torrents:candidates');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = assertTorrentServiceReady();
  if (guard) return guard;
  const userId = await requireCurrentUserId(request);
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const itemId = Number((await params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }
  try {
    return NextResponse.json(await TorrentWatcherService.listReleaseCandidates(userId, itemId));
  } catch (error) {
    log.error({ err: error, itemId, userId }, 'GET /api/torrents/watchlist/[id]/candidates failed');
    return torrentServiceErrorResponse(error);
  }
}

