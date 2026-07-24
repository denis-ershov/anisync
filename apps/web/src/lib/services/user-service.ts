import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, userSettings, userSessions, users } from '@/lib/db';
import { env } from '@/lib/config';
import type { User, UserSettings } from '@/lib/db/schema';
import type {
  AuthUser,
  CreateUserData,
  LoginData,
  UpdateUserData,
  UpdateUserSettingsData,
} from '@/lib/types';

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAuthUser(user: User, settings: UserSettings): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || undefined,
    role: user.role,
    bio: user.bio || undefined,
    settings: {
      id: settings.id,
      userId: settings.userId,
      theme: settings.theme,
      language: settings.language,
      primaryService: settings.primaryService || undefined,
      secondaryService: settings.secondaryService || undefined,
      enabledModules: settings.enabledModules ?? ['anime'],
      notificationPreferences: settings.notificationPreferences ?? { inApp: true },
      createdAt: toIsoString(settings.createdAt),
      updatedAt: toIsoString(settings.updatedAt),
    },
  };
}

export class UserService {
  static async createUser(userData: CreateUserData, locale: string = 'en'): Promise<User> {
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        username: userData.username,
        email: userData.email,
        passwordHash,
        displayName: userData.username,
        bio: userData.bio || '',
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    await db.insert(userSettings).values({
      userId: newUser.id,
      theme: 'dark',
      language: locale as 'en' | 'ru',
    });

    return newUser;
  }

  static async getUserById(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  static async getUserWithSettings(id: number): Promise<AuthUser | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    const settings = await this.getUserSettings(id);
    if (!settings) {
      return null;
    }

    return toAuthUser(user, settings);
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  static async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  static async updateUser(id: number, userData: UpdateUserData): Promise<User | null> {
    const updateData: Partial<typeof users.$inferInsert> = {};

    if (userData.username) updateData.username = userData.username;
    if (userData.email) updateData.email = userData.email;
    if (userData.bio !== undefined) updateData.bio = userData.bio;
    if (userData.displayName !== undefined) updateData.displayName = userData.displayName;

    if (Object.keys(updateData).length === 0) {
      return this.getUserById(id);
    }

    updateData.updatedAt = new Date();

    const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updatedUser || null;
  }

  static async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async changePassword(userId: number, currentPassword: string, nextPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }

    const isValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return false;
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.delete(userSessions).where(eq(userSessions.userId, userId));
    return true;
  }

  static async login(loginData: LoginData): Promise<{ user: AuthUser; token: string } | null> {
    const user = await this.getUserByEmail(loginData.email);
    if (!user) {
      return null;
    }

    const isValidPassword = await this.verifyPassword(loginData.password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    const settings = await this.getUserSettings(user.id);
    if (!settings) {
      return null;
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.insert(userSessions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      token: sessionToken,
      expiresAt,
    });

    return {
      user: toAuthUser(user, settings),
      token: sessionToken,
    };
  }

  static async verifySessionToken(token: string): Promise<{ userId: number } | null> {
    const session = await db.select().from(userSessions).where(eq(userSessions.token, token)).limit(1);
    if (session.length === 0) {
      return null;
    }

    const sessionRecord = session[0];
    if (new Date(sessionRecord.expiresAt) < new Date()) {
      await db.delete(userSessions).where(eq(userSessions.token, token));
      return null;
    }

    return {
      userId: sessionRecord.userId,
    };
  }

  static async getUserSettings(userId: number): Promise<UserSettings | null> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings || null;
  }

  static async clearUserSessions(userId: number) {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }
}

export class UserSettingsService {
  static async getUserSettings(userId: number): Promise<UserSettings | null> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings || null;
  }

  static async updateUserSettings(userId: number, settingsData: UpdateUserSettingsData): Promise<UserSettings | null> {
    const updateData: Partial<typeof userSettings.$inferInsert> = {};
    const current = await this.getUserSettings(userId);

    if (settingsData.theme) updateData.theme = settingsData.theme;
    if (settingsData.language) updateData.language = settingsData.language;
    if (settingsData.primaryService !== undefined) updateData.primaryService = settingsData.primaryService;
    if (settingsData.secondaryService !== undefined) updateData.secondaryService = settingsData.secondaryService;
    if (settingsData.enabledModules) updateData.enabledModules = settingsData.enabledModules;
    if (settingsData.notificationPreferences) {
      updateData.notificationPreferences = {
        ...(current?.notificationPreferences ?? { inApp: true, telegram: false, email: false }),
        ...settingsData.notificationPreferences,
      };
    }

    const nextPrimary =
      settingsData.primaryService !== undefined ? settingsData.primaryService : current?.primaryService ?? null;
    let nextSecondary =
      settingsData.secondaryService !== undefined
        ? settingsData.secondaryService
        : current?.secondaryService ?? null;

    if (nextPrimary && nextSecondary && nextPrimary === nextSecondary) {
      nextSecondary = null;
      updateData.secondaryService = null;
    }

    if (settingsData.primaryService !== undefined && current?.secondaryService === settingsData.primaryService) {
      updateData.secondaryService = null;
      nextSecondary = null;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getUserSettings(userId);
    }

    // Validate connected tokens when setting primary/secondary
    if (settingsData.primaryService || settingsData.secondaryService) {
      const { IntegrationService } = await import('@/lib/services/integration-service');
      const integrations = await IntegrationService.getUserIntegrations(userId);
      const connected = new Set(
        integrations.filter((row) => Boolean(row.accessToken)).map((row) => row.serviceName)
      );

      if (nextPrimary && !connected.has(nextPrimary)) {
        throw new Error('Primary service must be a connected integration');
      }
      if (nextSecondary && !connected.has(nextSecondary)) {
        throw new Error('Secondary service must be a connected integration');
      }
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(userSettings)
      .set(updateData)
      .where(eq(userSettings.userId, userId))
      .returning();

    if (updated && settingsData.notificationPreferences?.telegramChatId !== undefined) {
      try {
        const { syncTorrentTelegram } = await import('@/lib/services/torrent-facade');
        await syncTorrentTelegram(
          userId,
          updated.notificationPreferences?.telegramChatId ?? null
        );
      } catch {
        // Torrents module may be disabled / NW unreachable — settings still saved.
      }
    }

    return updated || null;
  }
}
