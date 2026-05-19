import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL не задан. Скопируй .env.example в .env и подставь строку подключения из Neon.'
  );
}

// Neon требует SSL. Строка подключения обычно содержит ?sslmode=require —
// дополнительно явно включаем ssl на случай если флаг забыт.
export const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: 'require',
});

export const db = drizzle(client, { schema });
