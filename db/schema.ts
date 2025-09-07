import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const shares = pgTable('shares', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shareAssets = pgTable('share_assets', {
  id: text('id').primaryKey(),
  shareId: text('share_id').notNull().references(() => shares.id),
  kind: text('kind').notNull(),
  url: text('url').notNull(),
  extra: jsonb('extra'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

