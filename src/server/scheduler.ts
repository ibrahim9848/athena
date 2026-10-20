import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reminders, users } from '@/db/schema';
import { DEFAULT_TIMEZONE, hmInTz, weekdayOfYmd, ymdInTz } from '@/lib/dates';
import { sendPushToUser, type PushPayload } from '@/lib/push';
import { resolveDayForUser } from '@/server/supplements';
import { autoFinishStaleWorkouts, getProgramDayForUser } from '@/server/workouts';
import { alreadySent, recordSend } from '@/server/reminders';
import { runBackup } from '@/server/backup';

function minutesOfHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * A reminder is due when its local time has passed within the last few
 * minutes and nothing was sent for it today. The window (rather than exact
 * minute equality) catches container restarts, a host that slept through the
 * minute, and DST spring-forward days where the exact wall-clock minute never
 * exists. reminder_sends still guarantees at-most-once per day.
 */
const CATCH_UP_MINUTES = 15;

async function tick(now: Date): Promise<void> {
  autoFinishStaleWorkouts();

  const rows = db
    .select({ reminder: reminders, user: users })
    .from(reminders)
    .innerJoin(users, eq(reminders.userId, users.id))
    .where(eq(reminders.enabled, true))
    .all();

  for (const { reminder, user } of rows) {
    const localTime = hmInTz(now, user.timezone);
    const localDate = ymdInTz(now, user.timezone);
    const weekday = weekdayOfYmd(localDate);
    const sinceDue = minutesOfHm(localTime) - minutesOfHm(reminder.time);
    if (sinceDue < 0 || sinceDue >= CATCH_UP_MINUTES) continue;
    if (!reminder.days.includes(weekday)) continue;
    if (alreadySent(reminder.id, localDate)) continue;

    let payload: PushPayload | null = null;
    if (reminder.kind === 'slot' && reminder.refId) {
      const resolved = resolveDayForUser(user.id, localDate);
      const slot = resolved.slots.find((s) => s.slot.id === reminder.refId);
      if (!slot) continue; // nothing scheduled in this slot today
      const remaining = slot.items.filter((i) => !i.taken);
      if (remaining.length === 0) continue; // everything already ticked -> skip
      payload = {
        title: reminder.label || slot.slot.name,
        body: remaining.map((i) => `${i.supplement.name} · ${i.dose}`).join('\n'),
        url: '/supplements',
        tag: `slot-${reminder.refId}`,
      };
    } else if (reminder.kind === 'workout' && reminder.refId) {
      const day = getProgramDayForUser(user.id, reminder.refId);
      if (!day) continue;
      payload = {
        title: reminder.label || `${day.day.name} day`,
        body: day.day.focus ? `Time to train · ${day.day.focus}` : 'Time to train',
        url: `/workouts/day/${reminder.refId}`,
        tag: `workout-${reminder.refId}`,
      };
    } else {
      payload = {
        title: 'Athena',
        body: reminder.label || 'Reminder',
        url: '/',
        tag: `custom-${reminder.id}`,
      };
    }

    // record first: at-most-once per (reminder, date) even if sending is slow
    if (!recordSend(reminder.id, localDate)) continue;
    await sendPushToUser(user.id, payload);
  }
}

export function startScheduler(): void {
  const g = globalThis as unknown as { __athenaScheduler?: boolean };
  if (g.__athenaScheduler) return;
  g.__athenaScheduler = true;

  cron.schedule('* * * * *', () => {
    tick(new Date()).catch((err) => console.error('[scheduler] tick failed', err));
  });

  // 03:00 in the deployment's timezone — the container itself runs in UTC.
  const backupTz = process.env.TZ || DEFAULT_TIMEZONE;
  cron.schedule(
    '0 3 * * *',
    () => {
      runBackup()
        .then((dest) => console.log('[backup] wrote', dest))
        .catch((err) => console.error('[backup] failed', err));
    },
    { timezone: backupTz },
  );

  console.log('[scheduler] started');
}
