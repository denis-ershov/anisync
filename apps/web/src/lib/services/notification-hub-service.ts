import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import { db, notifications, type NotificationModule, type NotificationChannel } from '@/lib/db';

export type CreateNotificationInput = {
  userId: number;
  type: 'new_episode' | 'sync_failed' | 'sync_completed' | 'system';
  title: string;
  message: string;
  animeId?: number;
  module?: NotificationModule;
  channel?: NotificationChannel;
  payload?: Record<string, unknown>;
};

export type ListNotificationsOptions = {
  limit?: number;
  unreadOnly?: boolean;
};

export class NotificationHubService {
  static async create(input: CreateNotificationInput) {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        animeId: input.animeId,
        type: input.type,
        module: input.module ?? 'anime',
        channel: input.channel ?? 'in_app',
        payload: input.payload ?? {},
        title: input.title,
        message: input.message,
        createdAt: new Date(),
      })
      .returning();

    return notification;
  }

  static async listForUser(userId: number, options: ListNotificationsOptions = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const conditions = [eq(notifications.userId, userId)];
    if (options.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  static async unreadCount(userId: number) {
    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return Number(row?.value ?? 0);
  }

  static async markRead(userId: number, notificationIds?: number[]) {
    const whereClause = notificationIds?.length
      ? and(eq(notifications.userId, userId), inArray(notifications.id, notificationIds))
      : and(eq(notifications.userId, userId), isNull(notifications.readAt));

    return db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(whereClause)
      .returning();
  }
}
