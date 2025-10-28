import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create user_settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    theme TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'en',
    primary_service TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`);

// Create user_anime_list table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_anime_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Not Added',
    rating INTEGER,
    progress INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, anime_id)
  )
`);

// Create user_integrations table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    username TEXT,
    user_id_external TEXT,
    automatic_sync BOOLEAN DEFAULT FALSE,
    last_sync_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, service_name)
  )
`);

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_anime_list_user_id ON user_anime_list(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_anime_list_anime_id ON user_anime_list(anime_id);
  CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_integrations_service ON user_integrations(service_name);
`);

// Migrate existing user_settings table to add primary_service column if not exists
try {
  const tableInfo = db.prepare(`
    SELECT name FROM pragma_table_info('user_settings') WHERE name = 'primary_service'
  `).all();
  
  if (tableInfo.length === 0) {
    db.exec(`
      ALTER TABLE user_settings ADD COLUMN primary_service TEXT DEFAULT NULL
    `);
  }
} catch (error) {
  // Column might already exist, ignore error
  console.log('Migration note:', error);
}

export default db;
