import { NextRequest, NextResponse } from 'next/server';

import { hasHealthAccess } from '@/lib/api/health';
import { SyncService } from '@/lib/services/sync-service';

export async function POST(request: NextRequest) {
  if (!hasHealthAccess(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as { jobId?: number }));

  try {
    if (body.jobId) {
      const result = await SyncService.processJob(body.jobId);
      return NextResponse.json({ processed: 1, result });
    }

    const result = await SyncService.processNextPendingJob();
    return NextResponse.json({
      processed: result ? 1 : 0,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Sync processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
