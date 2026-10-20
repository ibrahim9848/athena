'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, slideSessionCookie } from '@/lib/auth';
import { startWorkout } from '@/server/workouts';

/**
 * Start (or resume) a workout for this program day, then go to the log screen.
 * `redirect` throws, so it is called after the try/catch, never inside it.
 */
export async function startWorkoutAction(programDayId: string): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  let workoutId: string | null = null;
  try {
    workoutId = startWorkout(user.id, programDayId, user.timezone);
  } catch {
    workoutId = null;
  }
  if (!workoutId) {
    redirect('/workouts');
  }
  revalidatePath('/workouts');
  revalidatePath(`/workouts/day/${programDayId}`);
  revalidatePath(`/workouts/${workoutId}`);
  redirect(`/workouts/${workoutId}`);
}
