import { NextRequest, NextResponse } from 'next/server';

import { hasHealthAccess } from '@/lib/api/health';
import { SyncService } from '@/lib/services/sync-service';

export async function POST(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as { changeId?: number; entryId?: number }));

  try {
    if (body.changeId) {
      const result = await SyncService.processEntryChange(body.changeId);
      return NextResponse.json({ processed: 1, result });
    }

    if (body.entryId) {
      const result = await SyncService.processEntrySyncByEntryId(body.entryId);
      return NextResponse.json({ processed: result ? 1 : 0, result });
    }

    const result = await SyncService.processNextPendingEntrySync();
    return NextResponse.json({
      processed: result ? 1 : 0,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Entry sync processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
