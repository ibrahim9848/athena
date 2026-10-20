import { NextResponse } from 'next/server';
import { getCurrentUser, slideSessionCookie } from '@/lib/auth';
import { setTaken } from '@/server/supplements';
import { finishWorkout, updateWorkoutSet } from '@/server/workouts';
import type { SyncOp } from '@/lib/outbox';

export const dynamic = 'force-dynamic';

/** Reject outsized batches instead of silently truncating; the client chunks at 200. */
const MAX_OPS = 2000;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  // This is the daily-driver mutation path, so slide the session cookie here.
  slideSessionCookie();

  let body: { ops?: SyncOp[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 });
  }
  if (Array.isArray(body.ops) && body.ops.length > MAX_OPS) {
    return NextResponse.json({ ok: false, error: 'Too many ops' }, { status: 413 });
  }
  const ops = Array.isArray(body.ops) ? body.ops : [];
  const errors: string[] = [];

  for (const op of ops) {
    try {
      if (op.kind === 'tick') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date)) throw new Error('Bad date');
        setTaken(user.id, op.ruleId, op.date, !!op.taken);
      } else if (op.kind === 'set') {
        const fields: { weightKg?: number | null; reps?: number | null; done?: boolean } = {};
        if ('weightKg' in op) fields.weightKg = op.weightKg === null ? null : Number(op.weightKg);
        if ('reps' in op) fields.reps = op.reps === null ? null : Math.round(Number(op.reps));
        if ('done' in op) fields.done = !!op.done;
        updateWorkoutSet(user.id, op.setId, fields);
      } else if (op.kind === 'finish') {
        finishWorkout(user.id, op.workoutId, op.notes);
      }
    } catch (err) {
      errors.push(String(err));
    }
  }

  return NextResponse.json({ ok: errors.length === 0, applied: ops.length - errors.length, errors });
}
