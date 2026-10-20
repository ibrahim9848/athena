import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { todayInTz } from '@/lib/dates';
import {
  getDayExercises,
  getOpenWorkout,
  getProgramDayForUser,
  getSessionRules,
} from '@/server/workouts';
import { FiguresProvider, PauseFiguresButton } from '@/components/figures/ExerciseFigure';
import { DayHead } from '@/components/workouts/DayHead';
import { DaySheet } from '@/components/workouts/DaySheet';
import { ExerciseCards } from '@/components/workouts/ExerciseCards';
import { SessionRules } from '@/components/workouts/SessionRules';
import { startWorkoutAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Workout day' };

export default async function ProgramDayPage({
  params,
}: {
  params: { programDayId: string };
}) {
  const user = await requireUser();
  const row = getProgramDayForUser(user.id, params.programDayId);
  if (!row) notFound();
  const { day, program } = row;
  const exercises = getDayExercises(day.id);
  const rules = getSessionRules(program.id);
  const openWorkout = getOpenWorkout(user.id, day.id);
  const { weekday: todayWeekday } = todayInTz(user.timezone);

  return (
    <FiguresProvider>
      <div className="wrap" style={{ paddingBlock: '20px 48px', display: 'grid', gap: 18 }}>
        <div>
          <Link className="btn" href="/workouts">
            ← Back to plan
          </Link>
        </div>

        <DayHead
          day={day}
          exercises={exercises}
          isToday={day.weekday === todayWeekday}
          headingLevel="h1"
          headingId="day-h"
        />

        <div style={{ display: 'grid' }}>
          {openWorkout ? (
            <Link className="btn btn-primary" href={`/workouts/${openWorkout.id}`}>
              Continue workout
            </Link>
          ) : (
            <form action={startWorkoutAction.bind(null, day.id)} style={{ display: 'grid' }}>
              <button className="btn btn-primary" type="submit">
                Start workout
              </button>
            </form>
          )}
        </div>

        <SessionRules rules={rules} />

        <DaySheet exercises={exercises} />

        <ExerciseCards exercises={exercises} headExtra={<PauseFiguresButton />} />
      </div>
    </FiguresProvider>
  );
}
