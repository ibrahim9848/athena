import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { DAY_NAMES, todayInTz } from '@/lib/dates';
import {
  getActiveProgram,
  getDayExercises,
  getProgramDays,
  getSessionRules,
} from '@/server/workouts';
import { FiguresProvider, PauseFiguresButton } from '@/components/figures/ExerciseFigure';
import { WeekStrip } from '@/components/workouts/WeekStrip';
import { DayHead } from '@/components/workouts/DayHead';
import { DaySheet } from '@/components/workouts/DaySheet';
import { ExerciseCards } from '@/components/workouts/ExerciseCards';
import { SessionRules } from '@/components/workouts/SessionRules';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Workouts' };

/** "Sunday to Wednesday" for one contiguous run, otherwise names joined with commas. */
function restRangeLabel(weekdays: number[]): string {
  const names = weekdays.map((w) => DAY_NAMES[w] ?? '');
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  const contiguous = weekdays.every((w, i) => i === 0 || w === weekdays[i - 1] + 1);
  if (contiguous) return `${names[0]} to ${names[names.length - 1]}`;
  return names.join(', ');
}

export default async function WorkoutsPage() {
  const user = await requireUser();
  const program = getActiveProgram(user.id);

  if (!program) {
    return (
      <div
        className="wrap"
        style={{ paddingBlock: '28px 48px', display: 'grid', gap: 18, justifyItems: 'start' }}
      >
        <header style={{ display: 'grid', gap: 10 }}>
          <p className="label">Training</p>
          <h1 className="page-title">Workouts</h1>
          <p className="lede">
            No active program yet. Set up your week once — days, exercises, sets and reps — and
            your whole plan shows up here.
          </p>
        </header>
        <Link className="btn btn-primary" href="/workouts/edit">
          Set up a program
        </Link>
      </div>
    );
  }

  const { weekday: todayWeekday } = todayInTz(user.timezone);
  const days = getProgramDays(program.id);
  const rules = getSessionRules(program.id);
  const dayData = days.map((day) => ({ day, exercises: getDayExercises(day.id) }));
  const gymWeekdays = new Set(days.map((d) => d.weekday));
  const restWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((w) => !gymWeekdays.has(w));
  const todayIsRest = restWeekdays.includes(todayWeekday);

  // Rest-day notes: first line with a "·" becomes the focus line, the rest become bullets.
  const noteLines = (program.restDayNotes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const firstLine = noteLines[0];
  const hasFocusLine = noteLines.length > 0 && firstLine.includes('·');
  const focusLine = hasFocusLine ? firstLine : null;
  const bulletLines = hasFocusLine ? noteLines.slice(1) : noteLines;
  const focusSplit = focusLine ? focusLine.indexOf('·') : -1;

  return (
    <FiguresProvider>
      <header
        className="wrap top"
        style={{ paddingBlock: '28px 18px', display: 'grid', gap: 10 }}
      >
        <p className="label">{days.map((d) => d.name).join(' · ')}</p>
        <div
          className="top-row"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h1 className="page-title">{program.name}</h1>
          <PauseFiguresButton />
        </div>
        {program.description ? <p className="lede">{program.description}</p> : null}
      </header>

      <WeekStrip days={days} restDayLabel={program.restDayLabel} todayWeekday={todayWeekday} />

      <div className="wrap">
        <div style={{ marginTop: 22 }}>
          <SessionRules rules={rules} />
        </div>

        {dayData.map(({ day, exercises }) => (
          <section
            className="day"
            id={`day-${day.weekday}`}
            key={day.id}
            aria-labelledby={`day-${day.weekday}-h`}
          >
            <DayHead
              day={day}
              exercises={exercises}
              isToday={day.weekday === todayWeekday}
              headingId={`day-${day.weekday}-h`}
            />
            <DaySheet exercises={exercises} />
            <ExerciseCards exercises={exercises} />
            <div>
              <Link className="btn btn-dark" href={`/workouts/day/${day.id}`}>
                Open {day.name} · Start
              </Link>
            </div>
          </section>
        ))}

        {restWeekdays.length > 0 ? (
          <section
            className="restdays"
            id="rest"
            aria-labelledby="rest-h"
            style={{ marginTop: 40 }}
          >
            <h2 id="rest-h">
              {restRangeLabel(restWeekdays)}
              {todayIsRest ? <span className="today-badge">Today</span> : null}
            </h2>
            {focusLine ? (
              <p className="focus">
                {focusLine.slice(0, focusSplit).trim()}
                <span>
                  {' · '}
                  {focusLine.slice(focusSplit + 1).trim()}
                </span>
              </p>
            ) : null}
            {bulletLines.length > 0 ? (
              <ul>
                {bulletLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </FiguresProvider>
  );
}
