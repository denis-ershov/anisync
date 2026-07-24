import { NextRequest, NextResponse } from 'next/server';

import { hasHealthAccess } from '@/lib/api/health';
import { SyncService } from '@/lib/services/sync-service';

export async function POST(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as { userId?: number }));
  if (!body.userId || !Number.isFinite(body.userId)) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const result = await SyncService.refreshScheduleSlice(Number(body.userId));
    return NextResponse.json({ processed: 1, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Schedule refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
