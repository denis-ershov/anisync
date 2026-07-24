import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import { IntegrationService } from '@/lib/services/integration-service';
import { SyncService } from '@/lib/services/sync-service';

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

    const integrations = await IntegrationService.getUserIntegrations(user.id);
    const otherConnected = integrations.filter(
      (row) => Boolean(row.accessToken) && row.serviceName !== primaryService
    );
    if (!otherConnected.length) {
      return NextResponse.json(
        { error: 'Connect at least one other service to sync the primary catalog' },
        { status: 400 }
      );
    }

    const { job, created } = await SyncService.enqueuePrimaryCatalogPush(user.id, primaryService);
    const dispatched = created
      ? await SyncService.dispatchJob(job.id, request.nextUrl.origin)
      : Boolean((await SyncService.redispatchActiveJob(user.id, request.nextUrl.origin))?.dispatched);

    return NextResponse.json(
      {
        message: created ? 'Catalog sync job queued' : 'Sync job already in progress',
        job,
        queued: created,
        dispatched,
      },
      { status: created ? 202 : 200 }
    );
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
