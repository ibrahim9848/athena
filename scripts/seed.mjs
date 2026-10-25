#!/usr/bin/env node
/**
 * Load the default plans (SPEC.md section 11) into a user's account.
 *
 *   npm run seed -- --user ibrahim
 *
 * Idempotent: it REPLACES the user's supplements, slots, rules, variants,
 * plan notes, programs, exercises, workouts and logs with the seed, inside
 * one transaction. Other users are untouched.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { applySchema } from '../src/db/ddl.mjs';
import { buildSeed } from './seed-data.mjs';

const USAGE = 'Usage: npm run seed -- --user <username>';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/* ---------- arguments ---------- */

let username;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '-h' || arg === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (arg === '--user') {
    username = argv[++i];
  } else if (arg.startsWith('--user=')) {
    username = arg.slice('--user='.length);
  } else {
    fail(`Unexpected argument '${arg}'.\n\n${USAGE}`);
  }
}
if (!username) fail(`--user is required.\n\n${USAGE}`);

/* ---------- database ---------- */

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

try {
  applySchema(db);

  const user = db
    .prepare('SELECT id, username, timezone FROM users WHERE username = ?')
    .get(username);
  if (!user) {
    fail(
      `No user named '${username}'. Create one first:\n` +
        `  npm run create-user -- --username ${username}`,
    );
  }
  const userId = user.id;
  const uuid = () => crypto.randomUUID();
  const seed = buildSeed();
  const counts = {};

  const run = db.transaction(() => {
    /* ----- wipe the user's existing data (children first) ----- */
    db.prepare('DELETE FROM supplement_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM schedule_rules WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM day_variants WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM meal_slots WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM supplements WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM supplement_settings WHERE user_id = ?').run(userId);
    db.prepare(
      'DELETE FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?)',
    ).run(userId);
    db.prepare('DELETE FROM workouts WHERE user_id = ?').run(userId);
    db.prepare(
      `DELETE FROM program_exercises WHERE program_day_id IN (
         SELECT id FROM program_days WHERE program_id IN (SELECT id FROM programs WHERE user_id = ?)
       )`,
    ).run(userId);
    db.prepare(
      'DELETE FROM program_days WHERE program_id IN (SELECT id FROM programs WHERE user_id = ?)',
    ).run(userId);
    db.prepare(
      'DELETE FROM session_rules WHERE program_id IN (SELECT id FROM programs WHERE user_id = ?)',
    ).run(userId);
    db.prepare('DELETE FROM programs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM exercises WHERE user_id = ?').run(userId);
    // Reminders point at slot/program-day ids that are all regenerated below;
    // leaving them would orphan them silently (they would never fire again).
    db.prepare(
      'DELETE FROM reminder_sends WHERE reminder_id IN (SELECT id FROM reminders WHERE user_id = ?)',
    ).run(userId);
    const removedReminders = db.prepare('DELETE FROM reminders WHERE user_id = ?').run(userId);
    if (removedReminders.changes > 0) {
      console.log(
        `Note: removed ${removedReminders.changes} reminder(s) that pointed at the replaced plan — re-create them under Settings → Reminders.`,
      );
    }

    /* ----- supplements ----- */
    const slotIds = {};
    const insertSlot = db.prepare(
      `INSERT INTO meal_slots (id, user_id, key, name, subtitle, default_time, sort_order)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    );
    for (const slot of seed.mealSlots) {
      const id = uuid();
      slotIds[slot.key] = id;
      insertSlot.run(id, userId, slot.key, slot.name, slot.subtitle, slot.sortOrder);
    }
    counts.meal_slots = seed.mealSlots.length;

    const insertVariant = db.prepare(
      'INSERT INTO day_variants (id, user_id, day, variant, label) VALUES (?, ?, ?, ?, ?)',
    );
    for (const v of seed.dayVariants) insertVariant.run(uuid(), userId, v.day, v.variant, v.label);
    counts.day_variants = seed.dayVariants.length;

    const supplementIds = {};
    const insertSupplement = db.prepare(
      `INSERT INTO supplements
         (id, user_id, name, form, default_dose, ingredients, why, watch_for, notes, color, sort_order, archived,
          every_n_days, rotation_start)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)`,
    );
    // Rotations count from "today" in the user's own timezone.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: user.timezone || 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const plusDays = (ymd, n) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    for (const s of seed.supplements) {
      const id = uuid();
      supplementIds[s.key] = id;
      insertSupplement.run(
        id,
        userId,
        s.name,
        s.form,
        s.defaultDose,
        s.ingredients,
        s.why,
        s.watchFor,
        s.color,
        s.sortOrder,
        s.everyNDays ?? null,
        s.everyNDays ? plusDays(today, s.rotationOffset ?? 0) : null,
      );
    }
    counts.supplements = seed.supplements.length;

    const insertRule = db.prepare(
      `INSERT INTO schedule_rules
         (id, user_id, supplement_id, slot_id, days, dose_override, note, variant, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of seed.scheduleRules) {
      insertRule.run(
        uuid(),
        userId,
        supplementIds[r.supplement],
        slotIds[r.slot],
        JSON.stringify(r.days),
        r.doseOverride,
        r.note,
        r.variant,
        r.sortOrder,
      );
    }
    counts.schedule_rules = seed.scheduleRules.length;

    db.prepare('INSERT INTO supplement_settings (user_id, notes) VALUES (?, ?)').run(
      userId,
      seed.supplementNotes,
    );
    counts.supplement_settings = 1;

    /* ----- workouts ----- */
    const exerciseIds = {};
    const insertExercise = db.prepare(
      `INSERT INTO exercises
         (id, user_id, name, equipment, main_muscles, helping_muscles, cues, view, illustration_svg, sort_order, archived)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, 0)`,
    );
    for (const ex of seed.program.exercises) {
      const id = uuid();
      exerciseIds[ex.key] = id;
      insertExercise.run(
        id,
        userId,
        ex.name,
        JSON.stringify(ex.mainMuscles),
        JSON.stringify(ex.helpingMuscles),
        ex.cues,
        ex.view,
        ex.sortOrder,
      );
    }
    counts.exercises = seed.program.exercises.length;

    const programId = uuid();
    db.prepare(
      `INSERT INTO programs (id, user_id, name, description, is_active, rest_day_label, rest_day_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      programId,
      userId,
      seed.program.name,
      seed.program.description,
      seed.program.isActive ? 1 : 0,
      seed.program.restDayLabel,
      seed.program.restDayNotes,
    );
    counts.programs = 1;

    const insertSessionRule = db.prepare(
      'INSERT INTO session_rules (id, program_id, key, text, sort_order) VALUES (?, ?, ?, ?, ?)',
    );
    for (const rule of seed.program.sessionRules) {
      insertSessionRule.run(uuid(), programId, rule.key, rule.text, rule.sortOrder);
    }
    counts.session_rules = seed.program.sessionRules.length;

    const insertDay = db.prepare(
      `INSERT INTO program_days (id, program_id, weekday, name, focus, est_minutes, sort_order)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    );
    const insertProgramExercise = db.prepare(
      `INSERT INTO program_exercises
         (id, program_day_id, exercise_id, sets, reps_min, reps_max, rest_seconds, per_side, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    counts.program_days = 0;
    counts.program_exercises = 0;
    for (const day of seed.program.days) {
      const dayId = uuid();
      insertDay.run(dayId, programId, day.weekday, day.name, day.focus, day.sortOrder);
      counts.program_days++;
      for (const pe of day.exercises) {
        insertProgramExercise.run(
          uuid(),
          dayId,
          exerciseIds[pe.exercise],
          pe.sets,
          pe.repsMin,
          pe.repsMax,
          pe.restSeconds,
          pe.perSide ? 1 : 0,
          pe.sortOrder,
        );
        counts.program_exercises++;
      }
    }
  });
  run();

  console.log(`Seeded '${user.username}' (${dbPath}):`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(20)} ${count}`);
  }
} finally {
  db.close();
}
