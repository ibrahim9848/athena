import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db';
import {
  dayVariants,
  mealSlots,
  planSettings,
  scheduleRules,
  supplementLogs,
  supplements,
} from '@/db/schema';
import { addDaysYmd, todayInTz } from '@/lib/dates';
import { resolveDay, resolveWeek, type PlanInput, type ResolvedDay } from '@/lib/plan';
import type { PlanKey } from '@/lib/plans';
import { newId } from '@/lib/ids';

/** Everything needed to resolve any day of one of a user's plans. */
export function getPlanData(userId: string, plan: PlanKey) {
  const planSupplements = db
    .select()
    .from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.plan, plan)))
    .orderBy(asc(supplements.sortOrder), asc(supplements.name))
    .all();
  const supplementIds = planSupplements.map((s) => s.id);
  return {
    supplements: planSupplements,
    slots: db
      .select()
      .from(mealSlots)
      .where(and(eq(mealSlots.userId, userId), eq(mealSlots.plan, plan)))
      .orderBy(asc(mealSlots.sortOrder), asc(mealSlots.name))
      .all(),
    // A rule belongs to the plan of its supplement.
    rules:
      supplementIds.length === 0
        ? []
        : db
            .select()
            .from(scheduleRules)
            .where(
              and(
                eq(scheduleRules.userId, userId),
                inArray(scheduleRules.supplementId, supplementIds),
              ),
            )
            .orderBy(asc(scheduleRules.sortOrder))
            .all(),
    variants: db
      .select()
      .from(dayVariants)
      .where(and(eq(dayVariants.userId, userId), eq(dayVariants.plan, plan)))
      .orderBy(asc(dayVariants.day))
      .all(),
  };
}

export function getLogsForDate(userId: string, date: string) {
  return db
    .select()
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date)))
    .all();
}

export function getLogsBetween(userId: string, fromDate: string, toDate: string) {
  return db
    .select()
    .from(supplementLogs)
    .where(
      and(
        eq(supplementLogs.userId, userId),
        gte(supplementLogs.date, fromDate),
        lte(supplementLogs.date, toDate),
      ),
    )
    .all();
}

export function resolveDayForUser(userId: string, date: string, plan: PlanKey): ResolvedDay {
  const data = getPlanData(userId, plan);
  const logs = getLogsForDate(userId, date);
  const input: PlanInput = { date, ...data, logs };
  return resolveDay(input);
}

/** The 7 days of the week containing `date` (Sunday first), logs attached per day. */
export function resolveWeekForUser(userId: string, date: string, plan: PlanKey): ResolvedDay[] {
  const data = getPlanData(userId, plan);
  const week = resolveWeek({ ...data, date, logs: [] });
  return week.map((day) => {
    const logs = getLogsForDate(userId, day.date);
    return resolveDay({ date: day.date, ...data, logs });
  });
}

export function resolveTodayForUser(userId: string, timezone: string, plan: PlanKey): ResolvedDay {
  const { ymd } = todayInTz(timezone);
  return resolveDayForUser(userId, ymd, plan);
}

/**
 * Tick or untick a rule for a date. A tick inserts a log row; an untick inserts
 * a row with undone=true (history stays auditable).
 */
export function setTaken(userId: string, ruleId: string, date: string, taken: boolean): void {
  const rule = db
    .select()
    .from(scheduleRules)
    .where(and(eq(scheduleRules.id, ruleId), eq(scheduleRules.userId, userId)))
    .get();
  if (!rule) throw new Error('Rule not found');
  db.insert(supplementLogs)
    .values({
      id: newId(),
      userId,
      date,
      ruleId,
      takenAt: new Date().toISOString(),
      undone: !taken,
    })
    .run();
}

/** Per-day taken/total for the inclusive date range, for the history heat-strip. */
export function historyRange(
  userId: string,
  fromDate: string,
  toDate: string,
  plan: PlanKey,
): { date: string; taken: number; total: number }[] {
  const data = getPlanData(userId, plan);
  const logs = getLogsBetween(userId, fromDate, toDate);
  const out: { date: string; taken: number; total: number }[] = [];
  for (let d = fromDate; d <= toDate; d = addDaysYmd(d, 1)) {
    const resolved = resolveDay({
      date: d,
      ...data,
      logs: logs.filter((l) => l.date === d),
    });
    out.push({ date: d, ...resolved.progress });
  }
  return out;
}

export function getSupplementNotes(userId: string, plan: PlanKey): string | null {
  const row = db
    .select()
    .from(planSettings)
    .where(and(eq(planSettings.userId, userId), eq(planSettings.plan, plan)))
    .get();
  return row?.notes ?? null;
}

export function setSupplementNotes(userId: string, plan: PlanKey, notes: string): void {
  db.insert(planSettings)
    .values({ userId, plan, notes })
    .onConflictDoUpdate({ target: [planSettings.userId, planSettings.plan], set: { notes } })
    .run();
}

/** Supplements with the weekdays each is scheduled (default variant), for the facts page. */
export function supplementsWithCoverage(userId: string, plan: PlanKey) {
  const data = getPlanData(userId, plan);
  return data.supplements
    .filter((s) => !s.archived)
    .map((s) => {
      const rules = data.rules.filter(
        (r) =>
          r.supplementId === s.id &&
          (r.variant == null || r.variant === '' || r.variant === 'default'),
      );
      const days = new Set<number>();
      rules.forEach((r) => r.days.forEach((d) => days.add(d)));
      // Days where the dose differs from the default (e.g. gym-day double dose)
      const boosted = new Set<number>();
      rules
        .filter((r) => r.doseOverride && r.doseOverride !== s.defaultDose)
        .forEach((r) => r.days.forEach((d) => boosted.add(d)));
      return { supplement: s, rules, days, boosted, slots: data.slots };
    });
}

export function latestLogDates(userId: string, limit = 60): string[] {
  const rows = db
    .selectDistinct({ date: supplementLogs.date })
    .from(supplementLogs)
    .where(eq(supplementLogs.userId, userId))
    .orderBy(desc(supplementLogs.date))
    .limit(limit)
    .all();
  return rows.map((r) => r.date);
}

export function getRuleForUser(userId: string, ruleId: string) {
  return db
    .select()
    .from(scheduleRules)
    .where(and(eq(scheduleRules.id, ruleId), eq(scheduleRules.userId, userId)))
    .get();
}

/** A user's slots — one plan's, or every plan's when `plan` is omitted (reminders). */
export function getSlotsForUser(userId: string, plan?: PlanKey) {
  return db
    .select()
    .from(mealSlots)
    .where(plan ? and(eq(mealSlots.userId, userId), eq(mealSlots.plan, plan)) : eq(mealSlots.userId, userId))
    .orderBy(asc(mealSlots.sortOrder))
    .all();
}

export function getSlotForUser(userId: string, slotId: string) {
  return db
    .select()
    .from(mealSlots)
    .where(and(eq(mealSlots.id, slotId), eq(mealSlots.userId, userId)))
    .get();
}

export { inArray };
