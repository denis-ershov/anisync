import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUserId } from '@/lib/api/auth';
import { SyncService } from '@/lib/services/sync-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id } = await params;
  const job = await SyncService.getJobById(Number(id), userId);
  if (!job) {
    return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}
