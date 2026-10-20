'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { createUser, deleteUser, getUserById, resetPassword } from '@/server/users';

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function fail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath('/admin');
  redirect(`/admin?ok=${encodeURIComponent(message)}`);
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function createUserAction(formData: FormData): Promise<void> {
  await requireOwner();

  const username = String(formData.get('username') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const timezone = String(formData.get('timezone') ?? '').trim();
  const role = String(formData.get('role') ?? 'member') === 'owner' ? 'owner' : 'member';

  if (timezone && !isValidTimezone(timezone)) {
    fail(`"${timezone}" is not a valid IANA timezone.`);
  }

  let caught: string | null = null;
  try {
    await createUser({
      username,
      password,
      displayName: displayName || undefined,
      timezone: timezone || undefined,
      role,
    });
  } catch (e) {
    caught = errorMessage(e, 'Could not create the user.');
  }
  if (caught) fail(caught);

  done(`Created user "${username.toLowerCase()}".`);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await requireOwner();

  const userId = String(formData.get('userId') ?? '');
  const password = String(formData.get('password') ?? '');
  const target = getUserById(userId);
  if (!target) fail('User not found.');

  let caught: string | null = null;
  try {
    await resetPassword(target.id, password);
  } catch (e) {
    caught = errorMessage(e, 'Could not reset the password.');
  }
  if (caught) fail(caught);

  done(`Password reset for "${target.username}".`);
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();

  const userId = String(formData.get('userId') ?? '');
  const confirmed = formData.get('confirm') === 'on';
  if (!confirmed) fail('Tick the confirmation box to delete a user.');
  if (userId === owner.id) fail('You cannot delete your own account.');

  const target = getUserById(userId);
  if (!target) fail('User not found.');
  if (target.role === 'owner') fail('Owner accounts cannot be deleted from here.');

  deleteUser(target.id);
  done(`Deleted user "${target.username}".`);
}
