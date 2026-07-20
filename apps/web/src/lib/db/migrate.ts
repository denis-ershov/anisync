import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config();

function requiredDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for migrations');
  return value;
}

async function runMigrations() {
  const migrationClient = postgres(requiredDatabaseUrl(), { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
  } catch (error) {
    console.error('Database migration failed', error);
    process.exitCode = 1;
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
