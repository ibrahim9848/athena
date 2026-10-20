/** Workout math shared by pages and tests. */

export type SummaryInput = { sets: number; restSeconds: number };

/** Minutes = sum over exercises of sets × (45 s + rest), rounded to nearest 5. */
export function estimateMinutes(items: SummaryInput[]): number {
  const seconds = items.reduce((acc, it) => acc + it.sets * (45 + it.restSeconds), 0);
  return Math.round(seconds / 60 / 5) * 5;
}

export function daySummary(items: SummaryInput[]): {
  exercises: number;
  sets: number;
  minutes: number;
} {
  return {
    exercises: items.length,
    sets: items.reduce((acc, it) => acc + it.sets, 0),
    minutes: estimateMinutes(items),
  };
}

export function formatDaySummary(items: SummaryInput[]): string {
  const s = daySummary(items);
  return `${s.exercises} exercise${s.exercises === 1 ? '' : 's'} · ${s.sets} sets · about ${s.minutes} min`;
}

/** Estimated 1RM via Epley. */
export function epley1Rm(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function formatRest(restSeconds: number): string {
  const m = Math.floor(restSeconds / 60);
  const s = restSeconds % 60;
  return `Rest ${m}:${String(s).padStart(2, '0')}`;
}
