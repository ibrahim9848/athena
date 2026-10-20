import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull(),
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['slot', 'workout', 'custom'] }).notNull(),
  // meal_slot id or program_day id, depending on kind
  refId: text('ref_id'),
  // HH:MM local to the user
  time: text('time').notNull(),
  days: text('days', { mode: 'json' }).$type<number[]>().notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  label: text('label'),
});

export const reminderSends = sqliteTable('reminder_sends', {
  id: text('id').primaryKey(),
  reminderId: text('reminder_id')
    .notNull()
    .references(() => reminders.id, { onDelete: 'cascade' }),
  sentForDate: text('sent_for_date').notNull(),
  sentAt: text('sent_at').notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type ReminderSend = typeof reminderSends.$inferSelect;
