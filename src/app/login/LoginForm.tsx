'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { clearOutbox } from '@/lib/outbox';
import { signIn, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState<LoginState, FormData>(signIn, null);

  // Shared-device hygiene: anyone reaching the sign-in screen clears the
  // previous session's leftovers — queued offline ops must never replay under
  // another account, and cached pages must never be served to another person.
  useEffect(() => {
    void clearOutbox();
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear-pages' });
  }, []);

  return (
    <form action={action} className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <label className="field">
        <span>Username</span>
        <input
          className="input"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
