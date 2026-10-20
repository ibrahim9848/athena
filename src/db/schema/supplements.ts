import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const supplements = sqliteTable('supplements', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  form: text('form', {
    enum: ['tablet', 'capsule', 'softgel', 'chewable', 'scoop', 'other'],
  })
    .notNull()
    .default('tablet'),
  defaultDose: text('default_dose').notNull(),
  ingredients: text('ingredients'),
  why: text('why'),
  watchFor: text('watch_for'),
  notes: text('notes'),
  color: text('color').notNull().default('#d22f45'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const mealSlots = sqliteTable('meal_slots', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  defaultTime: text('default_time'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const scheduleRules = sqliteTable('schedule_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplementId: text('supplement_id')
    .notNull()
    .references(() => supplements.id, { onDelete: 'cascade' }),
  slotId: text('slot_id')
    .notNull()
    .references(() => mealSlots.id, { onDelete: 'cascade' }),
  // JSON int[] 0=Sun..6=Sat
  days: text('days', { mode: 'json' }).$type<number[]>().notNull(),
  doseOverride: text('dose_override'),
  note: text('note'),
  // null/'default' = default variant; otherwise a variant key like 'two_meal'
  variant: text('variant'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const dayVariants = sqliteTable('day_variants', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  day: integer('day').notNull(),
  variant: text('variant').notNull(),
  label: text('label').notNull(),
});

export const supplementLogs = sqliteTable('supplement_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // YYYY-MM-DD in the user's timezone
  date: text('date').notNull(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => scheduleRules.id, { onDelete: 'cascade' }),
  takenAt: text('taken_at').notNull(),
  undone: integer('undone', { mode: 'boolean' }).notNull().default(false),
});

// One row per user: free-text/markdown notes shown on the facts page
// (the "Daily amounts from pills" table, footnotes and disclaimer).
export const supplementSettings = sqliteTable('supplement_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  notes: text('notes'),
});

export type Supplement = typeof supplements.$inferSelect;
export type MealSlot = typeof mealSlots.$inferSelect;
export type ScheduleRule = typeof scheduleRules.$inferSelect;
export type DayVariant = typeof dayVariants.$inferSelect;
export type SupplementLog = typeof supplementLogs.$inferSelect;
