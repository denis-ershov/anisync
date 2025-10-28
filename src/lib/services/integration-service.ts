import db from '../database';
import { 
  UserIntegration, 
  CreateIntegrationData, 
  UpdateIntegrationData 
} from '../types';

export class IntegrationService {
  // Create a new integration
  static createIntegration(userId: number, integrationData: CreateIntegrationData): UserIntegration {
    const stmt = db.prepare(`
      INSERT INTO user_integrations (
        user_id, service_name, access_token, refresh_token, 
        token_expires_at, username, user_id_external, automatic_sync
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      userId,
      integrationData.service_name,
      integrationData.access_token,
      integrationData.refresh_token || null,
      integrationData.token_expires_at || null,
      integrationData.username || null,
      integrationData.user_id_external || null,
      integrationData.automatic_sync ? 1 : 0
    );
    
    return this.getIntegrationById(result.lastInsertRowid as number)!;
  }

  // Get integration by ID
  static getIntegrationById(id: number): UserIntegration | null {
    const stmt = db.prepare('SELECT * FROM user_integrations WHERE id = ?');
    return stmt.get(id) as UserIntegration | null;
  }

  // Get integration by user ID and service name
  static getIntegrationByUserAndService(userId: number, serviceName: string): UserIntegration | null {
    const stmt = db.prepare('SELECT * FROM user_integrations WHERE user_id = ? AND service_name = ?');
    return stmt.get(userId, serviceName) as UserIntegration | null;
  }

  // Get all integrations for a user
  static getUserIntegrations(userId: number): UserIntegration[] {
    const stmt = db.prepare('SELECT * FROM user_integrations WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as UserIntegration[];
  }

  // Update integration
  static updateIntegration(id: number, integrationData: UpdateIntegrationData): UserIntegration | null {
    const fields = [];
    const values = [];
    
    if (integrationData.access_token) {
      fields.push('access_token = ?');
      values.push(integrationData.access_token);
    }
    if (integrationData.refresh_token) {
      fields.push('refresh_token = ?');
      values.push(integrationData.refresh_token);
    }
    if (integrationData.token_expires_at) {
      fields.push('token_expires_at = ?');
      values.push(integrationData.token_expires_at);
    }
    if (integrationData.username) {
      fields.push('username = ?');
      values.push(integrationData.username);
    }
    if (integrationData.user_id_external) {
      fields.push('user_id_external = ?');
      values.push(integrationData.user_id_external);
    }
    if (integrationData.automatic_sync !== undefined) {
      fields.push('automatic_sync = ?');
      values.push(integrationData.automatic_sync);
    }
    
    if (fields.length === 0) return this.getIntegrationById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE user_integrations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.getIntegrationById(id);
  }

  // Update integration by user ID and service name
  static updateIntegrationByUserAndService(
    userId: number, 
    serviceName: string, 
    integrationData: UpdateIntegrationData
  ): UserIntegration | null {
    const integration = this.getIntegrationByUserAndService(userId, serviceName);
    if (!integration) return null;
    
    return this.updateIntegration(integration.id, integrationData);
  }

  // Delete integration
  static deleteIntegration(id: number): boolean {
    const stmt = db.prepare('DELETE FROM user_integrations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Delete integration by user ID and service name
  static deleteIntegrationByUserAndService(userId: number, serviceName: string): boolean {
    const stmt = db.prepare('DELETE FROM user_integrations WHERE user_id = ? AND service_name = ?');
    const result = stmt.run(userId, serviceName);
    return result.changes > 0;
  }

  // Update last sync time
  static updateLastSync(id: number): void {
    const stmt = db.prepare('UPDATE user_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  }

  // Get integrations with automatic sync enabled
  static getAutomaticSyncIntegrations(): UserIntegration[] {
    const stmt = db.prepare('SELECT * FROM user_integrations WHERE automatic_sync = TRUE');
    return stmt.all() as UserIntegration[];
  }
}
