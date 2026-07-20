import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';
import { SyncService } from '@/lib/services/sync-service';

export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  await SyncService.ensurePrimaryLibraryLoaded(userId);
  const stats = await LibraryService.getProfileStats(userId);
  return NextResponse.json({ stats });
}
