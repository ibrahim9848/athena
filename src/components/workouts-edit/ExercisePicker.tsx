'use client';

import { useRef } from 'react';

export type PickerExercise = { id: string; name: string };

/**
 * Exercise picker for /workouts/progress: a .select inside a plain GET form
 * that auto-submits on change. The Go button keeps it working before
 * hydration (and without JS).
 */
export function ExercisePicker({
  exercises,
  selectedId,
}: {
  exercises: PickerExercise[];
  selectedId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      method="get"
      action="/workouts/progress"
      style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}
    >
      <label className="field" style={{ flex: '1 1 240px', maxWidth: 360 }}>
        <span>Exercise</span>
        <select
          className="select"
          name="exercise"
          defaultValue={selectedId ?? undefined}
          onChange={() => formRef.current?.requestSubmit()}
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn">
        Go
      </button>
    </form>
  );
}
