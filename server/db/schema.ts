import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Таблица версий миграций — управляется server/db/migrate.ts
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
});

// Этап 0 — пользователи (на старте один: «Семья» c PIN 1234)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  pin: text('pin').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
