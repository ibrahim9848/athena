import type { DayExercise } from '@/server/workouts';
import { formatRest } from '@/lib/workout';

/** The set sheet: one row per exercise with rest time and sets × reps. */
export function DaySheet({ exercises }: { exercises: DayExercise[] }) {
  return (
    <div className="sheet">
      <div className="sheet-head" aria-hidden="true">
        <span />
        <span className="label">Exercise</span>
        <span className="label">Sets × reps</span>
      </div>
      <ol>
        {exercises.map(({ pe, exercise }, index) => (
          <li key={pe.id}>
            <a className="sheet-row" href={`#fig-${pe.id}`}>
              <span className="num">{index + 1}</span>
              <span>
                <span className="ex">{exercise.name}</span>
                <br />
                <span className="rest">{formatRest(pe.restSeconds)}</span>
              </span>
              <span className="setdose">
                {pe.sets}
                <span className="x">×</span>
                {pe.repsMin}–{pe.repsMax}
                {pe.perSide ? <small>each arm</small> : null}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
