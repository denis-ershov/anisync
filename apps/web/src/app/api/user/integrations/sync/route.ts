import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import { SyncService } from '@/lib/services/sync-service';

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const jobs = await SyncService.getRecentJobs(user.id, 10);
  const activeJob = await SyncService.getActiveJob(user.id);

  return NextResponse.json({
    jobs,
    activeJob,
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const primaryService = user.settings.primaryService;
    if (!primaryService) {
      return NextResponse.json({ error: 'No primary service configured' }, { status: 400 });
    }

    const { job, created } = await SyncService.enqueuePrimaryImport(user.id, primaryService);
    const dispatched = created
      ? await SyncService.dispatchJob(job.id, request.nextUrl.origin)
      : Boolean((await SyncService.redispatchActiveJob(user.id, request.nextUrl.origin))?.dispatched);

    return NextResponse.json({
      message: created ? 'Sync job queued' : 'Sync job already in progress',
      job,
      queued: created,
      dispatched,
    }, { status: created ? 202 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
