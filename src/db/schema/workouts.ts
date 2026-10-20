import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  equipment: text('equipment'),
  mainMuscles: text('main_muscles', { mode: 'json' }).$type<string[]>().notNull().default([]),
  helpingMuscles: text('helping_muscles', { mode: 'json' }).$type<string[]>().notNull().default([]),
  // markdown; one cue per line
  cues: text('cues'),
  view: text('view', { enum: ['side', 'front', 'top'] }),
  illustrationSvg: text('illustration_svg'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const programs = sqliteTable('programs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  restDayLabel: text('rest_day_label').notNull().default('Rest'),
  restDayNotes: text('rest_day_notes'),
});

export const programDays = sqliteTable('program_days', {
  id: text('id').primaryKey(),
  programId: text('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(),
  name: text('name').notNull(),
  focus: text('focus'),
  estMinutes: integer('est_minutes'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const programExercises = sqliteTable('program_exercises', {
  id: text('id').primaryKey(),
  programDayId: text('program_day_id')
    .notNull()
    .references(() => programDays.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  sets: integer('sets').notNull(),
  repsMin: integer('reps_min').notNull(),
  repsMax: integer('reps_max').notNull(),
  restSeconds: integer('rest_seconds').notNull().default(90),
  perSide: integer('per_side', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

// The "Every session" block: warm-up, effort, tempo, progress
export const sessionRules = sqliteTable('session_rules', {
  id: text('id').primaryKey(),
  programId: text('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  text: text('text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  programDayId: text('program_day_id').references(() => programDays.id, {
    onDelete: 'set null',
  }),
  // YYYY-MM-DD in the user's timezone
  date: text('date').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  notes: text('notes'),
});

export const workoutSets = sqliteTable('workout_sets', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  weightKg: real('weight_kg'),
  reps: integer('reps'),
  rpe: real('rpe'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramDay = typeof programDays.$inferSelect;
export type ProgramExercise = typeof programExercises.$inferSelect;
export type SessionRule = typeof sessionRules.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
