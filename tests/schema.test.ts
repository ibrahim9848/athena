/**
 * Schema migration tests: the plan columns, rule start dates, item badges and
 * per-plan notes are added by the idempotent DDL and existing databases pick
 * them up on the next start (SPEC: design doc 2026-11-05, "Data model").
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
// @ts-ignore - plain .mjs module shared with the CLI scripts
import { applySchema } from '../src/db/ddl.mjs';

type Column = { name: string; notnull: number; dflt_value: string | null };

function columns(db: Database.Database, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Column[];
}

describe('applySchema — plans', () => {
  it('adds plan, badge and starts_on with their defaults', () => {
    const db = new Database(':memory:');
    applySchema(db);
    expect(columns(db, 'supplements').find((c) => c.name === 'plan')).toMatchObject({
      notnull: 1,
      dflt_value: "'supplements'",
    });
    expect(columns(db, 'supplements').some((c) => c.name === 'badge')).toBe(true);
    expect(columns(db, 'meal_slots').find((c) => c.name === 'plan')).toMatchObject({
      notnull: 1,
      dflt_value: "'supplements'",
    });
    expect(columns(db, 'day_variants').some((c) => c.name === 'plan')).toBe(true);
    expect(columns(db, 'schedule_rules').some((c) => c.name === 'starts_on')).toBe(true);
    expect(columns(db, 'plan_settings').map((c) => c.name)).toEqual(['user_id', 'plan', 'notes']);
  });

  it('copies existing supplement notes into plan_settings exactly once', () => {
    const db = new Database(':memory:');
    applySchema(db);
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, timezone, role, created_at) VALUES ('u1','u1','x','U1','Asia/Riyadh','owner','2026-01-01T00:00:00Z')",
    ).run();
    db.prepare("INSERT INTO supplement_settings (user_id, notes) VALUES ('u1', 'old notes')").run();
    applySchema(db);
    applySchema(db);
    expect(db.prepare('SELECT user_id, plan, notes FROM plan_settings').all()).toEqual([
      { user_id: 'u1', plan: 'supplements', notes: 'old notes' },
    ]);
  });
});
