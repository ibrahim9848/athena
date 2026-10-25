/**
 * Schema DDL, applied idempotently at startup and by the CLI scripts.
 * Plain .mjs so both the Next server (via src/db/index.ts) and the
 * dependency-free scripts in scripts/ can share it.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS supplements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  form TEXT NOT NULL DEFAULT 'tablet',
  default_dose TEXT NOT NULL,
  ingredients TEXT,
  why TEXT,
  watch_for TEXT,
  notes TEXT,
  color TEXT NOT NULL DEFAULT '#d22f45',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  every_n_days INTEGER,
  rotation_start TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id);

CREATE TABLE IF NOT EXISTS meal_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  default_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_meal_slots_user ON meal_slots(user_id);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id TEXT NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
  days TEXT NOT NULL,
  dose_override TEXT,
  note TEXT,
  variant TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_user ON schedule_rules(user_id);

CREATE TABLE IF NOT EXISTS day_variants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  variant TEXT NOT NULL,
  label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_day_variants_user ON day_variants(user_id);

CREATE TABLE IF NOT EXISTS supplement_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  rule_id TEXT NOT NULL REFERENCES schedule_rules(id) ON DELETE CASCADE,
  taken_at TEXT NOT NULL,
  undone INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date ON supplement_logs(user_id, date);

CREATE TABLE IF NOT EXISTS supplement_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment TEXT,
  main_muscles TEXT NOT NULL DEFAULT '[]',
  helping_muscles TEXT NOT NULL DEFAULT '[]',
  cues TEXT,
  view TEXT,
  illustration_svg TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  rest_day_label TEXT NOT NULL DEFAULT 'Rest',
  rest_day_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_programs_user ON programs(user_id);

CREATE TABLE IF NOT EXISTS program_days (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  name TEXT NOT NULL,
  focus TEXT,
  est_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_program_days_program ON program_days(program_id);

CREATE TABLE IF NOT EXISTS program_exercises (
  id TEXT PRIMARY KEY,
  program_day_id TEXT NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL,
  reps_min INTEGER NOT NULL,
  reps_max INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  per_side INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_program_exercises_day ON program_exercises(program_day_id);

CREATE TABLE IF NOT EXISTS session_rules (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_session_rules_program ON session_rules(program_id);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_day_id TEXT REFERENCES program_days(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);

CREATE TABLE IF NOT EXISTS workout_sets (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  rpe REAL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id TEXT,
  time TEXT NOT NULL,
  days TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  label TEXT
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);

CREATE TABLE IF NOT EXISTS reminder_sends (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  sent_for_date TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_sends_once ON reminder_sends(reminder_id, sent_for_date);
`;

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS leaves
 * existing tables untouched, so these are ALTERed in when missing.
 */
const ADDED_COLUMNS = [
  ['supplements', 'every_n_days', 'INTEGER'],
  ['supplements', 'rotation_start', 'TEXT'],
];

/** Apply the schema to a better-sqlite3 Database instance. */
export function applySchema(sqlite) {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA_SQL);
  for (const [table, column, type] of ADDED_COLUMNS) {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((c) => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}
