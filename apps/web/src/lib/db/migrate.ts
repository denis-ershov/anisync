import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Папка drizzle относительно этого файла — не зависит от cwd контейнера. */
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../../drizzle');

function requiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required for migrations');
  return value;
}

function sslFromUrl(connectionString: string) {
  try {
    const sslMode = new URL(connectionString).searchParams.get('sslmode');
    if (sslMode && ['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      return { rejectUnauthorized: false } as const;
    }
  } catch {
    // пароль со спецсимволами может ломать URL — SSL не включаем
  }
  return undefined;
}

async function runMigrations() {
  const connectionString = requiredDatabaseUrl();
  const migrationClient = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    prepare: false,
    ssl: sslFromUrl(connectionString),
    onnotice: () => {},
  });
  const db = drizzle(migrationClient);

  try {
    console.log(`Applying drizzle migrations from ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Database migration failed', error);
    process.exitCode = 1;
  } finally {
    await migrationClient.end();
  }
}

runMigrations()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    console.error('Database migration crashed', error);
    process.exit(1);
  });
