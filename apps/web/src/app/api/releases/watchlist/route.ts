import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { getLang } from '@/lib/api/releases-request';
import { withSloRoute } from '@/lib/api/with-slo';
import { ReleaseWatchlistService } from '@/lib/services/release-watchlist-service';

async function getHandler(request: NextRequest) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const items = await ReleaseWatchlistService.listForUser(userId, getLang(request));
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function postHandler(request: NextRequest) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.tmdbId !== 'number' ||
      (body.type !== 'movie' && body.type !== 'show') ||
      (body.status !== 'watching' && body.status !== 'plan' && body.status !== 'watched') ||
      typeof body.title !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const result = await ReleaseWatchlistService.add(userId, body);
    if (result.conflict) {
      return NextResponse.json({ error: 'Item already in watchlist' }, { status: 409 });
    }

    return NextResponse.json(result.item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withSloRoute('/api/releases/watchlist', getHandler);
export const POST = withSloRoute('/api/releases/watchlist', postHandler);
