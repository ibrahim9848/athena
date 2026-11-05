import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  exercises,
  programDays,
  programExercises,
  programs,
  sessionRules,
  type Exercise,
  type ProgramExercise,
} from '@/db/schema';

export function getActiveProgram(userId: string) {
  return db
    .select()
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.isActive, true)))
    .get();
}

export function getPrograms(userId: string) {
  return db.select().from(programs).where(eq(programs.userId, userId)).orderBy(asc(programs.name)).all();
}

export function getProgramForUser(userId: string, programId: string) {
  return db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.userId, userId)))
    .get();
}

export function getProgramDays(programId: string) {
  return db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.weekday), asc(programDays.sortOrder))
    .all();
}

/** A program day, verified to belong to the user. */
export function getProgramDayForUser(userId: string, programDayId: string) {
  const row = db
    .select({ day: programDays, program: programs })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(and(eq(programDays.id, programDayId), eq(programs.userId, userId)))
    .get();
  return row ?? null;
}

export type DayExercise = { pe: ProgramExercise; exercise: Exercise };

export function getDayExercises(programDayId: string): DayExercise[] {
  return db
    .select({ pe: programExercises, exercise: exercises })
    .from(programExercises)
    .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
    .where(eq(programExercises.programDayId, programDayId))
    .orderBy(asc(programExercises.sortOrder))
    .all();
}

export function getSessionRules(programId: string) {
  return db
    .select()
    .from(sessionRules)
    .where(eq(sessionRules.programId, programId))
    .orderBy(asc(sessionRules.sortOrder))
    .all();
}

export function getExercisesForUser(userId: string, includeArchived = false) {
  const where = includeArchived
    ? eq(exercises.userId, userId)
    : and(eq(exercises.userId, userId), eq(exercises.archived, false));
  return db.select().from(exercises).where(where).orderBy(asc(exercises.sortOrder), asc(exercises.name)).all();
}

export function getExerciseForUser(userId: string, exerciseId: string) {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
    .get();
}
