import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/config';
import * as schema from './schema';

const connectionString = env.DATABASE_URL;

function sslFromUrl(url: string) {
  try {
    const sslMode = new URL(url).searchParams.get('sslmode');
    if (sslMode && ['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      return { rejectUnauthorized: false } as const;
    }
  } catch {
    // пароль со спецсимволами (#, @, %) может ломать WHATWG URL
  }
  return undefined;
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  // Coolify / PgBouncer (часто :6432) в transaction mode не любят prepared statements.
  prepare: false,
  ssl: sslFromUrl(connectionString),
  onnotice: () => {},
  transform: {
    undefined: null,
  },
});

export const db = drizzle(client, { schema });
export * from './schema';

export const closeConnection = async () => {
  await client.end();
};

export const testConnection = async () => {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};
