import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { TorrentWatcherService } from '@/lib/services/torrent-watcher-service';

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
    return torrentServiceErrorResponse(error);
  }
}
