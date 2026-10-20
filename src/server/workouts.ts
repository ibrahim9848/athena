import { and, asc, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { epley1Rm } from '@/lib/workout';
import { db } from '@/db';
import {
  exercises,
  programDays,
  programExercises,
  programs,
  sessionRules,
  workoutSets,
  workouts,
  type Exercise,
  type ProgramDay,
  type ProgramExercise,
} from '@/db/schema';
import { newId } from '@/lib/ids';
import { todayInTz } from '@/lib/dates';

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

/**
 * Latest finished workout of the same program day that actually logged
 * something, with its sets. Skipping empty sessions means an accidentally
 * started, auto-finished workout cannot wipe the next session's pre-fill.
 */
export function lastCompletedWorkout(userId: string, programDayId: string) {
  const candidates = db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.programDayId, programDayId),
        isNotNull(workouts.finishedAt),
      ),
    )
    .orderBy(desc(workouts.startedAt))
    .limit(10)
    .all();
  for (const workout of candidates) {
    const sets = db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.workoutId, workout.id))
      .orderBy(asc(workoutSets.setNumber))
      .all();
    if (sets.some((s) => s.done)) return { workout, sets };
  }
  return null;
}

export function getOpenWorkout(userId: string, programDayId?: string) {
  const conditions = [eq(workouts.userId, userId)];
  if (programDayId) conditions.push(eq(workouts.programDayId, programDayId));
  return db
    .select()
    .from(workouts)
    .where(and(...conditions))
    .orderBy(desc(workouts.startedAt))
    .limit(20)
    .all()
    .find((w) => !w.finishedAt);
}

/**
 * Start a workout: creates the workout plus one row per planned set, pre-filled
 * from the last completed workout of the same program day.
 */
export function startWorkout(userId: string, programDayId: string, timezone: string): string {
  const owned = getProgramDayForUser(userId, programDayId);
  if (!owned) throw new Error('Program day not found');
  const existing = getOpenWorkout(userId, programDayId);
  if (existing) return existing.id;

  const previous = lastCompletedWorkout(userId, programDayId);
  const dayExercises = getDayExercises(programDayId);
  const now = new Date();
  const { ymd } = todayInTz(timezone, now);
  const workoutId = newId();

  db.transaction((tx) => {
    tx.insert(workouts)
      .values({
        id: workoutId,
        userId,
        programDayId,
        date: ymd,
        startedAt: now.toISOString(),
        finishedAt: null,
        notes: null,
      })
      .run();
    for (const { pe, exercise } of dayExercises) {
      for (let setNumber = 1; setNumber <= pe.sets; setNumber++) {
        const prev = previous?.sets.find(
          (s) => s.exerciseId === exercise.id && s.setNumber === setNumber && s.done,
        );
        tx.insert(workoutSets)
          .values({
            id: newId(),
            workoutId,
            exerciseId: exercise.id,
            setNumber,
            weightKg: prev?.weightKg ?? null,
            reps: prev?.reps ?? null,
            rpe: null,
            done: false,
            createdAt: now.toISOString(),
          })
          .run();
      }
    }
  });
  return workoutId;
}

export function getWorkoutForUser(userId: string, workoutId: string) {
  const workout = db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!workout) return null;
  const sets = db
    .select({ set: workoutSets, exercise: exercises })
    .from(workoutSets)
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(eq(workoutSets.workoutId, workoutId))
    .orderBy(asc(workoutSets.setNumber))
    .all();
  const day = workout.programDayId ? getProgramDayForUser(userId, workout.programDayId) : null;
  return { workout, sets, day };
}

export function updateWorkoutSet(
  userId: string,
  setId: string,
  fields: { weightKg?: number | null; reps?: number | null; done?: boolean },
): void {
  const owned = db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workoutSets.id, setId), eq(workouts.userId, userId)))
    .get();
  if (!owned) throw new Error('Set not found');
  db.update(workoutSets).set(fields).where(eq(workoutSets.id, setId)).run();
}

export function finishWorkout(userId: string, workoutId: string, notes?: string): void {
  const owned = db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!owned) throw new Error('Workout not found');
  db.update(workouts)
    .set({ finishedAt: new Date().toISOString(), ...(notes !== undefined ? { notes } : {}) })
    .where(eq(workouts.id, workoutId))
    .run();
}

/** Auto-finish unfinished workouts older than 12 h (runs for all users, from the scheduler). */
export function autoFinishStaleWorkouts(): number {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const stale = db
    .select()
    .from(workouts)
    .where(and(lt(workouts.startedAt, cutoff), isNull(workouts.finishedAt)))
    .all();
  for (const w of stale) {
    db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, w.id)).run();
  }
  return stale.length;
}

export function listWorkoutHistory(userId: string, limit = 60) {
  const rows = db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startedAt))
    .limit(limit)
    .all();
  return rows.map((w) => {
    const sets = db
      .select({ set: workoutSets, exercise: exercises })
      .from(workoutSets)
      .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
      .where(eq(workoutSets.workoutId, w.id))
      .orderBy(asc(workoutSets.setNumber))
      .all();
    const day = w.programDayId
      ? db.select().from(programDays).where(eq(programDays.id, w.programDayId)).get()
      : null;
    return { workout: w, sets, day };
  });
}

/** Per-exercise best set (by Epley 1RM) per finished workout, oldest first. */
export function exerciseProgress(userId: string, exerciseId: string) {
  const rows = db
    .select({ set: workoutSets, workout: workouts })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workoutSets.exerciseId, exerciseId),
        eq(workoutSets.done, true),
        isNotNull(workouts.finishedAt),
      ),
    )
    .orderBy(asc(workouts.startedAt))
    .all();
  const byWorkout = new Map<string, { date: string; weightKg: number; reps: number; e1rm: number }>();
  for (const { set, workout } of rows) {
    if (set.weightKg == null || set.reps == null || set.reps <= 0) continue;
    const e1rm = epley1Rm(set.weightKg, set.reps);
    const prev = byWorkout.get(workout.id);
    if (!prev || e1rm > prev.e1rm) {
      byWorkout.set(workout.id, { date: workout.date, weightKg: set.weightKg, reps: set.reps, e1rm });
    }
  }
  return [...byWorkout.values()];
}
