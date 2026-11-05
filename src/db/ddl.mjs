/**
 * Schema DDL, applied idempotently at startup and by the CLI scripts.
 * Plain .mjs so both the Next server (via src/db/index.ts) and the
 * dependency-free scripts in scripts/ can share it.
 */
import fs from 'node:fs';
import os from 'node:os';

/** A heartbeat older than this means the owning server is gone. */
export const OWNER_STALE_MS = 60_000;

/**
 * SQLite's locks can't coordinate processes on different hosts sharing one
 * file — e.g. the Docker container and a Windows process via the ./data bind
 * mount. Their write-ahead-log writes collide and committed data is silently
 * lost. The running server records itself in `<db>.owner` with a heartbeat;
 * anything on another host refuses to open the database while that heartbeat
 * is fresh. Processes on the same host (e.g. `docker exec` scripts) are fine.
 */
export function assertNoForeignOwner(dbPath, host = os.hostname(), now = Date.now()) {
  if (dbPath === ':memory:') return;
  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(`${dbPath}.owner`, 'utf8'));
  } catch {
    return;
  }
  if (owner && owner.host !== host && now - owner.heartbeat < OWNER_STALE_MS) {
    throw new Error(
      `${dbPath} is in use by the Athena server on host "${owner.host}" (pid ${owner.pid}). ` +
        'Stop it first, or run this inside that container (docker compose exec athena ...): ' +
        'two hosts writing one SQLite file corrupts it.',
    );
  }
}

/** Record this process as the database owner and keep its heartbeat fresh. */
export function claimDatabase(dbPath, host = os.hostname()) {
  if (dbPath === ':memory:') return () => {};
  const file = `${dbPath}.owner`;
  const write = () =>
    fs.writeFileSync(file, JSON.stringify({ host, pid: process.pid, heartbeat: Date.now() }));
  write();
  const timer = setInterval(() => {
    try {
      write();
    } catch {
      // transient write failure: the next beat retries
    }
  }, 20_000);
  timer.unref();
  const release = () => {
    clearInterval(timer);
    try {
      const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (owner.host === host && owner.pid === process.pid) fs.unlinkSync(file);
    } catch {
      // already gone
    }
  };
  process.once('exit', release);
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      release();
      // Keep the default "terminate" behaviour unless something else handles the signal.
      if (process.listenerCount(signal) === 0) process.exit(0);
    });
  }
  return release;
}

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
  rotation_start TEXT,
  plan TEXT NOT NULL DEFAULT 'supplements',
  badge TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id);

CREATE TABLE IF NOT EXISTS meal_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  default_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'supplements'
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
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_on TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_user ON schedule_rules(user_id);

CREATE TABLE IF NOT EXISTS day_variants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  variant TEXT NOT NULL,
  label TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'supplements'
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

-- Free-text notes per plan ('supplements', 'care'); supersedes supplement_settings,
-- whose rows are copied in once by applySchema.
CREATE TABLE IF NOT EXISTS plan_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  notes TEXT,
  PRIMARY KEY (user_id, plan)
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
  ['supplements', 'plan', "TEXT NOT NULL DEFAULT 'supplements'"],
  ['supplements', 'badge', 'TEXT'],
  ['meal_slots', 'plan', "TEXT NOT NULL DEFAULT 'supplements'"],
  ['day_variants', 'plan', "TEXT NOT NULL DEFAULT 'supplements'"],
  ['schedule_rules', 'starts_on', 'TEXT'],
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
  // Notes used to live in supplement_settings (one row per user); carry them
  // over as the supplements plan's notes. OR IGNORE keeps this idempotent.
  sqlite.exec(
    `INSERT OR IGNORE INTO plan_settings (user_id, plan, notes)
     SELECT user_id, 'supplements', notes FROM supplement_settings`,
  );
}
