/**
 * Supplement plan resolution. Pure and deterministic: everything it needs is
 * passed in, so it is unit-testable without a database (see tests/plan.test.ts).
 */

export type PlanSupplement = {
  id: string;
  name: string;
  form: 'tablet' | 'capsule' | 'softgel' | 'chewable' | 'scoop' | 'other';
  defaultDose: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  /** Repeat every N days from rotationStart; null/1 = no rotation. */
  everyNDays?: number | null;
  /** YYYY-MM-DD the rotation counts from. */
  rotationStart?: string | null;
};

export type PlanSlot = {
  id: string;
  key: string;
  name: string;
  subtitle: string | null;
  defaultTime: string | null;
  sortOrder: number;
};

export type PlanRule = {
  id: string;
  supplementId: string;
  slotId: string;
  days: number[];
  doseOverride: string | null;
  note: string | null;
  variant: string | null;
  sortOrder: number;
};

export type PlanVariant = {
  day: number;
  variant: string;
  label: string;
};

export type PlanLog = {
  ruleId: string;
  date: string;
  takenAt: string;
  undone: boolean;
};

export type PlanInput = {
  /** YYYY-MM-DD in the user's timezone */
  date: string;
  supplements: PlanSupplement[];
  slots: PlanSlot[];
  rules: PlanRule[];
  variants: PlanVariant[];
  /** Logs for `date` only (extra rows for other dates are ignored). */
  logs: PlanLog[];
};

export type ResolvedItem = {
  rule: PlanRule;
  supplement: PlanSupplement;
  dose: string;
  /** Number of pill glyphs to draw for this item (parsed from the dose). */
  count: number;
  note: string | null;
  taken: boolean;
  takenAt: string | null;
};

export type ResolvedSlot = {
  slot: PlanSlot;
  items: ResolvedItem[];
};

export type ResolvedDay = {
  date: string;
  weekday: number;
  /** e.g. "Multivitamin day" — the first partial-week supplement scheduled today. */
  dayLabel: string | null;
  /** Supplement backing dayLabel, for the badge glyph. */
  dayLabelSupplement: PlanSupplement | null;
  /** Label of the day variant in effect (e.g. "Two-meal day"), if any. */
  variantLabel: string | null;
  variant: string | null;
  slots: ResolvedSlot[];
  progress: { taken: number; total: number };
};

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const COUNTABLE_UNITS =
  /^(tablets?|capsules?|softgels?|chewables?|scoops?|pills?|caplets?|chews?|tabs?|caps?|gummies|gummy|drops?)\b/i;

/**
 * How many pill glyphs a dose draws: the leading integer of a countable dose
 * ("2 capsules" -> 2), clamped to 1..4. Measured doses ("5 g", "10 ml") are a
 * single glyph — only unit words that mean "pieces" count.
 */
export function doseCount(dose: string): number {
  const m = /^(\d+)\s+(.*)$/.exec(dose.trim());
  if (!m || !COUNTABLE_UNITS.test(m[2])) return 1;
  return Math.max(1, Math.min(4, parseInt(m[1], 10)));
}

/** Days since the Unix epoch for a civil YYYY-MM-DD date. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function isRotating(s: Pick<PlanSupplement, 'everyNDays' | 'rotationStart'>): boolean {
  return (s.everyNDays ?? 1) > 1 && !!s.rotationStart;
}

/**
 * Whether a rotating supplement falls on `date`. Counted in calendar days
 * from rotationStart, so the rotation carries straight across week
 * boundaries (and works for dates before the start too). Supplements without
 * a rotation are on every date; their rules' weekdays decide.
 */
export function isRotationDay(
  s: Pick<PlanSupplement, 'everyNDays' | 'rotationStart'>,
  date: string,
): boolean {
  if (!isRotating(s)) return true;
  const n = s.everyNDays!;
  const diff = dayNumber(date) - dayNumber(s.rotationStart!);
  return ((diff % n) + n) % n === 0;
}

/** '' for the default day, otherwise the variant key. */
function variantKey(v: string | null): string {
  return v == null || v === '' || v === 'default' ? '' : v;
}

/**
 * Whether two supplements can become an every-other-day pair: each has exactly
 * one rule per day variant and both cover the same variants. A supplement split
 * across several rules (e.g. a weekday-dependent dose) would double up once its
 * rules are widened to every weekday, and a variant only one of them covers
 * would silently drop the other on that day.
 */
export function canAlternate(rulesA: PlanRule[], rulesB: PlanRule[]): boolean {
  const signature = (rules: PlanRule[]): string | null => {
    const keys = rules.map((r) => variantKey(r.variant));
    if (keys.length === 0 || new Set(keys).size !== keys.length) return null;
    return keys.sort().join('|');
  };
  const a = signature(rulesA);
  return a !== null && a === signature(rulesB);
}

function ruleMatchesVariant(ruleVariant: string | null, dayVariant: string | null): boolean {
  const isDefault = ruleVariant == null || ruleVariant === '' || ruleVariant === 'default';
  if (dayVariant == null) return isDefault;
  return ruleVariant === dayVariant;
}

/** Latest log row per rule id (by takenAt, then insertion order). */
function latestLogByRule(logs: PlanLog[], date: string): Map<string, PlanLog> {
  const map = new Map<string, PlanLog>();
  for (const log of logs) {
    if (log.date !== date) continue;
    const prev = map.get(log.ruleId);
    if (!prev || log.takenAt >= prev.takenAt) map.set(log.ruleId, log);
  }
  return map;
}

export function resolveDay(input: PlanInput): ResolvedDay {
  const weekday = weekdayOf(input.date);
  const dayVariant = input.variants.find((v) => v.day === weekday) ?? null;

  const supplementById = new Map(input.supplements.map((s) => [s.id, s]));
  const slotById = new Map(input.slots.map((s) => [s.id, s]));
  const latest = latestLogByRule(input.logs, input.date);

  const active = input.rules.filter((rule) => {
    if (!ruleMatchesVariant(rule.variant, dayVariant?.variant ?? null)) return false;
    if (!rule.days.includes(weekday)) return false;
    const supplement = supplementById.get(rule.supplementId);
    if (!supplement || supplement.archived) return false;
    if (isRotating(supplement) && input.date < supplement.rotationStart!) {
      // The schedule before the rotation began is no longer known, so show the
      // supplement only where it was actually taken — history isn't rewritten.
      const log = latest.get(rule.id);
      if (!log || log.undone) return false;
    } else if (!isRotationDay(supplement, input.date)) {
      return false;
    }
    if (!slotById.has(rule.slotId)) return false;
    return true;
  });

  const bySlot = new Map<string, ResolvedItem[]>();
  for (const rule of active) {
    const supplement = supplementById.get(rule.supplementId)!;
    const dose = rule.doseOverride ?? supplement.defaultDose;
    const log = latest.get(rule.id) ?? null;
    const taken = !!log && !log.undone;
    const item: ResolvedItem = {
      rule,
      supplement,
      dose,
      count: doseCount(dose),
      note: rule.note,
      taken,
      takenAt: taken ? log!.takenAt : null,
    };
    const list = bySlot.get(rule.slotId) ?? [];
    list.push(item);
    bySlot.set(rule.slotId, list);
  }

  const slots: ResolvedSlot[] = [...input.slots]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .filter((slot) => bySlot.has(slot.id))
    .map((slot) => ({
      slot,
      items: bySlot
        .get(slot.id)!
        .sort(
          (a, b) =>
            a.rule.sortOrder - b.rule.sortOrder ||
            a.supplement.sortOrder - b.supplement.sortOrder ||
            a.supplement.name.localeCompare(b.supplement.name),
        ),
    }));

  const items = slots.flatMap((s) => s.items);
  const progress = {
    taken: items.filter((i) => i.taken).length,
    total: items.length,
  };

  // "Multivitamin day" / "Zinc day": the first supplement (by sort order)
  // scheduled today that is not an every-day one — it rotates, or its
  // default-variant rules do not cover the whole week.
  const coverage = new Map<string, Set<number>>();
  for (const rule of input.rules) {
    if (!(rule.variant == null || rule.variant === '' || rule.variant === 'default')) continue;
    const set = coverage.get(rule.supplementId) ?? new Set<number>();
    rule.days.forEach((d) => set.add(d));
    coverage.set(rule.supplementId, set);
  }
  const partial = items
    .map((i) => i.supplement)
    .filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx)
    .filter((s) => isRotating(s) || (coverage.get(s.id)?.size ?? 7) < 7)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const dayLabelSupplement = partial[0] ?? null;

  return {
    date: input.date,
    weekday,
    dayLabel: dayLabelSupplement ? `${dayLabelSupplement.name} day` : null,
    dayLabelSupplement,
    variantLabel: dayVariant?.label ?? null,
    variant: dayVariant?.variant ?? null,
    slots,
    progress,
  };
}

/** Resolve all seven weekdays of the week containing `date` (Sunday first). */
export function resolveWeek(
  input: Omit<PlanInput, 'date' | 'logs'> & { date: string; logs: PlanLog[] },
): ResolvedDay[] {
  const weekday = weekdayOf(input.date);
  const [y, m, d] = input.date.split('-').map(Number);
  const days: ResolvedDay[] = [];
  for (let w = 0; w < 7; w++) {
    const dt = new Date(Date.UTC(y, m - 1, d + (w - weekday)));
    const ymd = dt.toISOString().slice(0, 10);
    days.push(resolveDay({ ...input, date: ymd }));
  }
  return days;
}
