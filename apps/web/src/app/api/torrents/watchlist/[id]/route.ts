import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import {
  deleteTorrentWatchlist,
  updateTorrentPreferences,
} from '@/lib/services/torrent-facade';
import { withSloRoute, type SloRouteContext } from '@/lib/api/with-slo';

async function deleteHandler(request: NextRequest, context: SloRouteContext) {
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

  try {
    await deleteTorrentWatchlist(userId, itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}

export const DELETE = withSloRoute('/api/torrents/watchlist/[id]', deleteHandler);

function nullableInteger(value: unknown, min: number, max: number) {
  if (value === null || value === '') return null;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`Value must be an integer between ${min} and ${max}`);
  }
  return Number(value);
}

async function patchHandler(request: NextRequest, context: SloRouteContext) {
  const guard = assertTorrentServiceReady();
  if (guard) return guard;
  const userId = await requireCurrentUserId(request);
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const itemId = Number((await context.params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const text = (value: unknown) =>
      value === null || value === '' ? null : String(value).trim().slice(0, 100);
    const item = await updateTorrentPreferences(userId, itemId, {
      ...(Object.hasOwn(body, 'targetSeason')
        ? { targetSeason: nullableInteger(body.targetSeason, 1, 99) }
        : {}),
      ...(Object.hasOwn(body, 'preferredQuality')
        ? { preferredQuality: text(body.preferredQuality) }
        : {}),
      ...(Object.hasOwn(body, 'preferredAudio')
        ? { preferredAudio: text(body.preferredAudio) }
        : {}),
      ...(Object.hasOwn(body, 'maxReleasesCount')
        ? { maxReleasesCount: nullableInteger(body.maxReleasesCount, 1, 50) }
        : {}),
      ...(Object.hasOwn(body, 'checkInterval')
        ? { checkInterval: nullableInteger(body.checkInterval, 1, 10_080) }
        : {}),
      ...(Object.hasOwn(body, 'notifyOnce') && typeof body.notifyOnce === 'boolean'
        ? { notifyOnce: body.notifyOnce }
        : {}),
    });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Value must')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return torrentServiceErrorResponse(error);
  }
}

export const PATCH = withSloRoute('/api/torrents/watchlist/[id]', patchHandler);
