import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

let dbSingleton: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!dbSingleton) {
    const sql = neon(process.env.DATABASE_URL);
    dbSingleton = drizzle(sql, { schema });
  }
  return dbSingleton;
}

