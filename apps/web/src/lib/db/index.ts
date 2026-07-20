import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/config';
import * as schema from './schema';

const connectionString = env.DATABASE_URL;
const sslMode = new URL(connectionString).searchParams.get('sslmode');
const sslConfig = sslMode && ['require', 'verify-ca', 'verify-full'].includes(sslMode)
  ? {
      rejectUnauthorized: false,
    }
  : undefined;

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: sslConfig,
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
