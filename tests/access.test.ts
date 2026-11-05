/**
 * User isolation test (SPEC M1): a second user can never see or touch the
 * first user's data.
 *
 * DATABASE_PATH must be ':memory:' before @/db is evaluated for the first
 * time (it reads the env at first import), so this file sets the env at the
 * very top and only ever imports the db and server modules dynamically.
 */
process.env.DATABASE_PATH = ':memory:';

import { beforeAll, describe, expect, it } from 'vitest';

type DbModule = typeof import('@/db');
type SchemaModule = typeof import('@/db/schema');
type SupplementsModule = typeof import('@/server/supplements');

let db: DbModule['db'];
let schema: SchemaModule;
let sup: SupplementsModule;

const A = 'user-a';
const B = 'user-b';
const TZ = 'Asia/Riyadh';
const DATE = '2026-03-02'; // a Monday

const A_SLOT_ID = 'slot-a-breakfast';
const A_SUPPLEMENT_ID = 'supp-a-multi';
const A_RULE_ID = 'rule-a-multi';
const A_PROGRAM_ID = 'prog-a';
const A_PROGRAM_DAY_ID = 'pday-a-push';
const A_EXERCISE_ID = 'ex-a-chest-press';

beforeAll(async () => {
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  sup = await import('@/server/supplements');

  const now = new Date().toISOString();

  db.insert(schema.users)
    .values([
      {
        id: A,
        username: 'alice',
        passwordHash: 'fake-hash-a',
        displayName: 'Alice',
        timezone: TZ,
        role: 'owner',
        createdAt: now,
      },
      {
        id: B,
        username: 'bob',
        passwordHash: 'fake-hash-b',
        displayName: 'Bob',
        timezone: TZ,
        role: 'member',
        createdAt: now,
      },
    ])
    .run();

  // A's supplement plan: one slot, one supplement, one rule on every day.
  db.insert(schema.mealSlots)
    .values({ id: A_SLOT_ID, userId: A, key: 'breakfast', name: 'Breakfast', sortOrder: 0 })
    .run();
  db.insert(schema.supplements)
    .values({
      id: A_SUPPLEMENT_ID,
      userId: A,
      name: 'Multivitamin',
      form: 'tablet',
      defaultDose: '1 tablet',
      sortOrder: 0,
    })
    .run();
  db.insert(schema.scheduleRules)
    .values({
      id: A_RULE_ID,
      userId: A,
      supplementId: A_SUPPLEMENT_ID,
      slotId: A_SLOT_ID,
      days: [0, 1, 2, 3, 4, 5, 6],
      sortOrder: 0,
    })
    .run();

  // A's program: one day with one exercise, three sets.
  db.insert(schema.programs)
    .values({ id: A_PROGRAM_ID, userId: A, name: 'Thu-Sat Lifting Plan', isActive: true })
    .run();
  db.insert(schema.programDays)
    .values({
      id: A_PROGRAM_DAY_ID,
      programId: A_PROGRAM_ID,
      weekday: 4,
      name: 'Push',
      focus: 'chest, shoulders, triceps',
      sortOrder: 0,
    })
    .run();
  db.insert(schema.exercises)
    .values({
      id: A_EXERCISE_ID,
      userId: A,
      name: 'Chest press',
      mainMuscles: ['Chest'],
      helpingMuscles: ['Triceps'],
      sortOrder: 0,
    })
    .run();
  db.insert(schema.programExercises)
    .values({
      id: 'pex-a-1',
      programDayId: A_PROGRAM_DAY_ID,
      exerciseId: A_EXERCISE_ID,
      sets: 3,
      repsMin: 8,
      repsMax: 10,
      restSeconds: 120,
      sortOrder: 0,
    })
    .run();
});

describe('supplement data isolation', () => {
  it("getPlanData(B) is empty while A sees their own plan", () => {
    const a = sup.getPlanData(A, 'supplements');
    expect(a.supplements).toHaveLength(1);
    expect(a.slots).toHaveLength(1);
    expect(a.rules).toHaveLength(1);

    const b = sup.getPlanData(B, 'supplements');
    expect(b.supplements).toEqual([]);
    expect(b.rules).toEqual([]);
    expect(b.slots).toEqual([]);
  });

  it('resolveDayForUser(B) resolves an empty plan', () => {
    expect(sup.resolveDayForUser(B, DATE, 'supplements').progress.total).toBe(0);
    expect(sup.resolveDayForUser(A, DATE, 'supplements').progress.total).toBe(1);
  });

  it("setTaken(B, <A's rule>) throws and inserts nothing", () => {
    expect(() => sup.setTaken(B, A_RULE_ID, DATE, true)).toThrow();
    expect(db.select().from(schema.supplementLogs).all()).toHaveLength(0);
    expect(sup.getLogsForDate(A, DATE)).toEqual([]);
    const aDay = sup.resolveDayForUser(A, DATE, 'supplements');
    expect(aDay.progress.taken).toBe(0);
  });
});

