import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { NotificationHubService } from '@/lib/services/notification-hub-service';

export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get('limit') || '50');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const [notifications, unreadCount] = await Promise.all([
    NotificationHubService.listForUser(userId, { limit, unreadOnly }),
    NotificationHubService.unreadCount(userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as { notificationIds?: number[] }));
  const notifications = await NotificationHubService.markRead(userId, body.notificationIds);
  const unreadCount = await NotificationHubService.unreadCount(userId);
  return NextResponse.json({ notifications, count: notifications.length, unreadCount });
}
