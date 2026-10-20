'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';
import { getUserByUsername } from '@/server/users';

export type LoginState = { error: string } | null;

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!username || !password) return { error: 'Enter your username and password.' };

  const user = getUserByUsername(username);
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return { error: 'Wrong username or password.' };
  }

  const session = createSession(user.id);
  cookies().set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
  redirect('/');
}
