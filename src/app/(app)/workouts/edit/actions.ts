'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { exercises, programDays, programExercises, programs, sessionRules } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { newId } from '@/lib/ids';
import {
  getExerciseForUser,
  getProgramDayForUser,
  getProgramForUser,
  getPrograms,
} from '@/server/workouts';

/* ---------- form parsing helpers ---------- */

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function fieldOrNull(formData: FormData, key: string): string | null {
  const value = field(formData, key);
  return value === '' ? null : value;
}

/** Trimmed textarea value (keeps inner newlines), or null when empty. */
function textareaOrNull(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\r\n/g, '\n').trim();
  return trimmed === '' ? null : trimmed;
}

function intField(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}

function muscleList(formData: FormData, key: string): string[] {
  return field(formData, key)
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

function viewField(formData: FormData, key: string): 'side' | 'front' | 'top' | null {
  const value = field(formData, key);
  return value === 'side' || value === 'front' || value === 'top' ? value : null;
}

function parseSetScheme(
  formData: FormData,
): { sets: number; repsMin: number; repsMax: number; restSeconds: number } | null {
  const sets = intField(formData, 'sets');
  const repsMin = intField(formData, 'repsMin');
  const repsMax = intField(formData, 'repsMax');
  const restSeconds = intField(formData, 'restSeconds');
  if (sets === null || repsMin === null || repsMax === null || restSeconds === null) return null;
  if (sets < 1 || repsMin < 1 || restSeconds < 0) return null;
  return { sets, repsMin, repsMax: Math.max(repsMin, repsMax), restSeconds };
}

function revalidateWorkoutPages(): void {
  revalidatePath('/workouts');
  revalidatePath('/workouts/edit');
  revalidatePath('/');
}

/* ---------- ownership checks via the join chain ---------- */

/** program exercise → program day → program → user. */
function programExerciseForUser(userId: string, programExerciseId: string) {
  return db
    .select({ id: programExercises.id })
    .from(programExercises)
    .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(and(eq(programExercises.id, programExerciseId), eq(programs.userId, userId)))
    .get();
}

/** session rule → program → user. */
function sessionRuleForUser(userId: string, ruleId: string) {
  return db
    .select({ id: sessionRules.id })
    .from(sessionRules)
    .innerJoin(programs, eq(sessionRules.programId, programs.id))
    .where(and(eq(sessionRules.id, ruleId), eq(programs.userId, userId)))
    .get();
}

/* ---------- programs ---------- */

export async function addProgramAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = field(formData, 'name');
  if (!name) return;
  const isFirst = getPrograms(user.id).length === 0;
  db.insert(programs)
    .values({
      id: newId(),
      userId: user.id,
      name,
      description: fieldOrNull(formData, 'description'),
      isActive: isFirst,
      restDayLabel: field(formData, 'restDayLabel') || 'Rest',
      restDayNotes: textareaOrNull(formData, 'restDayNotes'),
    })
    .run();
  revalidateWorkoutPages();
}

export async function updateProgramAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programId = field(formData, 'programId');
  if (!programId || !getProgramForUser(user.id, programId)) return;
  const name = field(formData, 'name');
  if (!name) return;
  db.update(programs)
    .set({
      name,
      description: fieldOrNull(formData, 'description'),
      restDayLabel: field(formData, 'restDayLabel') || 'Rest',
      restDayNotes: textareaOrNull(formData, 'restDayNotes'),
    })
    .where(eq(programs.id, programId))
    .run();
  revalidateWorkoutPages();
}

export async function deleteProgramAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!checkbox(formData, 'confirm')) return;
  const programId = field(formData, 'programId');
  if (!programId || !getProgramForUser(user.id, programId)) return;
  db.delete(programs).where(eq(programs.id, programId)).run();
  revalidateWorkoutPages();
}

export async function setActiveProgramAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programId = field(formData, 'programId');
  if (!programId || !getProgramForUser(user.id, programId)) return;
  db.transaction((tx) => {
    tx.update(programs).set({ isActive: false }).where(eq(programs.userId, user.id)).run();
    tx.update(programs).set({ isActive: true }).where(eq(programs.id, programId)).run();
  });
  revalidateWorkoutPages();
}

/* ---------- program days ---------- */

export async function addProgramDayAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programId = field(formData, 'programId');
  if (!programId || !getProgramForUser(user.id, programId)) return;
  const name = field(formData, 'name');
  const weekday = intField(formData, 'weekday');
  if (!name || weekday === null || weekday < 0 || weekday > 6) return;
  // One day per weekday: the week strip and the #day-<weekday> anchors assume it.
  const taken = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(and(eq(programDays.programId, programId), eq(programDays.weekday, weekday)))
    .get();
  if (taken) return;
  db.insert(programDays)
    .values({
      id: newId(),
      programId,
      weekday,
      name,
      focus: fieldOrNull(formData, 'focus'),
      estMinutes: null,
      sortOrder: intField(formData, 'sortOrder') ?? 0,
    })
    .run();
  revalidateWorkoutPages();
}

export async function updateProgramDayAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dayId = field(formData, 'dayId');
  const owned = dayId ? getProgramDayForUser(user.id, dayId) : null;
  if (!dayId || !owned) return;
  const name = field(formData, 'name');
  const weekday = intField(formData, 'weekday');
  if (!name || weekday === null || weekday < 0 || weekday > 6) return;
  // Refuse moving onto a weekday another day of the same program already uses.
  const clash = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(and(eq(programDays.programId, owned.day.programId), eq(programDays.weekday, weekday)))
    .get();
  if (clash && clash.id !== dayId) return;
  db.update(programDays)
    .set({
      weekday,
      name,
      focus: fieldOrNull(formData, 'focus'),
      sortOrder: intField(formData, 'sortOrder') ?? 0,
    })
    .where(eq(programDays.id, dayId))
    .run();
  revalidateWorkoutPages();
}

export async function deleteProgramDayAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dayId = field(formData, 'dayId');
  if (!dayId || !getProgramDayForUser(user.id, dayId)) return;
  db.delete(programDays).where(eq(programDays.id, dayId)).run();
  revalidateWorkoutPages();
}

/* ---------- program exercises ---------- */

export async function addProgramExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programDayId = field(formData, 'programDayId');
  const exerciseId = field(formData, 'exerciseId');
  if (!programDayId || !getProgramDayForUser(user.id, programDayId)) return;
  if (!exerciseId || !getExerciseForUser(user.id, exerciseId)) return;
  // One entry per exercise per day: the log screen groups sets by exercise id.
  const duplicate = db
    .select({ id: programExercises.id })
    .from(programExercises)
    .where(
      and(
        eq(programExercises.programDayId, programDayId),
        eq(programExercises.exerciseId, exerciseId),
      ),
    )
    .get();
  if (duplicate) return;
  const scheme = parseSetScheme(formData);
  if (!scheme) return;
  db.insert(programExercises)
    .values({
      id: newId(),
      programDayId,
      exerciseId,
      ...scheme,
      perSide: checkbox(formData, 'perSide'),
      sortOrder: intField(formData, 'sortOrder') ?? 0,
    })
    .run();
  revalidateWorkoutPages();
}

export async function updateProgramExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programExerciseId = field(formData, 'programExerciseId');
  if (!programExerciseId || !programExerciseForUser(user.id, programExerciseId)) return;
  const exerciseId = field(formData, 'exerciseId');
  if (!exerciseId || !getExerciseForUser(user.id, exerciseId)) return;
  const scheme = parseSetScheme(formData);
  if (!scheme) return;
  db.update(programExercises)
    .set({
      exerciseId,
      ...scheme,
      perSide: checkbox(formData, 'perSide'),
      sortOrder: intField(formData, 'sortOrder') ?? 0,
    })
    .where(eq(programExercises.id, programExerciseId))
    .run();
  revalidateWorkoutPages();
}

export async function deleteProgramExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programExerciseId = field(formData, 'programExerciseId');
  if (!programExerciseId || !programExerciseForUser(user.id, programExerciseId)) return;
  db.delete(programExercises).where(eq(programExercises.id, programExerciseId)).run();
  revalidateWorkoutPages();
}

/* ---------- session rules ---------- */

export async function addSessionRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const programId = field(formData, 'programId');
  if (!programId || !getProgramForUser(user.id, programId)) return;
  const key = field(formData, 'key');
  const ruleText = field(formData, 'text');
  if (!key || !ruleText) return;
  db.insert(sessionRules)
    .values({
      id: newId(),
      programId,
      key,
      text: ruleText,
      sortOrder: intField(formData, 'sortOrder') ?? 0,
    })
    .run();
  revalidateWorkoutPages();
}

export async function updateSessionRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ruleId = field(formData, 'ruleId');
  if (!ruleId || !sessionRuleForUser(user.id, ruleId)) return;
  const key = field(formData, 'key');
  const ruleText = field(formData, 'text');
  if (!key || !ruleText) return;
  db.update(sessionRules)
    .set({ key, text: ruleText, sortOrder: intField(formData, 'sortOrder') ?? 0 })
    .where(eq(sessionRules.id, ruleId))
    .run();
  revalidateWorkoutPages();
}

export async function deleteSessionRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ruleId = field(formData, 'ruleId');
  if (!ruleId || !sessionRuleForUser(user.id, ruleId)) return;
  db.delete(sessionRules).where(eq(sessionRules.id, ruleId)).run();
  revalidateWorkoutPages();
}

/* ---------- exercise library ---------- */

export async function addExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = field(formData, 'name');
  if (!name) return;
  db.insert(exercises)
    .values({
      id: newId(),
      userId: user.id,
      name,
      equipment: fieldOrNull(formData, 'equipment'),
      mainMuscles: muscleList(formData, 'mainMuscles'),
      helpingMuscles: muscleList(formData, 'helpingMuscles'),
      cues: textareaOrNull(formData, 'cues'),
      view: viewField(formData, 'view'),
      illustrationSvg: null,
      sortOrder: intField(formData, 'sortOrder') ?? 0,
      archived: false,
    })
    .run();
  revalidateWorkoutPages();
}

export async function updateExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const exerciseId = field(formData, 'exerciseId');
  if (!exerciseId || !getExerciseForUser(user.id, exerciseId)) return;
  const name = field(formData, 'name');
  if (!name) return;
  db.update(exercises)
    .set({
      name,
      equipment: fieldOrNull(formData, 'equipment'),
      mainMuscles: muscleList(formData, 'mainMuscles'),
      helpingMuscles: muscleList(formData, 'helpingMuscles'),
      cues: textareaOrNull(formData, 'cues'),
      view: viewField(formData, 'view'),
      sortOrder: intField(formData, 'sortOrder') ?? 0,
      archived: checkbox(formData, 'archived'),
    })
    .where(eq(exercises.id, exerciseId))
    .run();
  revalidateWorkoutPages();
}

export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const exerciseId = field(formData, 'exerciseId');
  if (!exerciseId || !getExerciseForUser(user.id, exerciseId)) return;
  // Deleting cascades into workout_sets and erases logged history — require
  // the explicit confirmation checkbox, like deleting a program.
  if (!checkbox(formData, 'confirm')) return;
  db.delete(exercises).where(eq(exercises.id, exerciseId)).run();
  revalidateWorkoutPages();
}
