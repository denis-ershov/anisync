import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/config';
import { isQueuesEnabled } from '@/lib/config';
import { enqueueTorrentWatcherScan } from '@/lib/queue/queues';
import { TorrentWatcherService } from '@/lib/services/torrent-watcher-service';

function authorizeCron(request: NextRequest) {
  const secret = env.CRON_SECRET || env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const cronHeader = request.headers.get('x-cron-secret');
  return bearer === secret || cronHeader === secret;
}

/** Manual / cron trigger for TS torrent watcher (no Python sidecar required). */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isQueuesEnabled()) {
    await enqueueTorrentWatcherScan();
    return NextResponse.json({ ok: true, mode: 'queued' });
  }

  const result = await TorrentWatcherService.scanDueItems();
  return NextResponse.json({ ok: true, mode: 'inline', result });
}
