import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDayExercises, getWorkoutForUser } from '@/server/workouts';
import { formatYmd } from '@/lib/dates';
import { formatRest } from '@/lib/workout';
import { LogScreen } from '@/components/workout-log/LogScreen';
import {
  progressionHints,
  targetLabel,
  type LogExercise,
  type LogSet,
} from '@/components/workout-log/types';

export const dynamic = 'force-dynamic';

export default async function WorkoutPage({ params }: { params: { workoutId: string } }) {
  const user = await requireUser();
  const data = getWorkoutForUser(user.id, params.workoutId);
  if (!data) notFound();
  const { workout, sets, day } = data;

  // Program-day targets (rep range, rest, per-side) and the program order.
  type Target = {
    repsMin: number;
    repsMax: number;
    restSeconds: number;
    perSide: boolean;
  };
  const targets = new Map<string, Target>();
  const order: string[] = [];
  const seen = new Set<string>();
  if (workout.programDayId) {
    for (const { pe } of getDayExercises(workout.programDayId)) {
      if (!targets.has(pe.exerciseId)) {
        targets.set(pe.exerciseId, {
          repsMin: pe.repsMin,
          repsMax: pe.repsMax,
          restSeconds: pe.restSeconds,
          perSide: pe.perSide,
        });
      }
      if (!seen.has(pe.exerciseId)) {
        seen.add(pe.exerciseId);
        order.push(pe.exerciseId);
      }
    }
  }
  // Fall back to order of first appearance in the workout's sets.
  for (const { set } of sets) {
    if (!seen.has(set.exerciseId)) {
      seen.add(set.exerciseId);
      order.push(set.exerciseId);
    }
  }

  const byExercise = new Map<string, { name: string; cues: string | null; sets: LogSet[] }>();
  for (const { set, exercise } of sets) {
    let entry = byExercise.get(exercise.id);
    if (!entry) {
      entry = { name: exercise.name, cues: exercise.cues, sets: [] };
      byExercise.set(exercise.id, entry);
    }
    entry.sets.push({
      id: set.id,
      setNumber: set.setNumber,
      weightKg: set.weightKg,
      reps: set.reps,
      done: set.done,
    });
  }

  const exercises: LogExercise[] = order
    .filter((id) => byExercise.has(id))
    .map((id) => {
      const entry = byExercise.get(id)!;
      const target = targets.get(id);
      return {
        exerciseId: id,
        name: entry.name,
        perSide: target?.perSide ?? false,
        repsMin: target?.repsMin ?? null,
        repsMax: target?.repsMax ?? null,
        restSeconds: target?.restSeconds ?? null,
        cues: entry.cues,
        sets: [...entry.sets].sort((a, b) => a.setNumber - b.setNumber),
      };
    });

  const dayName = day?.day.name ?? 'Workout';
  const dateLabel = formatYmd(workout.date, { weekday: 'long', day: 'numeric', month: 'long' });

  if (!workout.finishedAt) {
    return (
      <LogScreen
        workout={{ id: workout.id, dayName, dateLabel, startedAt: workout.startedAt }}
        exercises={exercises}
      />
    );
  }

  // ---------- read-only summary of a finished workout ----------
  const hints = progressionHints(exercises);

  return (
    <div className="wrap" style={{ display: 'grid', gap: 14, paddingTop: 20, paddingBottom: 24 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <p className="eyebrow">{dayName} · Finished</p>
        <div className="day-name">
          <h1>{formatYmd(workout.date, { weekday: 'long', day: 'numeric', month: 'short' })}</h1>
        </div>
      </header>

      {hints.length > 0 && (
        <section className="card" style={{ padding: '14px 16px', display: 'grid', gap: 8 }}>
          <h2 className="label">Progression</h2>
          <ul className="cues">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {exercises.length === 0 && (
        <section className="card" style={{ padding: '16px' }}>
          <p className="muted">No sets were logged in this workout.</p>
        </section>
      )}

      {exercises.map((ex) => (
        <section
          key={ex.exerciseId}
          className="card"
          style={{ padding: '12px 14px 14px', display: 'grid', gap: 8 }}
        >
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '2px 12px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 className="ex">{ex.name}</h2>
              <span className="rest">
                {formatRest(ex.restSeconds ?? 90)}
                {ex.perSide ? ' · each arm' : ''}
              </span>
            </div>
            <span className="rest tnum">{targetLabel(ex)}</span>
          </header>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">kg</th>
                <th scope="col">Reps</th>
                <th scope="col">Done</th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((s) => (
                <tr key={s.id}>
                  <td>{s.setNumber}</td>
                  <td>{s.weightKg ?? '—'}</td>
                  <td>{s.reps ?? '—'}</td>
                  <td aria-label={s.done ? 'Done' : 'Not done'}>{s.done ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {workout.notes && (
        <section className="card" style={{ padding: '14px 16px', display: 'grid', gap: 6 }}>
          <h2 className="label">Notes</h2>
          <p className="note">{workout.notes}</p>
        </section>
      )}

      <div>
        <Link className="btn" href="/workouts/history">
          Back to history
        </Link>
      </div>
    </div>
  );
}
