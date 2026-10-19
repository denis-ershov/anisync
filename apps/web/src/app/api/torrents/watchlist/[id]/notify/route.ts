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
      quality: typeof body.quality === 'string' ? body.quality.trim().slice(0, 100) : null,
      size: typeof body.size === 'number' && Number.isFinite(body.size) ? body.size : null,
      seeders: typeof body.seeders === 'number' && Number.isFinite(body.seeders) ? body.seeders : null,
      tracker: typeof body.tracker === 'string' ? body.tracker.trim().slice(0, 100) : null,
      magnetUrl: typeof body.magnetUrl === 'string' ? body.magnetUrl.trim() : null,
      downloadUrl: typeof body.downloadUrl === 'string' ? body.downloadUrl.trim() : null,
      infoUrl: typeof body.infoUrl === 'string' ? body.infoUrl.trim() : null,
      indexerId: typeof body.indexerId === 'number' && Number.isInteger(body.indexerId) ? body.indexerId : undefined,
      guid: typeof body.guid === 'string' ? body.guid.trim() : undefined,
    });

    if (!result.telegramOk) {
      const reason = result.reason;
      let status = 502;
      let message = 'Telegram delivery failed';
      if (reason === 'telegram_bot_not_configured') {
        status = 400;
        message = 'Telegram bot is not configured on the server';
      } else if (reason === 'telegram_chat_not_configured') {
        status = 400;
        message = 'Telegram chat ID is not configured. Please set it in Notification Settings.';
      }

      return NextResponse.json(
        { error: message, reason, ...result },
        { status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}
