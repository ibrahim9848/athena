import type { ReactNode } from 'react';
import type { DayExercise } from '@/server/workouts';
import { ExerciseFigure } from '@/components/figures/ExerciseFigure';

/** One cue per line; tolerate markdown list markers and blank lines. */
function cueLines(cues: string | null): string[] {
  if (!cues) return [];
  return cues
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter((line) => line.length > 0);
}

/**
 * "How to do each one": the figs-head row (title + muscle legend, plus an
 * optional extra control such as the pause-figures button) and the grid of
 * exercise cards with figure, muscle chips and cues.
 */
export function ExerciseCards({
  exercises,
  headExtra,
}: {
  exercises: DayExercise[];
  headExtra?: ReactNode;
}) {
  return (
    <>
      <div className="figs-head">
        <h3>How to do each one</h3>
        <p className="legend">
          <span>
            <i className="sw" />
            Main muscle
          </span>
          <span>
            <i className="sw s" />
            Helping
          </span>
        </p>
        {headExtra}
      </div>
      <div className="figs">
        {exercises.map(({ pe, exercise }, index) => {
          const lines = cueLines(exercise.cues);
          return (
            <article className="fig" id={`fig-${pe.id}`} key={pe.id}>
              <div className="fig-head">
                <span className="num">{index + 1}</span>
                <h4>{exercise.name}</h4>
                <span className="mini">{`${pe.sets} × ${pe.repsMin}–${pe.repsMax}`}</span>
              </div>
              <ExerciseFigure
                name={exercise.name}
                view={exercise.view}
                illustrationSvg={exercise.illustrationSvg}
              />
              <div className="fig-text">
                {exercise.mainMuscles.length + exercise.helpingMuscles.length > 0 ? (
                  <p className="works">
                    {exercise.mainMuscles.map((muscle) => (
                      <span className="chip" key={`main-${muscle}`}>
                        <i className="sw" />
                        {muscle}
                      </span>
                    ))}
                    {exercise.helpingMuscles.map((muscle) => (
                      <span className="chip s" key={`helping-${muscle}`}>
                        <i className="sw s" />
                        {muscle}
                      </span>
                    ))}
                  </p>
                ) : null}
                {lines.length > 0 ? (
                  <ul className="cues">
                    {lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
