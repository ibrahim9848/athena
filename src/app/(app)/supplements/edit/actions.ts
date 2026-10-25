'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dayVariants, mealSlots, scheduleRules, supplements } from '@/db/schema';
import { requireUser, slideSessionCookie } from '@/lib/auth';
import { addDaysYmd, todayInTz } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { canAlternate, resolveDay } from '@/lib/plan';
import { getLogsForDate, getPlanData, setSupplementNotes } from '@/server/supplements';

const SUPPLEMENT_FORMS = ['tablet', 'capsule', 'softgel', 'chewable', 'scoop', 'other'] as const;
type SupplementForm = (typeof SUPPLEMENT_FORMS)[number];

/* ---------- form parsing helpers ---------- */

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function optStr(fd: FormData, key: string): string | null {
  const s = str(fd, key);
  return s === '' ? null : s;
}

/** Multiline text: keep inner newlines, normalise CRLF, '' -> null. */
function optText(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r\n/g, '\n').trimEnd();
  return s === '' ? null : s;
}

function intOr(fd: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

function isChecked(fd: FormData, key: string): boolean {
  return fd.get(key) != null;
}

/** The submitted weekday checkboxes as a sorted, de-duplicated 0..6 array. */
function parseDays(fd: FormData): number[] {
  const days = fd
    .getAll('days')
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

function parseSupplementForm(v: string): SupplementForm {
  return (SUPPLEMENT_FORMS as readonly string[]).includes(v) ? (v as SupplementForm) : 'other';
}

function parseColor(v: string | null): string | null {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

function parseTime(v: string | null): string | null {
  return v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

/**
 * The rotation fields from the supplement form. 1 (or empty) means no
 * rotation; a rotation without a valid start date starts today in the user's timezone.
 */
function parseRotation(
  fd: FormData,
  timezone: string,
): { everyNDays: number | null; rotationStart: string | null } {
  const n = Math.min(30, Math.max(1, intOr(fd, 'everyNDays', 1)));
  if (n <= 1) return { everyNDays: null, rotationStart: null };
  const start = optStr(fd, 'rotationStart');
  // Round-trip through date arithmetic so impossible dates (2026-02-31) are rejected.
  const valid = !!start && /^\d{4}-\d{2}-\d{2}$/.test(start) && addDaysYmd(start, 0) === start;
  return { everyNDays: n, rotationStart: valid ? start : todayInTz(timezone).ymd };
}

/** '', 'default' (any case) and null all mean the default variant. */
function normalizeVariant(v: string | null): string | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase().replace(/\s+/g, '_');
  return s === '' || s === 'default' ? null : s;
}

function normalizeKey(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, '_');
}

/* ---------- queries scoped to this module (always filtered by userId) ---------- */

function getSupplement(userId: string, id: string) {
  return db
    .select()
    .from(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
    .get();
}

function getSlot(userId: string, id: string) {
  return db
    .select()
    .from(mealSlots)
    .where(and(eq(mealSlots.id, id), eq(mealSlots.userId, userId)))
    .get();
}

function getRule(userId: string, id: string) {
  return db
    .select()
    .from(scheduleRules)
    .where(and(eq(scheduleRules.id, id), eq(scheduleRules.userId, userId)))
    .get();
}

function getVariantRow(userId: string, id: string) {
  return db
    .select()
    .from(dayVariants)
    .where(and(eq(dayVariants.id, id), eq(dayVariants.userId, userId)))
    .get();
}

function nextSortOrder(rows: { sortOrder: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
}

function revalidateSupplementPages(): void {
  revalidatePath('/supplements');
  revalidatePath('/supplements/edit');
  revalidatePath('/supplements/facts');
  revalidatePath('/supplements/history');
  revalidatePath('/');
}

/* ---------- supplements ---------- */

export async function upsertSupplementAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  const name = str(formData, 'name');
  const defaultDose = str(formData, 'defaultDose');
  if (!name || !defaultDose) return;
  const form = parseSupplementForm(str(formData, 'form'));
  const details = {
    ingredients: optText(formData, 'ingredients'),
    why: optText(formData, 'why'),
    watchFor: optText(formData, 'watchFor'),
    notes: optText(formData, 'notes'),
  };
  if (id) {
    const existing = getSupplement(user.id, id);
    if (!existing) return;
    db.update(supplements)
      .set({
        name,
        form,
        defaultDose,
        color: parseColor(optStr(formData, 'color')) ?? existing.color,
        sortOrder: intOr(formData, 'sortOrder', existing.sortOrder),
        archived: isChecked(formData, 'archived'),
        ...parseRotation(formData, user.timezone),
        ...details,
      })
      .where(and(eq(supplements.id, id), eq(supplements.userId, user.id)))
      .run();
  } else {
    const rows = db
      .select({ sortOrder: supplements.sortOrder })
      .from(supplements)
      .where(eq(supplements.userId, user.id))
      .all();
    db.insert(supplements)
      .values({
        id: newId(),
        userId: user.id,
        name,
        form,
        defaultDose,
        color: parseColor(optStr(formData, 'color')) ?? '#d22f45',
        sortOrder: nextSortOrder(rows),
        archived: false,
        ...details,
      })
      .run();
  }
  revalidateSupplementPages();
}

export async function deleteSupplementAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  if (!id) return;
  // The "Confirm delete" checkbox in the card's details must be ticked.
  if (!isChecked(formData, 'confirm')) return;
  const existing = getSupplement(user.id, id);
  if (!existing) return;
  db.delete(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, user.id)))
    .run();
  revalidateSupplementPages();
}

/* ---------- meal slots ---------- */

export async function upsertSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  const key = normalizeKey(str(formData, 'key'));
  const name = str(formData, 'name');
  if (!key || !name) return;
  const subtitle = optStr(formData, 'subtitle');
  const defaultTime = parseTime(optStr(formData, 'defaultTime'));
  if (id) {
    const existing = getSlot(user.id, id);
    if (!existing) return;
    db.update(mealSlots)
      .set({
        key,
        name,
        subtitle,
        defaultTime,
        sortOrder: intOr(formData, 'sortOrder', existing.sortOrder),
      })
      .where(and(eq(mealSlots.id, id), eq(mealSlots.userId, user.id)))
      .run();
  } else {
    const rows = db
      .select({ sortOrder: mealSlots.sortOrder })
      .from(mealSlots)
      .where(eq(mealSlots.userId, user.id))
      .all();
    db.insert(mealSlots)
      .values({
        id: newId(),
        userId: user.id,
        key,
        name,
        subtitle,
        defaultTime,
        sortOrder: intOr(formData, 'sortOrder', nextSortOrder(rows)),
      })
      .run();
  }
  revalidateSupplementPages();
}

export async function deleteSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  if (!id) return;
  const existing = getSlot(user.id, id);
  if (!existing) return;
  // Rules in this slot go with it (FK cascade), which is what the UI warns about.
  db.delete(mealSlots)
    .where(and(eq(mealSlots.id, id), eq(mealSlots.userId, user.id)))
    .run();
  revalidateSupplementPages();
}

/* ---------- day variants ---------- */

export async function upsertVariantAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  const day = intOr(formData, 'day', -1);
  if (day < 0 || day > 6) return;
  const variant = normalizeVariant(str(formData, 'variant'));
  if (!variant) return;
  const label = str(formData, 'label') || variant;
  // One variant per weekday: resolution would otherwise be ambiguous, so an
  // insert (or a move onto an occupied day) replaces that day's existing row.
  const occupying = db
    .select()
    .from(dayVariants)
    .where(and(eq(dayVariants.userId, user.id), eq(dayVariants.day, day)))
    .get();
  if (id) {
    const existing = getVariantRow(user.id, id);
    if (!existing) return;
    if (occupying && occupying.id !== id) {
      db.delete(dayVariants).where(eq(dayVariants.id, occupying.id)).run();
    }
    db.update(dayVariants)
      .set({ day, variant, label })
      .where(and(eq(dayVariants.id, id), eq(dayVariants.userId, user.id)))
      .run();
  } else if (occupying) {
    db.update(dayVariants).set({ variant, label }).where(eq(dayVariants.id, occupying.id)).run();
  } else {
    db.insert(dayVariants).values({ id: newId(), userId: user.id, day, variant, label }).run();
  }
  revalidateSupplementPages();
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  if (!id) return;
  const existing = getVariantRow(user.id, id);
  if (!existing) return;
  db.delete(dayVariants)
    .where(and(eq(dayVariants.id, id), eq(dayVariants.userId, user.id)))
    .run();
  revalidateSupplementPages();
}

/* ---------- schedule rules ---------- */

export async function upsertRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  const supplementId = str(formData, 'supplementId');
  const slotId = str(formData, 'slotId');
  if (!supplementId || !slotId) return;
  // Both referenced rows must belong to this user.
  if (!getSupplement(user.id, supplementId)) return;
  if (!getSlot(user.id, slotId)) return;
  const days = parseDays(formData);
  const doseOverride = optStr(formData, 'doseOverride');
  const note = optStr(formData, 'note');
  const variant = normalizeVariant(optStr(formData, 'variant'));
  if (id) {
    const existing = getRule(user.id, id);
    if (!existing) return;
    // A rule needs at least one day: an empty submission is ignored, never saved.
    if (days.length === 0) return;
    db.update(scheduleRules)
      .set({
        supplementId,
        slotId,
        days,
        doseOverride,
        note,
        variant,
        sortOrder: intOr(formData, 'sortOrder', existing.sortOrder),
      })
      .where(and(eq(scheduleRules.id, id), eq(scheduleRules.userId, user.id)))
      .run();
  } else {
    const rows = db
      .select({ sortOrder: scheduleRules.sortOrder })
      .from(scheduleRules)
      .where(eq(scheduleRules.userId, user.id))
      .all();
    db.insert(scheduleRules)
      .values({
        id: newId(),
        userId: user.id,
        supplementId,
        slotId,
        // The add form has no weekday checkboxes; a new rule starts on every day.
        days: days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6],
        doseOverride,
        note,
        variant,
        sortOrder: nextSortOrder(rows),
      })
      .run();
  }
  revalidateSupplementPages();
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = optStr(formData, 'id');
  if (!id) return;
  const existing = getRule(user.id, id);
  if (!existing) return;
  db.delete(scheduleRules)
    .where(and(eq(scheduleRules.id, id), eq(scheduleRules.userId, user.id)))
    .run();
  revalidateSupplementPages();
}

/** "Alternate with…": rule A takes Sun/Tue/Thu/Sat, rule B takes Mon/Wed/Fri. */
/**
 * Make the two rules' supplements alternate every other day, counting on
 * across weeks. Their rules are widened to all weekdays so the rotation alone
 * decides which one is due (canAlternate guarantees one rule per variant, so
 * nothing doubles up).
 *
 * Which one is due today continues the existing pattern: one already taken
 * today stays today's; otherwise the one that was due or taken yesterday goes
 * tomorrow, so the switch-over never repeats a supplement two days running.
 */
export async function setAlternatingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const ruleAId = str(formData, 'ruleAId');
  const ruleBId = str(formData, 'ruleBId');
  if (!ruleAId || !ruleBId || ruleAId === ruleBId) return;
  const ruleA = getRule(user.id, ruleAId);
  const ruleB = getRule(user.id, ruleBId);
  if (!ruleA || !ruleB || ruleA.supplementId === ruleB.supplementId) return;
  const a = ruleA.supplementId;
  const b = ruleB.supplementId;

  const data = getPlanData(user.id);
  const supA = data.supplements.find((s) => s.id === a);
  const supB = data.supplements.find((s) => s.id === b);
  if (!supA || !supB || supA.archived || supB.archived) return;
  const rulesOf = (id: string) => data.rules.filter((r) => r.supplementId === id);
  if (!canAlternate(rulesOf(a), rulesOf(b))) return;

  const today = todayInTz(user.timezone).ymd;
  const onDay = (date: string) => {
    const items = resolveDay({ date, ...data, logs: getLogsForDate(user.id, date) }).slots.flatMap(
      (s) => s.items,
    );
    return {
      due: new Set(items.map((i) => i.supplement.id)),
      taken: new Set(items.filter((i) => i.taken).map((i) => i.supplement.id)),
    };
  };
  const now = onDay(today);
  const before = onDay(addDaysYmd(today, -1));
  let first = a;
  if (now.taken.has(b) && !now.taken.has(a)) first = b;
  else if (!now.taken.has(a) && !now.taken.has(b)) {
    const hadA = before.taken.has(a) || before.due.has(a);
    const hadB = before.taken.has(b) || before.due.has(b);
    if (hadA && !hadB) first = b;
  }
  const second = first === a ? b : a;
  const pairs: [string, string][] = [
    [first, today],
    [second, addDaysYmd(today, 1)],
  ];
  db.transaction((tx) => {
    for (const [supplementId, rotationStart] of pairs) {
      tx.update(supplements)
        .set({ everyNDays: 2, rotationStart })
        .where(and(eq(supplements.id, supplementId), eq(supplements.userId, user.id)))
        .run();
      tx.update(scheduleRules)
        .set({ days: [0, 1, 2, 3, 4, 5, 6] })
        .where(
          and(eq(scheduleRules.supplementId, supplementId), eq(scheduleRules.userId, user.id)),
        )
        .run();
    }
  });
  revalidateSupplementPages();
}

/* ---------- plan notes ---------- */

export async function saveNotesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const v = formData.get('notes');
  const notes = typeof v === 'string' ? v.replace(/\r\n/g, '\n') : '';
  setSupplementNotes(user.id, notes);
  revalidateSupplementPages();
}
