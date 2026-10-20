import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { DAY_NAMES } from '@/lib/dates';
import { getReminders, hasSubscription } from '@/server/reminders';
import { getSlotsForUser } from '@/server/supplements';
import { getActiveProgram, getProgramDays } from '@/server/workouts';
import { NotificationsCard } from '@/components/reminders/NotificationsCard';
import {
  ReminderForm,
  type ReminderOption,
  type ReminderValue,
} from '@/components/reminders/ReminderForm';

export const metadata: Metadata = { title: 'Reminders' };
export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const user = await requireUser();

  const reminders = getReminders(user.id);
  const slots: ReminderOption[] = getSlotsForUser(user.id).map((slot) => ({
    id: slot.id,
    name: slot.name,
  }));
  const program = getActiveProgram(user.id);
  const workoutDays: ReminderOption[] = (program ? getProgramDays(program.id) : []).map((day) => ({
    id: day.id,
    name: `${DAY_NAMES[day.weekday] ?? `Day ${day.weekday}`} · ${day.name}`,
  }));

  const values: ReminderValue[] = reminders.map((r) => ({
    id: r.id,
    kind: r.kind,
    refId: r.refId,
    time: r.time,
    days: r.days,
    enabled: r.enabled,
    label: r.label,
  }));

  return (
    <div className="wrap" style={{ paddingBlock: '28px 48px' }}>
      <header style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <p className="label">Settings</p>
        <h1 className="page-title">Reminders</h1>
        <p className="lede">
          Push notifications for meal slots, training days and anything else you set up.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, marginBottom: 36 }}>
        <h2 className="eyebrow">Notifications</h2>
        <NotificationsCard
          vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
          hasSubscription={hasSubscription(user.id)}
        />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 className="eyebrow">Reminders</h2>
        {values.length === 0 ? (
          <p className="muted">No reminders yet — add your first one below.</p>
        ) : null}
        {values.map((reminder) => (
          <ReminderForm
            key={reminder.id}
            reminder={reminder}
            slots={slots}
            workoutDays={workoutDays}
          />
        ))}

        <h3 className="eyebrow" style={{ marginTop: 16 }}>
          Add a reminder
        </h3>
        <ReminderForm reminder={null} slots={slots} workoutDays={workoutDays} />

        <p className="muted" style={{ fontSize: 14 }}>
          A slot reminder is skipped when everything in that slot is already ticked.
        </p>
        <p className="muted" style={{ fontSize: 14 }}>
          Reminders fire in your profile timezone.
        </p>
      </section>
    </div>
  );
}
