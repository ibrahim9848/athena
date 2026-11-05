/**
 * The seed scripts, run for real against a temporary database: `--plan all`
 * loads both plans; `--plan care` re-creates only the care rows and leaves the
 * supplements plan, its ticks and its reminders untouched (design doc
 * 2026-11-05, "Seed" and anti-goals).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-seed-'));
const dbPath = path.join(dir, 'app.db');
const env = { ...process.env, DATABASE_PATH: dbPath };

function run(script: string, ...args: string[]): string {
  return execFileSync(process.execPath, [path.join('scripts', script), ...args], {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function open(readonly = false) {
  return new Database(dbPath, { readonly });
}

function count(db: Database.Database, sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...args) as { n: number }).n;
}

function ids(db: Database.Database, table: string, plan: string): string[] {
  return (db.prepare(`SELECT id FROM ${table} WHERE plan = ? ORDER BY id`).all(plan) as { id: string }[]).map(
    (r) => r.id,
  );
}

beforeAll(() => {
  run('create-user.mjs', '--username', 'seedy', '--password', 'pw-for-tests', '--role', 'owner');
  run('seed.mjs', '--user', 'seedy');
}, 60_000);

describe('seed.mjs', () => {
  it('seeds both plans', () => {
    const db = open(true);
    expect(count(db, "SELECT count(*) n FROM meal_slots WHERE plan = 'care'")).toBe(4);
    expect(count(db, "SELECT count(*) n FROM supplements WHERE plan = 'care'")).toBe(12);
    expect(count(db, "SELECT count(*) n FROM supplements WHERE plan = 'supplements'")).toBeGreaterThan(0);
    expect(count(db, 'SELECT count(*) n FROM plan_settings')).toBe(2);
    expect(db.prepare('SELECT starts_on FROM schedule_rules WHERE starts_on IS NOT NULL').all()).toEqual([
      { starts_on: '2026-11-29' },
    ]);
    expect(
      db.prepare("SELECT every_n_days, rotation_start FROM supplements WHERE name LIKE 'Face roller%'").get(),
    ).toEqual({ every_n_days: 14, rotation_start: '2026-12-12' });
    expect(count(db, 'SELECT count(*) n FROM supplements WHERE badge IS NOT NULL')).toBe(3);
    expect(
      db.prepare("SELECT default_time FROM meal_slots WHERE plan = 'care' ORDER BY sort_order").all(),
    ).toEqual([
      { default_time: '07:30' },
      { default_time: '07:30' },
      { default_time: '21:30' },
      { default_time: '21:30' },
    ]);
    db.close();
  });

  it('--plan care re-seeds care only', () => {
    let db = open();
    const userId = (db.prepare("SELECT id FROM users WHERE username = 'seedy'").get() as { id: string }).id;
    const before = {
      supplements: ids(db, 'supplements', 'supplements'),
      slots: ids(db, 'meal_slots', 'supplements'),
      programDays: count(db, 'SELECT count(*) n FROM program_days'),
    };
    const suppRule = (
      db.prepare("SELECT r.id FROM schedule_rules r JOIN supplements s ON s.id = r.supplement_id WHERE s.plan = 'supplements' LIMIT 1").get() as { id: string }
    ).id;
    const suppSlot = before.slots[0];
    const careSlot = ids(db, 'meal_slots', 'care')[0];
    db.prepare(
      "INSERT INTO supplement_logs (id, user_id, date, rule_id, taken_at, undone) VALUES ('log1', ?, '2026-11-05', ?, '2026-11-05T08:00:00Z', 0)",
    ).run(userId, suppRule);
    const insertReminder = db.prepare(
      "INSERT INTO reminders (id, user_id, kind, ref_id, time, days, enabled, label) VALUES (?, ?, 'slot', ?, '07:30', '[0,1,2,3,4,5,6]', 1, NULL)",
    );
    insertReminder.run('rem-supp', userId, suppSlot);
    insertReminder.run('rem-care', userId, careSlot);
    db.prepare(
      "INSERT INTO reminder_sends (id, reminder_id, sent_for_date, sent_at) VALUES ('send1', 'rem-care', '2026-11-05', '2026-11-05T07:31:00Z')",
    ).run();
    db.close();

    run('seed.mjs', '--user', 'seedy', '--plan', 'care');

    db = open(true);
    expect(ids(db, 'supplements', 'supplements')).toEqual(before.supplements);
    expect(ids(db, 'meal_slots', 'supplements')).toEqual(before.slots);
    expect(count(db, "SELECT count(*) n FROM supplement_logs WHERE id = 'log1'")).toBe(1);
    expect(count(db, "SELECT count(*) n FROM reminders WHERE id = 'rem-supp'")).toBe(1);
    expect(count(db, "SELECT count(*) n FROM reminders WHERE id = 'rem-care'")).toBe(0);
    expect(count(db, "SELECT count(*) n FROM reminder_sends WHERE id = 'send1'")).toBe(0);
    expect(count(db, "SELECT count(*) n FROM meal_slots WHERE plan = 'care'")).toBe(4);
    expect(count(db, "SELECT count(*) n FROM supplements WHERE plan = 'care'")).toBe(12);
    expect(ids(db, 'meal_slots', 'care')).not.toContain(careSlot);
    expect(count(db, 'SELECT count(*) n FROM program_days')).toBe(before.programDays);
    db.close();
  });
});
