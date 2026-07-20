import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { addTorrentWatchlist, listTorrentWatchlist } from '@/lib/services/torrent-facade';
import { UserSettingsService } from '@/lib/services/user-service';

export async function GET(request: NextRequest) {
  const guard = assertTorrentServiceReady();
  if (guard) {
    return guard;
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const items = await listTorrentWatchlist(userId);
    return NextResponse.json(items);
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const guard = assertTorrentServiceReady();
  if (guard) {
    return guard;
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body.imdbId !== 'string' || !/^tt\d+$/.test(body.imdbId)) {
      return NextResponse.json({ error: 'Invalid IMDb id' }, { status: 400 });
    }

    const settings = await UserSettingsService.getUserSettings(userId);
    const telegramChatId = settings?.notificationPreferences?.telegramChatId ?? null;

    const item = await addTorrentWatchlist(
      userId,
      body.imdbId,
      typeof body.input === 'string' ? body.input : undefined,
      telegramChatId
    );
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}
