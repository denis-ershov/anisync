import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { notifyTorrentRelease } from '@/lib/services/torrent-facade';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = assertTorrentServiceReady();
  if (guard) return guard;

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const itemId = Number((await params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.releaseKey !== 'string' || !body.releaseKey.trim()) {
      return NextResponse.json({ error: 'Invalid release candidate' }, { status: 400 });
    }

    const aliases = Array.isArray(body.aliases)
      ? body.aliases
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const result = await notifyTorrentRelease(userId, itemId, {
      releaseKey: body.releaseKey.trim().toLowerCase(),
      aliases,
      title: typeof body.title === 'string' ? body.title.trim().slice(0, 500) : undefined,
    });

    if (!result.telegramOk) {
      return NextResponse.json(
        { error: 'Telegram delivery failed', ...result },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}
