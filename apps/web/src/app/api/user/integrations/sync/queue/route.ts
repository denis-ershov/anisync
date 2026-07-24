import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import { SyncService } from '@/lib/services/sync-service';

/** Обзор очереди синхронизации: jobs + entry-задачи. */
export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const queue = await SyncService.getSyncQueueOverview(userId);
    return NextResponse.json({ queue });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load sync queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/** Перепоставить pending/failed правки пользователя в BullMQ / HTTP process. */
export async function POST(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const flush = await SyncService.flushPendingEntrySyncs(userId, request.nextUrl.origin);
    const queue = await SyncService.getSyncQueueOverview(userId);
    return NextResponse.json({ flush, queue });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to flush sync queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
