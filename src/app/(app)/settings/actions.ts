'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, slideSessionCookie } from '@/lib/auth';
import { updateProfile } from '@/server/users';

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function fail(message: string): never {
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  slideSessionCookie();

  const displayName = String(formData.get('displayName') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? '').trim();

  if (!displayName) fail('Display name cannot be empty.');
  if (displayName.length > 60) fail('Display name is too long (60 characters max).');
  if (!timezone) fail('Timezone cannot be empty.');
  if (!isValidTimezone(timezone)) fail(`"${timezone}" is not a valid IANA timezone.`);

  updateProfile(user.id, { displayName, timezone });
  revalidatePath('/settings');
  revalidatePath('/');
  redirect('/settings?saved=1');
}
