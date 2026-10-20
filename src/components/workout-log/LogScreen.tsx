'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOps } from '@/lib/outbox';
import { formatSeconds } from '@/lib/dates';
import { formatRest } from '@/lib/workout';
import { RestTimer } from './RestTimer';
import {
  cueLines,
  progressionHints,
  targetLabel,
  type LogExercise,
  type LogWorkoutMeta,
} from './types';

type SetFieldState = { weight: string; reps: string; done: boolean };

function parseWeight(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseReps(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function LogScreen({
  workout,
  exercises,
}: {
  workout: LogWorkoutMeta;
  exercises: LogExercise[];
}) {
  const router = useRouter();

  const [setState, setSetState] = useState<Record<string, SetFieldState>>(() => {
    const init: Record<string, SetFieldState> = {};
    for (const ex of exercises) {
      for (const s of ex.sets) {
        init[s.id] = {
          weight: s.weightKg != null ? String(s.weightKg) : '',
          reps: s.reps != null ? String(s.reps) : '',
          done: s.done,
        };
      }
    }
    return init;
  });

  const [rest, setRest] = useState<{ name: string; endsAt: number } | null>(null);
  const [hints, setHints] = useState<string[] | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Live elapsed time, derived from startedAt so screen lock cannot stall it.
  const startedMs = useMemo(() => Date.parse(workout.startedAt), [workout.startedAt]);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const elapsed = Number.isFinite(startedMs)
    ? formatSeconds(Math.max(0, Math.floor((now - startedMs) / 1000)))
    : '0:00';

  const syncSet = useCallback((setId: string, st: SetFieldState) => {
    void sendOps([
      {
        kind: 'set',
        setId,
        weightKg: parseWeight(st.weight),
        reps: parseReps(st.reps),
        done: st.done,
      },
    ]);
  }, []);

  function editField(setId: string, field: 'weight' | 'reps', value: string) {
    setSetState((prev) => {
      const cur = prev[setId];
      if (!cur) return prev;
      return { ...prev, [setId]: { ...cur, [field]: value } };
    });
  }

  function blurField(setId: string) {
    const cur = setState[setId];
    if (cur) syncSet(setId, cur);
  }

  function toggleDone(ex: LogExercise, setId: string) {
    const cur = setState[setId];
    if (!cur) return;
    const next = { ...cur, done: !cur.done };
    setSetState((prev) => ({ ...prev, [setId]: next }));
    syncSet(setId, next);
    if (next.done) {
      const seconds = ex.restSeconds ?? 90;
      setRest({ name: ex.name, endsAt: Date.now() + seconds * 1000 });
    }
  }

  const extendRest = useCallback(() => {
    setRest((r) => (r ? { ...r, endsAt: Math.max(r.endsAt, Date.now()) + 30_000 } : r));
  }, []);
  const clearRest = useCallback(() => setRest(null), []);

  /** Current values folded back into the serializable shape for the hint rule. */
  function snapshot(): LogExercise[] {
    return exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => {
        const st = setState[s.id];
        return st
          ? { ...s, weightKg: parseWeight(st.weight), reps: parseReps(st.reps), done: st.done }
          : s;
      }),
    }));
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setRest(null);
    const computed = progressionHints(snapshot());
    const result = await sendOps([{ kind: 'finish', workoutId: workout.id }]);
    if (computed.length === 0) {
      router.push('/workouts/history');
      if (result === 'sent') router.refresh();
      return;
    }
    // Show the hints inline; navigation (and the refresh that swaps this page
    // to the read-only summary) waits for the Done tap.
    setHints(computed);
  }

  function done() {
    router.push('/workouts/history');
    router.refresh();
  }

  return (
    <div className="wrap" style={{ display: 'grid', gap: 14, paddingTop: 20, paddingBottom: 24 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <p className="eyebrow">{workout.dateLabel}</p>
        <div className="day-name">
          <h1>{workout.dayName}</h1>
          <span className="badge tnum" aria-label="Elapsed time" suppressHydrationWarning>
            {elapsed}
          </span>
        </div>
      </header>

      {exercises.length === 0 && (
        <section className="card" style={{ padding: '16px' }}>
          <p className="muted">Nothing to log — this workout has no planned sets.</p>
        </section>
      )}

      {exercises.map((ex) => {
        const cues = cueLines(ex.cues);
        return (
          <section
            key={ex.exerciseId}
            className="card"
            style={{ padding: '12px 14px 14px', display: 'grid', gap: 10 }}
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
                <span className="rest">{formatRest(ex.restSeconds ?? 90)}</span>
              </div>
              <span className="setdose">
                {ex.repsMin != null && ex.repsMax != null ? (
                  <>
                    {ex.sets.length}
                    <span className="x">×</span>
                    {ex.repsMin}–{ex.repsMax}
                  </>
                ) : (
                  <>{targetLabel(ex)}</>
                )}
                {ex.perSide && <small>each arm</small>}
              </span>
            </header>

            <div role="group" aria-label={`${ex.name} sets`} style={{ display: 'grid', gap: 8 }}>
              {ex.sets.map((s) => {
                const st = setState[s.id] ?? { weight: '', reps: '', done: false };
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '26px minmax(0, 1fr) minmax(0, 1fr) 44px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <span className="num" aria-hidden="true">
                      {s.setNumber}
                    </span>
                    <input
                      className="set-input"
                      style={{ width: '100%' }}
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      min={0}
                      placeholder="kg"
                      aria-label={`${ex.name} set ${s.setNumber} weight in kilograms`}
                      value={st.weight}
                      onChange={(e) => editField(s.id, 'weight', e.target.value)}
                      onBlur={() => blurField(s.id)}
                    />
                    <input
                      className="set-input"
                      style={{ width: '100%' }}
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={0}
                      placeholder={
                        ex.repsMin != null && ex.repsMax != null
                          ? `${ex.repsMin}–${ex.repsMax}`
                          : 'reps'
                      }
                      aria-label={`${ex.name} set ${s.setNumber} reps`}
                      value={st.reps}
                      onChange={(e) => editField(s.id, 'reps', e.target.value)}
                      onBlur={() => blurField(s.id)}
                    />
                    <button
                      type="button"
                      className="check"
                      aria-pressed={st.done}
                      aria-label={`${ex.name} set ${s.setNumber} done`}
                      onClick={() => toggleDone(ex, s.id)}
                      style={{
                        position: 'relative',
                        width: 44,
                        height: 44,
                        padding: 0,
                        cursor: 'pointer',
                        background: st.done ? 'var(--ink)' : 'transparent',
                        borderColor: st.done ? 'var(--ink)' : 'var(--line)',
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={18}
                        height={18}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          opacity: st.done ? 1 : 0,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <path
                          d="M5 12.5 10 17.5 19 7"
                          fill="none"
                          stroke="var(--on-ink)"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {cues.length > 0 && (
              <details>
                <summary className="label" style={{ cursor: 'pointer', minHeight: 24 }}>
                  Cues
                </summary>
                <ul className="cues" style={{ marginTop: 6 }}>
                  {cues.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      {hints ? (
        <section className="card" style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
          <h2 className="label">Progression</h2>
          <ul className="cues">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-dark" onClick={done}>
            Done
          </button>
        </section>
      ) : (
        <div
          style={{
            position: 'sticky',
            bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            display: 'grid',
            paddingBlock: 4,
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void finish()}
            disabled={finishing}
          >
            Finish workout
          </button>
        </div>
      )}

      {rest && !hints && (
        <RestTimer
          exerciseName={rest.name}
          endsAt={rest.endsAt}
          onExtend={extendRest}
          onSkip={clearRest}
          onDone={clearRest}
        />
      )}
    </div>
  );
}
