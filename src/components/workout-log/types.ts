/**
 * Serializable shapes passed from the workout page (server component) to the
 * live logging screen (client), plus the pure progression-hint rule shared by
 * both the live screen and the read-only summary.
 */

export type LogSet = {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
};

export type LogExercise = {
  exerciseId: string;
  name: string;
  perSide: boolean;
  repsMin: number | null;
  repsMax: number | null;
  restSeconds: number | null;
  /** Markdown, one cue per line (may start with "-"). */
  cues: string | null;
  sets: LogSet[];
};

export type LogWorkoutMeta = {
  id: string;
  /** Program-day name, e.g. "Push"; "Workout" when the day is gone. */
  dayName: string;
  /** Pre-formatted date, e.g. "Thursday 23 October". */
  dateLabel: string;
  /** ISO UTC instant the session started. */
  startedAt: string;
};

/** "{sets} × {repsMin}–{repsMax}" when a target exists, else "{n} sets". */
export function targetLabel(ex: LogExercise): string {
  if (ex.repsMin != null && ex.repsMax != null) {
    return `${ex.sets.length} × ${ex.repsMin}–${ex.repsMax}`;
  }
  return `${ex.sets.length} set${ex.sets.length === 1 ? '' : 's'}`;
}

/**
 * Progression hints: for each exercise where every set is done and every
 * set's reps reached the top of the target range.
 */
export function progressionHints(exercises: LogExercise[]): string[] {
  return exercises
    .filter((ex) => {
      const max = ex.repsMax;
      if (max == null || ex.sets.length === 0) return false;
      return ex.sets.every((s) => s.done && s.reps != null && s.reps >= max);
    })
    .map((ex) => `${ex.name}: hit the top of the range — add 2.5–5 kg next time`);
}

/** Split the cues markdown into plain lines for a bullet list. */
export function cueLines(cues: string | null): string[] {
  if (!cues) return [];
  return cues
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter((line) => line.length > 0);
}
