import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';

export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q') || undefined;
  const results = await LibraryService.listUserLibrary(userId, { search: query });
  return NextResponse.json({ results, count: results.length });
}
