import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import { isReleasesModuleEnabled, releasesModuleDisabledResponse } from '@/lib/api/releases-module';
import { withSloRoute, type SloRouteContext } from '@/lib/api/with-slo';
import { ReleaseWatchlistService } from '@/lib/services/release-watchlist-service';

async function patchHandler(request: NextRequest, context: SloRouteContext) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body || (body.status !== 'watching' && body.status !== 'plan' && body.status !== 'watched')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const updated = await ReleaseWatchlistService.updateStatus(userId, id, body.status);
    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function deleteHandler(request: NextRequest, context: SloRouteContext) {
  if (!isReleasesModuleEnabled()) {
    return releasesModuleDisabledResponse();
  }

  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const deleted = await ReleaseWatchlistService.remove(userId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const PATCH = withSloRoute('/api/releases/watchlist/[id]', patchHandler);
export const DELETE = withSloRoute('/api/releases/watchlist/[id]', deleteHandler);
