import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';
import { 
  User, 
  UserSettings, 
  CreateUserData, 
  UpdateUserData, 
  UpdateUserSettingsData, 
  LoginData, 
  AuthUser 
} from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class UserService {
  // Create a new user
  static async createUser(userData: CreateUserData, locale: string = 'en'): Promise<User> {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, bio)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(userData.username, userData.email, passwordHash, userData.bio || '');
    
    // Create default settings for the user with locale
    const settingsStmt = db.prepare(`
      INSERT INTO user_settings (user_id, theme, language)
      VALUES (?, 'dark', ?)
    `);
    settingsStmt.run(result.lastInsertRowid, locale);
    
    return this.getUserById(result.lastInsertRowid as number)!;
  }

  // Get user by ID
  static getUserById(id: number): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  // Get user with settings by ID
  static getUserWithSettings(id: number): AuthUser | null {
    const user = this.getUserById(id);
    if (!user) return null;

    const settings = this.getUserSettings(id);
    if (!settings) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      settings
    };
  }

  // Get user by email
  static getUserByEmail(email: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  // Get user by username
  static getUserByUsername(username: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | null;
  }

  // Update user
  static async updateUser(id: number, userData: UpdateUserData): Promise<User | null> {
    const fields = [];
    const values = [];
    
    if (userData.username) {
      fields.push('username = ?');
      values.push(userData.username);
    }
    if (userData.email) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.bio !== undefined) {
      fields.push('bio = ?');
      values.push(userData.bio);
    }
    
    if (fields.length === 0) return this.getUserById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.getUserById(id);
  }

  // Delete user
  static deleteUser(id: number): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Login user
  static async login(loginData: LoginData): Promise<{ user: AuthUser; token: string } | null> {
    const user = this.getUserByEmail(loginData.email);
    if (!user) return null;
    
    const isValidPassword = await this.verifyPassword(loginData.password, user.password_hash);
    if (!isValidPassword) return null;
    
    const settings = this.getUserSettings(user.id);
    if (!settings) return null;
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      settings
    };
    
    return { user: authUser, token };
  }

  // Verify JWT token
  static verifyToken(token: string): { userId: number } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch {
      return null;
    }
  }

  // Get user settings (moved from UserSettingsService for convenience)
  static getUserSettings(userId: number): UserSettings | null {
    const stmt = db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    return stmt.get(userId) as UserSettings | null;
  }
}

export class UserSettingsService {
  // Get user settings
  static getUserSettings(userId: number): UserSettings | null {
    const stmt = db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    return stmt.get(userId) as UserSettings | null;
  }

  // Update user settings
  static updateUserSettings(userId: number, settingsData: UpdateUserSettingsData): UserSettings | null {
    const fields = [];
    const values = [];
    
    if (settingsData.theme) {
      fields.push('theme = ?');
      values.push(settingsData.theme);
    }
    if (settingsData.language) {
      fields.push('language = ?');
      values.push(settingsData.language);
    }
    if (settingsData.primary_service !== undefined) {
      fields.push('primary_service = ?');
      values.push(settingsData.primary_service);
    }
    
    if (fields.length === 0) return this.getUserSettings(userId);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const stmt = db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`);
    stmt.run(...values);
    
    return this.getUserSettings(userId);
  }
}
