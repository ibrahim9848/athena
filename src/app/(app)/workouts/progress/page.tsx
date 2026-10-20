import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatYmd } from '@/lib/dates';
import type { Exercise } from '@/db/schema';
import { exerciseProgress, getExerciseForUser, getExercisesForUser } from '@/server/workouts';
import { ProgressChart, type ProgressPoint } from '@/components/ProgressChart';
import { ExercisePicker } from '@/components/workouts-edit/ExercisePicker';

export const metadata: Metadata = { title: 'Progress' };
export const dynamic = 'force-dynamic';

function formatKg(weightKg: number): string {
  return Number.isInteger(weightKg) ? String(weightKg) : String(Math.round(weightKg * 100) / 100);
}

export default async function WorkoutsProgressPage({
  searchParams,
}: {
  searchParams?: { exercise?: string | string[] };
}) {
  const user = await requireUser();
  const exercisesList = getExercisesForUser(user.id);

  const requested =
    typeof searchParams?.exercise === 'string' && searchParams.exercise !== ''
      ? searchParams.exercise
      : null;

  let selected: Exercise | null = null;
  let points: ProgressPoint[] = [];

  if (requested) {
    // Also resolves archived exercises, so old links keep working.
    const exercise = getExerciseForUser(user.id, requested);
    if (exercise) {
      selected = exercise;
      points = exerciseProgress(user.id, exercise.id);
    }
  }
  if (!selected) {
    // Default: the first exercise that has logged data.
    for (const exercise of exercisesList) {
      const progress = exerciseProgress(user.id, exercise.id);
      if (progress.length > 0) {
        selected = exercise;
        points = progress;
        break;
      }
    }
  }
  if (!selected && exercisesList.length > 0) {
    selected = exercisesList[0];
    points = [];
  }

  const selectedExercise = selected;
  const pickerOptions =
    selectedExercise && !exercisesList.some((e) => e.id === selectedExercise.id)
      ? [selectedExercise, ...exercisesList]
      : exercisesList;

  return (
    <div className="wrap" style={{ paddingBlock: '28px 48px', display: 'grid', gap: 22 }}>
      <header style={{ display: 'grid', gap: 8 }}>
        <p className="label">Workouts · Progress</p>
        <h1 className="page-title">Progress</h1>
        <p className="lede">
          Best set per session, turned into an estimated one-rep max with the Epley formula.
        </p>
      </header>

      {!selectedExercise ? (
        <p className="muted">
          No exercises yet. Add some in the <Link href="/workouts/edit">program editor</Link>.
        </p>
      ) : (
        <>
          <ExercisePicker
            exercises={pickerOptions.map((e) => ({
              id: e.id,
              name: e.archived ? `${e.name} (archived)` : e.name,
            }))}
            selectedId={selectedExercise.id}
          />

          {points.length < 2 ? (
            <p className="muted">Log this exercise in at least two sessions to see progress.</p>
          ) : (
            <>
              <section className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
                <h2 className="eyebrow">{selectedExercise.name} · estimated 1RM</h2>
                <ProgressChart points={points} />
              </section>

              <section className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
                <h2 className="eyebrow">Sessions</h2>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Best set</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Est. 1RM
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p, i) => (
                      <tr key={`${p.date}-${i}`}>
                        <td>{formatYmd(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="tnum">
                          {formatKg(p.weightKg)} kg × {p.reps}
                        </td>
                        <td className="tnum" style={{ textAlign: 'right' }}>
                          {p.e1rm.toFixed(1)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
