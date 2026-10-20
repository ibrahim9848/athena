import crypto from 'node:crypto';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '@/db';
import { sessions, users, type User } from '@/db/schema';

export const SESSION_COOKIE = 'athena_session';
const SESSION_DAYS = 90;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
/** Extend a session when less than this much of its lifetime remains. */
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function sessionCookieOptions(expires: Date) {
  const appUrl = process.env.APP_URL ?? '';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: appUrl.startsWith('https://'),
    path: '/',
    expires,
  };
}

/** Create a DB session and return its id + expiry; the caller sets the cookie. */
export function createSession(userId: string): { id: string; expiresAt: Date } {
  const id = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MS);
  db.insert(sessions)
    .values({
      id,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    .run();
  return { id, expiresAt };
}

export function deleteSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

/**
 * Current user for this request, or null. Slides the DB-side expiry forward
 * (the cookie itself is refreshed from server actions, where writes are allowed).
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .all();
  const row = rows[0];
  if (!row) return null;
  const now = Date.now();
  const expires = Date.parse(row.session.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) {
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return null;
  }
  if (expires - now < SESSION_MS - SLIDE_AFTER_MS) {
    db.update(sessions)
      .set({ expiresAt: new Date(now + SESSION_MS).toISOString() })
      .where(eq(sessions.id, token))
      .run();
  }
  return row.user;
});

/** Re-issue the session cookie (sliding window). Call from server actions only. */
export function slideSessionCookie(): void {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  store.set(SESSION_COOKIE, token, sessionCookieOptions(new Date(Date.now() + SESSION_MS)));
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/');
  return user;
}
