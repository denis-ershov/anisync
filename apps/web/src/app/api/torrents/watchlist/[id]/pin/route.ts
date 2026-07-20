import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import {
  assertTorrentServiceReady,
  torrentServiceErrorResponse,
} from '@/lib/api/torrents-module';
import { pinTorrentRelease, unpinTorrentRelease } from '@/lib/services/torrent-facade';

async function context(request: NextRequest, params: Promise<{ id: string }>) {
  const guard = assertTorrentServiceReady();
  if (guard) return { response: guard };
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return { response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  const itemId = Number((await params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return { response: NextResponse.json({ error: 'Invalid item id' }, { status: 400 }) };
  }
  return { userId, itemId };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await context(request, params);
  if ('response' in ctx) return ctx.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (
      typeof body.releaseKey !== 'string' ||
      typeof body.title !== 'string' ||
      !Array.isArray(body.aliases)
    ) {
      return NextResponse.json({ error: 'Invalid release candidate' }, { status: 400 });
    }
    const aliases = body.aliases
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    return NextResponse.json(
      await pinTorrentRelease(
        ctx.userId,
        ctx.itemId,
        body.releaseKey.trim().toLowerCase(),
        aliases,
        body.title.trim().slice(0, 500)
      )
    );
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await context(request, params);
  if ('response' in ctx) return ctx.response;
  try {
    return NextResponse.json(await unpinTorrentRelease(ctx.userId, ctx.itemId));
  } catch (error) {
    return torrentServiceErrorResponse(error);
  }
}
