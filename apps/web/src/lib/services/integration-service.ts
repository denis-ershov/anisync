import { and, desc, eq } from 'drizzle-orm';
import { db, userIntegrations } from '@/lib/db';
import { getProvider } from '@/lib/integrations/providers';
import type { IntegrationServiceName } from '@/lib/integrations/provider-types';
import type { UserIntegration } from '@/lib/db/schema';
import type { CreateIntegrationData, UpdateIntegrationData } from '@/lib/types';

const TOKEN_REFRESH_WINDOW_MS = 12 * 60 * 60 * 1000;

export function shouldRefreshIntegrationToken(tokenExpiresAt?: Date | string | null, now: Date = new Date()) {
  if (!tokenExpiresAt) {
    return false;
  }

  const expiresAt = new Date(tokenExpiresAt);
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  return timeUntilExpiry <= TOKEN_REFRESH_WINDOW_MS;
}

export class IntegrationService {
  static async createIntegration(userId: number, integrationData: CreateIntegrationData): Promise<UserIntegration> {
    const [newIntegration] = await db
      .insert(userIntegrations)
      .values({
        userId,
        serviceName: integrationData.serviceName,
        accessToken: integrationData.accessToken,
        refreshToken: integrationData.refreshToken || null,
        tokenExpiresAt: integrationData.tokenExpiresAt ? new Date(integrationData.tokenExpiresAt) : null,
        username: integrationData.username || null,
        userIdExternal: integrationData.userIdExternal || null,
        automaticSync: integrationData.automaticSync || false,
      })
      .returning();

    return newIntegration;
  }

  static async getIntegrationById(id: number): Promise<UserIntegration | null> {
    const [integration] = await db.select().from(userIntegrations).where(eq(userIntegrations.id, id));
    return integration || null;
  }

  static async getIntegrationByUserAndService(userId: number, serviceName: string): Promise<UserIntegration | null> {
    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.serviceName, serviceName as IntegrationServiceName)));
    return integration || null;
  }

  static async getUserIntegrations(userId: number): Promise<UserIntegration[]> {
    return db.select().from(userIntegrations).where(eq(userIntegrations.userId, userId)).orderBy(desc(userIntegrations.createdAt));
  }

  static async updateIntegration(id: number, integrationData: UpdateIntegrationData): Promise<UserIntegration | null> {
    const updateData: Partial<typeof userIntegrations.$inferInsert> = {};

    if (integrationData.accessToken !== undefined) updateData.accessToken = integrationData.accessToken;
    if (integrationData.refreshToken !== undefined) updateData.refreshToken = integrationData.refreshToken;
    if (integrationData.tokenExpiresAt !== undefined) {
      updateData.tokenExpiresAt = integrationData.tokenExpiresAt ? new Date(integrationData.tokenExpiresAt) : null;
    }
    if (integrationData.username !== undefined) updateData.username = integrationData.username;
    if (integrationData.userIdExternal !== undefined) updateData.userIdExternal = integrationData.userIdExternal;
    if (integrationData.automaticSync !== undefined) updateData.automaticSync = integrationData.automaticSync;

    if (Object.keys(updateData).length === 0) {
      return this.getIntegrationById(id);
    }

    updateData.updatedAt = new Date();

    const [updated] = await db.update(userIntegrations).set(updateData).where(eq(userIntegrations.id, id)).returning();
    return updated || null;
  }

  static async updateIntegrationByUserAndService(
    userId: number,
    serviceName: string,
    integrationData: UpdateIntegrationData
  ): Promise<UserIntegration | null> {
    const integration = await this.getIntegrationByUserAndService(userId, serviceName);
    if (!integration) {
      return null;
    }

    return this.updateIntegration(integration.id, integrationData);
  }

  static async deleteIntegration(id: number): Promise<boolean> {
    const result = await db.delete(userIntegrations).where(eq(userIntegrations.id, id)).returning();
    return result.length > 0;
  }

  static async deleteIntegrationByUserAndService(userId: number, serviceName: string): Promise<boolean> {
    const result = await db
      .delete(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.serviceName, serviceName as IntegrationServiceName)))
      .returning();
    return result.length > 0;
  }

  static async updateLastSync(id: number): Promise<void> {
    await db.update(userIntegrations).set({ lastSyncAt: new Date(), updatedAt: new Date() }).where(eq(userIntegrations.id, id));
  }

  static async getAutomaticSyncIntegrations(): Promise<UserIntegration[]> {
    return db.select().from(userIntegrations).where(eq(userIntegrations.automaticSync, true));
  }

  static async refreshTokenIfNeeded(integration: UserIntegration): Promise<UserIntegration> {
    if (!integration.tokenExpiresAt || !integration.refreshToken) {
      return integration;
    }

    const provider = getProvider(integration.serviceName as IntegrationServiceName);
    if (!provider.capabilities.supportsRefresh || !provider.refreshToken) {
      return integration;
    }

    if (!shouldRefreshIntegrationToken(integration.tokenExpiresAt)) {
      return integration;
    }

    try {
      const tokenData = await provider.refreshToken(integration);
      const updatedIntegration = await this.updateIntegration(integration.id, {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || undefined,
        tokenExpiresAt: tokenData.expiresAt || undefined,
      });

      return updatedIntegration || integration;
    } catch {
      return integration;
    }
  }
}
