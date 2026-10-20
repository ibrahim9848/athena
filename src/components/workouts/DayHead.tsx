import type { ProgramDay } from '@/db/schema';
import type { DayExercise } from '@/server/workouts';
import { DAY_NAMES } from '@/lib/dates';
import { formatDaySummary } from '@/lib/workout';

/** Day header: big weekday name, "Today" badge, focus line and summary. */
export function DayHead({
  day,
  exercises,
  isToday,
  headingLevel = 'h2',
  headingId,
}: {
  day: ProgramDay;
  exercises: DayExercise[];
  isToday: boolean;
  headingLevel?: 'h1' | 'h2';
  headingId?: string;
}) {
  const Heading = headingLevel;
  const summary = formatDaySummary(
    exercises.map(({ pe }) => ({ sets: pe.sets, restSeconds: pe.restSeconds })),
  );
  return (
    <div className="day-head">
      <div className="day-name">
        <Heading id={headingId}>{DAY_NAMES[day.weekday] ?? day.name}</Heading>
        {isToday ? <span className="today-badge">Today</span> : null}
      </div>
      <p className="focus">
        {day.name}
        {day.focus ? (
          <span>
            {' · '}
            {day.focus}
          </span>
        ) : null}
      </p>
      <p className="label">{summary}</p>
    </div>
  );
}
