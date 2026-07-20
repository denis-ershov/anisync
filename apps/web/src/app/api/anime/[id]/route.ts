import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const entry = await LibraryService.getEntryById(userId, Number(id));
    if (!entry) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const anime = await LibraryService.mapLibraryEntry(entry);
    return NextResponse.json({
      service: entry.sourceService,
      anime,
    });
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
