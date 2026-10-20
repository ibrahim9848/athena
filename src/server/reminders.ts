import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions, reminderSends, reminders } from '@/db/schema';
import { newId } from '@/lib/ids';

export function getReminders(userId: string) {
  return db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.time)).all();
}

export function getReminderForUser(userId: string, reminderId: string) {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .get();
}

export function upsertReminder(
  userId: string,
  data: {
    id?: string;
    kind: 'slot' | 'workout' | 'custom';
    refId: string | null;
    time: string;
    days: number[];
    enabled: boolean;
    label: string | null;
  },
): string {
  if (data.id) {
    const existing = getReminderForUser(userId, data.id);
    if (!existing) throw new Error('Reminder not found');
    db.update(reminders)
      .set({
        kind: data.kind,
        refId: data.refId,
        time: data.time,
        days: data.days,
        enabled: data.enabled,
        label: data.label,
      })
      .where(eq(reminders.id, data.id))
      .run();
    return data.id;
  }
  const id = newId();
  db.insert(reminders)
    .values({
      id,
      userId,
      kind: data.kind,
      refId: data.refId,
      time: data.time,
      days: data.days,
      enabled: data.enabled,
      label: data.label,
    })
    .run();
  return id;
}

export function deleteReminder(userId: string, reminderId: string): void {
  db.delete(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .run();
}

export function saveSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
): void {
  db.insert(pushSubscriptions)
    .values({
      id: newId(),
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth },
    })
    .run();
}

export function deleteSubscription(userId: string, endpoint: string): void {
  db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .run();
}

export function hasSubscription(userId: string): boolean {
  return (
    db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all()
      .length > 0
  );
}

/** True if a send was recorded; false if one already existed for (reminder, date). */
export function recordSend(reminderId: string, date: string): boolean {
  try {
    db.insert(reminderSends)
      .values({ id: newId(), reminderId, sentForDate: date, sentAt: new Date().toISOString() })
      .run();
    return true;
  } catch {
    return false; // unique (reminder_id, sent_for_date) already present
  }
}

export function alreadySent(reminderId: string, date: string): boolean {
  return !!db
    .select({ id: reminderSends.id })
    .from(reminderSends)
    .where(and(eq(reminderSends.reminderId, reminderId), eq(reminderSends.sentForDate, date)))
    .get();
}
