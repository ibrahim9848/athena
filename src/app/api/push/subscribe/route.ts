import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteSubscription, saveSubscription } from '@/server/reminders';

export const dynamic = 'force-dynamic';

/** POST {endpoint, keys: {p256dh, auth}} — save this device's push subscription. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  const keys: { p256dh?: unknown; auth?: unknown } =
    body.keys && typeof body.keys === 'object' ? body.keys : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: 'Bad subscription' }, { status: 400 });
  }

  saveSubscription(user.id, { endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}

/** DELETE {endpoint} — remove this device's push subscription. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: 'Bad endpoint' }, { status: 400 });
  }

  deleteSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
