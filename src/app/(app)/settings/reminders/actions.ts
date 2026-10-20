'use server';

import { revalidatePath } from 'next/cache';
import { requireUser, slideSessionCookie } from '@/lib/auth';
import { deleteReminder, upsertReminder } from '@/server/reminders';
import { getSlotForUser } from '@/server/supplements';
import { getProgramDayForUser } from '@/server/workouts';

export type ReminderFormState = { error: string } | null;

const KINDS = ['slot', 'workout', 'custom'] as const;
type Kind = (typeof KINDS)[number];

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export async function saveReminderAction(
  _prev: ReminderFormState,
  formData: FormData,
): Promise<ReminderFormState> {
  const user = await requireUser();
  slideSessionCookie();

  const id = String(formData.get('id') ?? '').trim() || undefined;
  const kind = String(formData.get('kind') ?? '');
  if (!isKind(kind)) return { error: 'Pick what to remind about.' };

  const time = String(formData.get('time') ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Enter a time as HH:MM.' };

  const days = Array.from(
    new Set(
      formData
        .getAll('days')
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    ),
  ).sort((a, b) => a - b);
  if (days.length === 0) return { error: 'Pick at least one day.' };

  const enabled = formData.get('enabled') != null;
  const label = String(formData.get('label') ?? '').trim() || null;

  let refId: string | null = null;
  if (kind === 'slot') {
    const ref = String(formData.get('refId') ?? '');
    if (!ref || !getSlotForUser(user.id, ref)) return { error: 'Pick a meal slot.' };
    refId = ref;
  } else if (kind === 'workout') {
    const ref = String(formData.get('refId') ?? '');
    if (!ref || !getProgramDayForUser(user.id, ref)) return { error: 'Pick a training day.' };
    refId = ref;
  }

  try {
    upsertReminder(user.id, { id, kind, refId, time, days, enabled, label });
  } catch {
    return { error: 'Could not save the reminder.' };
  }
  revalidatePath('/settings/reminders');
  return null;
}

export async function deleteReminderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();
  const id = String(formData.get('id') ?? '').trim();
  if (id) deleteReminder(user.id, id);
  revalidatePath('/settings/reminders');
}
