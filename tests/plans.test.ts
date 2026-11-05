/**
 * Plan scoping: a user's supplements and care plans share the engine and the
 * tables, and every read is filtered to one plan (design doc 2026-11-05).
 *
 * DATABASE_PATH must be ':memory:' before @/db is evaluated for the first
 * time, so this file sets the env at the very top and imports dynamically.
 */
process.env.DATABASE_PATH = ':memory:';

import { beforeAll, describe, expect, it } from 'vitest';
import { PLANS, PLAN_KEYS, isPlanKey } from '@/lib/plans';

type DbModule = typeof import('@/db');
type SchemaModule = typeof import('@/db/schema');
type SupplementsModule = typeof import('@/server/supplements');

let db: DbModule['db'];
let schema: SchemaModule;
let sup: SupplementsModule;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

beforeAll(async () => {
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  sup = await import('@/server/supplements');

  db.insert(schema.users)
    .values({
      id: 'u1',
      username: 'u1',
      passwordHash: 'fake-hash',
      displayName: 'U1',
      timezone: 'Asia/Riyadh',
      role: 'owner',
      createdAt: new Date().toISOString(),
    })
    .run();
  db.insert(schema.mealSlots)
    .values([
      { id: 's1', userId: 'u1', key: 'breakfast', name: 'Breakfast', sortOrder: 0, plan: 'supplements' },
      { id: 's2', userId: 'u1', key: 'am_face', name: 'Morning · Face', sortOrder: 0, plan: 'care' },
    ])
    .run();
  db.insert(schema.supplements)
    .values([
      { id: 'a', userId: 'u1', name: 'Multivitamin', form: 'tablet', defaultDose: '1 tablet', sortOrder: 0, plan: 'supplements' },
      { id: 'b', userId: 'u1', name: 'Sunscreen', form: 'tube', defaultDose: 'two finger-lengths', sortOrder: 0, plan: 'care' },
    ])
    .run();
  db.insert(schema.scheduleRules)
    .values([
      { id: 'r1', userId: 'u1', supplementId: 'a', slotId: 's1', days: ALL_DAYS, sortOrder: 0 },
      { id: 'r2', userId: 'u1', supplementId: 'b', slotId: 's2', days: ALL_DAYS, sortOrder: 0 },
    ])
    .run();
});

describe('plan registry', () => {
  it('knows both plans and their paths', () => {
    expect([...PLAN_KEYS]).toEqual(['supplements', 'care']);
    expect(PLANS.supplements.path).toBe('/supplements');
    expect(PLANS.care.path).toBe('/care');
    expect(isPlanKey('care')).toBe(true);
    expect(isPlanKey('workouts')).toBe(false);
  });
});

describe('plan-scoped queries', () => {
  it('getPlanData returns only the rows of the requested plan', () => {
    const s = sup.getPlanData('u1', 'supplements');
    expect(s.slots.map((x) => x.id)).toEqual(['s1']);
    expect(s.supplements.map((x) => x.id)).toEqual(['a']);
    expect(s.rules.map((x) => x.id)).toEqual(['r1']);
    const c = sup.getPlanData('u1', 'care');
    expect([c.slots[0].id, c.supplements[0].id, c.rules[0].id]).toEqual(['s2', 'b', 'r2']);
  });

  it('getSlotsForUser lists every plan when no plan is given', () => {
    expect(sup.getSlotsForUser('u1').map((x) => x.plan).sort()).toEqual(['care', 'supplements']);
    expect(sup.getSlotsForUser('u1', 'care').map((x) => x.id)).toEqual(['s2']);
  });

  it('notes are stored per plan', () => {
    sup.setSupplementNotes('u1', 'care', 'rules');
    expect(sup.getSupplementNotes('u1', 'care')).toBe('rules');
    expect(sup.getSupplementNotes('u1', 'supplements')).toBeNull();
  });
});

describe('first log date', () => {
  it('firstLogDate is per plan', () => {
    sup.setTaken('u1', 'r2', '2026-11-09', true);
    expect(sup.firstLogDate('u1', 'care')).toBe('2026-11-09');
    expect(sup.firstLogDate('u1', 'supplements')).toBeNull();
  });
});
