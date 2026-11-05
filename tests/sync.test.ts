/**
 * POST /api/sync after workout logging was removed: ticks still apply, and the
 * old build's `set` / `finish` ops — possibly still queued in a phone's offline
 * outbox — are acknowledged and dropped so the outbox clears.
 *
 * DATABASE_PATH must be ':memory:' before @/db is evaluated for the first time.
 */
process.env.DATABASE_PATH = ':memory:';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({
    id: 'u1',
    username: 'u1',
    displayName: 'U1',
    timezone: 'Asia/Riyadh',
    role: 'owner',
  }),
  slideSessionCookie: () => {},
}));

async function post(ops: unknown[]) {
  const { POST } = await import('@/app/api/sync/route');
  const req = new Request('http://localhost/api/sync', {
    method: 'POST',
    body: JSON.stringify({ ops }),
  });
  return (await POST(req)).json();
}

describe('POST /api/sync', () => {
  it('acknowledges and drops legacy workout ops', async () => {
    expect(
      await post([
        { kind: 'set', setId: 'x', reps: 5 },
        { kind: 'finish', workoutId: 'y' },
      ]),
    ).toEqual({ ok: true, applied: 2, errors: [] });
  });

  it('still reports a tick with a bad date', async () => {
    const res = await post([{ kind: 'tick', ruleId: 'nope', date: 'yesterday', taken: true }]);
    expect(res.ok).toBe(false);
    expect(res.applied).toBe(0);
  });
});
