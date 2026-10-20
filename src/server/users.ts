import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { newId } from '@/lib/ids';
import { DEFAULT_TIMEZONE } from '@/lib/dates';

export function listUsers() {
  return db.select().from(users).orderBy(asc(users.username)).all();
}

export function getUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function getUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function createUser(data: {
  username: string;
  password: string;
  displayName?: string;
  timezone?: string;
  role?: 'owner' | 'member';
}): Promise<string> {
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{2,32}$/.test(username)) {
    throw new Error('Username must be 2-32 characters: letters, digits, _ . -');
  }
  if (data.password.length < 6) throw new Error('Password must be at least 6 characters');
  if (getUserByUsername(username)) throw new Error('Username already taken');
  const id = newId();
  db.insert(users)
    .values({
      id,
      username,
      passwordHash: await hashPassword(data.password),
      displayName: data.displayName?.trim() || data.username,
      timezone: data.timezone || DEFAULT_TIMEZONE,
      role: data.role || 'member',
      createdAt: new Date().toISOString(),
    })
    .run();
  return id;
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  db.update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId))
    .run();
}

export function deleteUser(userId: string): void {
  db.delete(users).where(eq(users.id, userId)).run();
}

export function updateProfile(
  userId: string,
  data: { displayName?: string; timezone?: string },
): void {
  const set: Record<string, string> = {};
  if (data.displayName?.trim()) set.displayName = data.displayName.trim();
  if (data.timezone?.trim()) set.timezone = data.timezone.trim();
  if (Object.keys(set).length === 0) return;
  db.update(users).set(set).where(eq(users.id, userId)).run();
}
