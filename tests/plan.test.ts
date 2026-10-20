/**
 * resolveDay / resolveWeek unit tests (SPEC 6.3, M2 checklist).
 *
 * The fixture mirrors the seeded plan from SPEC 11.1, entirely in memory —
 * no database. Dates used: 2026-03-01 is a Sunday, 2026-03-02 a Monday,
 * 2026-03-05 a Thursday and 2026-03-06 a Friday.
 */
import { describe, expect, it } from 'vitest';
import {
  doseCount,
  resolveDay,
  resolveWeek,
  type PlanInput,
  type PlanLog,
  type PlanRule,
  type PlanSlot,
  type PlanSupplement,
  type PlanVariant,
  type ResolvedDay,
} from '@/lib/plan';
import { addDaysYmd, hmInTz, todayInTz, weekdayOfYmd } from '@/lib/dates';

const SUNDAY = '2026-03-01';
const MONDAY = '2026-03-02';
const THURSDAY = '2026-03-05';
const FRIDAY = '2026-03-06';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function sup(
  id: string,
  name: string,
  form: PlanSupplement['form'],
  defaultDose: string,
  sortOrder: number,
): PlanSupplement {
  return { id, name, form, defaultDose, color: '#d22f45', sortOrder, archived: false };
}

function slot(
  id: string,
  key: string,
  name: string,
  sortOrder: number,
  subtitle: string | null = null,
): PlanSlot {
  return { id, key, name, subtitle, defaultTime: null, sortOrder };
}

function rule(
  id: string,
  supplementId: string,
  slotId: string,
  days: number[],
  opts: {
    doseOverride?: string | null;
    note?: string | null;
    variant?: string | null;
    sortOrder?: number;
  } = {},
): PlanRule {
  return {
    id,
    supplementId,
    slotId,
    days,
    doseOverride: opts.doseOverride ?? null,
    note: opts.note ?? null,
    variant: opts.variant ?? null,
    sortOrder: opts.sortOrder ?? 0,
  };
}

type Fixture = Omit<PlanInput, 'date' | 'logs'>;

/** The owner's seeded plan (SPEC 11.1), ids matching the seed ("multi", "r-multi-lunch", …). */
function makeFixture(): Fixture {
  const supplements: PlanSupplement[] = [
    sup('multi', 'Multivitamin', 'tablet', '1 tablet', 0),
    sup('zinc', 'Zinc', 'chewable', '1 chewable', 1),
    sup('omega', 'Omega-3', 'softgel', '1 softgel', 2),
    sup('ashwa', 'Ashwagandha', 'tablet', '1 tablet', 3),
    sup('creatine', 'Creatine', 'scoop', '5 g', 4),
    sup('mag', 'Magnesium', 'capsule', '1 capsule', 5),
  ];
  const slots: PlanSlot[] = [
    slot('breakfast', 'breakfast', 'Breakfast', 0, 'Protein bar, honey and coffee'),
    slot('lunch', 'lunch', 'First lunch', 1),
    slot('dinner', 'dinner', 'Dinner', 2),
    slot('dinner1', 'dinner1', 'First dinner', 3, 'Two meals on Fridays'),
    slot('dinner2', 'dinner2', 'Second dinner', 4),
    slot('bed', 'bed', 'Before bed', 5),
  ];
  const rules: PlanRule[] = [
    // default variant
    rule('r-multi-lunch', 'multi', 'lunch', [0, 2, 4, 6], {
      note: 'At least an hour away from coffee',
      sortOrder: 0,
    }),
    rule('r-zinc-dinner', 'zinc', 'dinner', [1, 3, 5], { sortOrder: 1 }),
    rule('r-omega-lunch', 'omega', 'lunch', ALL_DAYS, { sortOrder: 2 }),
    rule('r-ashwa-breakfast', 'ashwa', 'breakfast', ALL_DAYS, { sortOrder: 3 }),
    rule('r-ashwa-dinner', 'ashwa', 'dinner', ALL_DAYS, { sortOrder: 4 }),
    rule('r-creatine-dinner', 'creatine', 'dinner', ALL_DAYS, { sortOrder: 5 }),
    rule('r-mag-bed', 'mag', 'bed', [0, 1, 2, 3], { sortOrder: 6 }),
    rule('r-mag-bed-gym', 'mag', 'bed', [4, 5, 6], {
      doseOverride: '2 capsules',
      note: 'Gym day dose',
      sortOrder: 7,
    }),
    // Friday two-meal variant
    rule('r2-ashwa-dinner1', 'ashwa', 'dinner1', ALL_DAYS, { variant: 'two_meal', sortOrder: 8 }),
    rule('r2-omega-dinner1', 'omega', 'dinner1', ALL_DAYS, { variant: 'two_meal', sortOrder: 9 }),
    rule('r2-zinc-dinner1', 'zinc', 'dinner1', [1, 3, 5], {
      variant: 'two_meal',
      note: 'Keeps it hours away from the magnesium',
      sortOrder: 10,
    }),
    // Multivitamin's two_meal rule exists but day 5 is not in its days, so it
    // must never appear on Friday (SPEC 11.1).
    rule('r2-multi-dinner1', 'multi', 'dinner1', [0, 2, 4, 6], {
      variant: 'two_meal',
      note: 'At least an hour away from coffee',
      sortOrder: 11,
    }),
    rule('r2-ashwa-dinner2', 'ashwa', 'dinner2', ALL_DAYS, { variant: 'two_meal', sortOrder: 12 }),
    rule('r2-creatine-dinner2', 'creatine', 'dinner2', ALL_DAYS, {
      variant: 'two_meal',
      sortOrder: 13,
    }),
    rule('r2-mag-bed', 'mag', 'bed', [4, 5, 6], {
      variant: 'two_meal',
      doseOverride: '2 capsules',
      note: 'Gym day dose',
      sortOrder: 14,
    }),
  ];
  const variants: PlanVariant[] = [{ day: 5, variant: 'two_meal', label: 'Two-meal day' }];
  return { supplements, slots, rules, variants };
}

function resolve(date: string, logs: PlanLog[] = [], fixture: Fixture = makeFixture()): ResolvedDay {
  return resolveDay({ date, logs, ...fixture });
}

function allItems(day: ResolvedDay) {
  return day.slots.flatMap((s) => s.items);
}

function has(day: ResolvedDay, supplementId: string): boolean {
  return allItems(day).some((i) => i.supplement.id === supplementId);
}

function log(ruleId: string, takenAt: string, undone = false, date = MONDAY): PlanLog {
  return { ruleId, date, takenAt, undone };
}

describe('resolveDay — alternating days', () => {
  it('fixture dates fall on the weekdays the tests assume', () => {
    expect(weekdayOfYmd(SUNDAY)).toBe(0);
    expect(weekdayOfYmd(MONDAY)).toBe(1);
    expect(weekdayOfYmd(THURSDAY)).toBe(4);
    expect(weekdayOfYmd(FRIDAY)).toBe(5);
  });

  it('a Sunday is a Multivitamin day: multivitamin present, zinc absent', () => {
    const day = resolve(SUNDAY);
    expect(has(day, 'multi')).toBe(true);
    expect(has(day, 'zinc')).toBe(false);
    expect(day.dayLabel).toBe('Multivitamin day');
    expect(day.dayLabelSupplement?.id).toBe('multi');
  });

  it('a Monday is a Zinc day: zinc present, multivitamin absent', () => {
    const day = resolve(MONDAY);
    expect(has(day, 'multi')).toBe(false);
    expect(has(day, 'zinc')).toBe(true);
    expect(day.dayLabel).toBe('Zinc day');
    expect(day.dayLabelSupplement?.id).toBe('zinc');
  });

  it('multivitamin and zinc never coincide across 7 consecutive dates', () => {
    for (let i = 0; i < 7; i++) {
      const day = resolve(addDaysYmd(SUNDAY, i));
      expect(has(day, 'multi') && has(day, 'zinc')).toBe(false);
    }
  });
});

describe('resolveDay — Friday two-meal variant', () => {
  it('resolves only two_meal rules into the two-meal slots', () => {
    const friday = resolve(FRIDAY);
    expect(friday.weekday).toBe(5);
    expect(friday.variant).toBe('two_meal');
    expect(friday.variantLabel).toBe('Two-meal day');
    expect(friday.slots.map((s) => s.slot.name)).toEqual([
      'First dinner',
      'Second dinner',
      'Before bed',
    ]);
    for (const item of allItems(friday)) {
      expect(item.rule.variant).toBe('two_meal');
    }
  });

  it('breakfast and lunch slots are absent on Friday', () => {
    const names = resolve(FRIDAY).slots.map((s) => s.slot.name);
    expect(names).not.toContain('Breakfast');
    expect(names).not.toContain('First lunch');
    expect(names).not.toContain('Dinner');
  });

  it('multivitamin is absent on Friday even though a two_meal rule for it exists', () => {
    const friday = resolve(FRIDAY);
    expect(has(friday, 'multi')).toBe(false);
  });

  it('zinc appears at First dinner with its note', () => {
    const friday = resolve(FRIDAY);
    const dinner1 = friday.slots.find((s) => s.slot.key === 'dinner1');
    expect(dinner1).toBeDefined();
    const zinc = dinner1?.items.find((i) => i.supplement.id === 'zinc');
    expect(zinc).toBeDefined();
    expect(zinc?.note).toBe('Keeps it hours away from the magnesium');
  });
});

describe('resolveDay — gym-day dose override', () => {
  it('Thursday: magnesium is 2 capsules with the gym-day note', () => {
    const thursday = resolve(THURSDAY);
    const mag = allItems(thursday).find((i) => i.supplement.id === 'mag');
    expect(mag).toBeDefined();
    expect(mag?.dose).toBe('2 capsules');
    expect(mag?.count).toBe(2);
    expect(mag?.note).toBe('Gym day dose');
    expect(mag?.rule.id).toBe('r-mag-bed-gym');
  });

  it('Monday: magnesium is the default 1 capsule', () => {
    const monday = resolve(MONDAY);
    const mag = allItems(monday).find((i) => i.supplement.id === 'mag');
    expect(mag).toBeDefined();
    expect(mag?.dose).toBe('1 capsule');
    expect(mag?.count).toBe(1);
    expect(mag?.note).toBeNull();
    expect(mag?.rule.id).toBe('r-mag-bed');
  });
});

describe('resolveDay — archived supplements', () => {
  it('archiving omega removes it from every day and drops progress.total', () => {
    const base = makeFixture();
    const archived: Fixture = {
      ...base,
      supplements: base.supplements.map((s) => (s.id === 'omega' ? { ...s, archived: true } : s)),
    };
    for (let i = 0; i < 7; i++) {
      const date = addDaysYmd(SUNDAY, i);
      expect(has(resolve(date, [], archived), 'omega')).toBe(false);
    }
    // Seeded plan has 6 items every day; archiving omega drops it to 5.
    expect(resolve(MONDAY).progress.total).toBe(6);
    expect(resolve(MONDAY, [], archived).progress.total).toBe(5);
    expect(resolve(FRIDAY).progress.total).toBe(6);
    expect(resolve(FRIDAY, [], archived).progress.total).toBe(5);
  });
});

describe('resolveDay — logs, latest row wins', () => {
  it('tick then a later undone row means not taken', () => {
    const logs = [
      log('r-zinc-dinner', '2026-03-02T10:00:00.000Z'),
      log('r-zinc-dinner', '2026-03-02T11:00:00.000Z', true),
    ];
    const day = resolve(MONDAY, logs);
    const zinc = allItems(day).find((i) => i.supplement.id === 'zinc');
    expect(zinc?.taken).toBe(false);
    expect(zinc?.takenAt).toBeNull();
    expect(day.progress.taken).toBe(0);
  });

  it('undone then a later re-tick means taken', () => {
    const logs = [
      log('r-zinc-dinner', '2026-03-02T10:00:00.000Z'),
      log('r-zinc-dinner', '2026-03-02T11:00:00.000Z', true),
      log('r-zinc-dinner', '2026-03-02T12:00:00.000Z'),
    ];
    const day = resolve(MONDAY, logs);
    const zinc = allItems(day).find((i) => i.supplement.id === 'zinc');
    expect(zinc?.taken).toBe(true);
    expect(zinc?.takenAt).toBe('2026-03-02T12:00:00.000Z');
    expect(day.progress.taken).toBe(1);
  });

  it('logs for other dates are ignored', () => {
    const logs = [log('r-omega-lunch', '2026-03-01T10:00:00.000Z', false, SUNDAY)];
    const day = resolve(MONDAY, logs);
    const omega = allItems(day).find((i) => i.supplement.id === 'omega');
    expect(omega?.taken).toBe(false);
    expect(day.progress.taken).toBe(0);
  });

  it('progress counts ticked items out of the day total', () => {
    const logs = [
      log('r-zinc-dinner', '2026-03-02T10:00:00.000Z'),
      log('r-omega-lunch', '2026-03-02T10:01:00.000Z'),
      log('r-ashwa-breakfast', '2026-03-02T10:02:00.000Z'),
    ];
    const day = resolve(MONDAY, logs);
    expect(day.progress).toEqual({ taken: 3, total: 6 });
  });
});

describe('timezone rollover (todayInTz)', () => {
  it('23:59 in Asia/Riyadh is still the same civil date', () => {
    const now = new Date('2026-03-01T20:59:00Z');
    expect(hmInTz(now, 'Asia/Riyadh')).toBe('23:59');
    expect(todayInTz('Asia/Riyadh', now)).toEqual({ ymd: '2026-03-01', weekday: 0 });
  });

  it('local midnight rolls over to the next date with the right weekday', () => {
    const now = new Date('2026-03-01T21:00:00Z');
    expect(todayInTz('Asia/Riyadh', now)).toEqual({ ymd: '2026-03-02', weekday: 1 });
  });

  it('weekdayOfYmd("2026-03-06") is Friday', () => {
    expect(weekdayOfYmd('2026-03-06')).toBe(5);
  });
});

describe('resolveWeek', () => {
  it('returns 7 days Sunday-first containing the input date', () => {
    const week = resolveWeek({ ...makeFixture(), date: '2026-03-04', logs: [] });
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.map((d) => d.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
    ]);
    expect(week.map((d) => d.date)).toContain('2026-03-04');
  });
});

describe('doseCount', () => {
  it('counts only countable pill units', () => {
    expect(doseCount('1 tablet')).toBe(1);
    expect(doseCount('2 capsules')).toBe(2);
    expect(doseCount('3 softgels')).toBe(3);
    expect(doseCount('1 chewable')).toBe(1);
    expect(doseCount('2 scoops')).toBe(2);
  });

  it('treats measured doses as a single glyph', () => {
    expect(doseCount('5 g')).toBe(1);
    expect(doseCount('10 ml')).toBe(1);
    expect(doseCount('200 mg')).toBe(1);
    expect(doseCount('2.5 g')).toBe(1);
  });

  it('clamps and defaults sensibly', () => {
    expect(doseCount('9 tablets')).toBe(4);
    expect(doseCount('a pinch')).toBe(1);
    expect(doseCount('')).toBe(1);
  });
});
