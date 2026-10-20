import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listWorkoutHistory } from '@/server/workouts';
import { formatYmd } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function WorkoutHistoryPage() {
  const user = await requireUser();
  const history = listWorkoutHistory(user.id);

  return (
    <div className="wrap" style={{ display: 'grid', gap: 14, paddingTop: 20, paddingBottom: 24 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <p className="eyebrow">Workouts</p>
        <h1 className="page-title">History</h1>
        <p className="lede">Past sessions, newest first. Tap one to see its sets.</p>
      </header>

      {history.length === 0 ? (
        <section className="card" style={{ padding: '16px' }}>
          <p className="muted">
            No workouts yet. Start one from a training day on the{' '}
            <Link href="/workouts">plan page</Link>.
          </p>
        </section>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {history.map(({ workout, sets, day }) => {
            const totalSets = sets.length;
            const doneSets = sets.filter((s) => s.set.done).length;
            const doneWeights = sets.flatMap((s) =>
              s.set.done && s.set.weightKg != null ? [s.set.weightKg] : [],
            );
            const anyWeights = sets.flatMap((s) => (s.set.weightKg != null ? [s.set.weightKg] : []));
            const weights = doneWeights.length > 0 ? doneWeights : anyWeights;
            const best = weights.length > 0 ? Math.max(...weights) : null;
            const summary =
              totalSets === 0
                ? 'No sets logged'
                : `${doneSets}/${totalSets} sets${best != null ? ` · best ${best} kg` : ''}`;
            return (
              <li key={workout.id}>
                <Link
                  href={`/workouts/${workout.id}`}
                  className="card"
                  style={{
                    display: 'grid',
                    gap: 4,
                    padding: '14px 16px',
                    textDecoration: 'none',
                    minHeight: 44,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '2px 12px',
                    }}
                  >
                    <span className="label tnum">
                      {formatYmd(workout.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {!workout.finishedAt && <span className="today-badge">In progress</span>}
                  </span>
                  <span className="ex">{day?.name ?? 'Workout'}</span>
                  <span className="rest tnum">{summary}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
