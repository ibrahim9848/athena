import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { requireUser } from '@/lib/auth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { updateProfileAction } from './actions';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/** Used when Intl.supportedValuesOf is unavailable at runtime. */
const FALLBACK_TIMEZONES = [
  'Asia/Riyadh',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
];

function timezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireUser();
  const timezones = timezoneOptions();
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;
  const saved = searchParams?.saved === '1';

  return (
    <div className="wrap" style={{ paddingBlock: '28px 48px', display: 'grid', gap: 26 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <p className="eyebrow">Your account</p>
        <h1 className="page-title">Settings</h1>
      </header>

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="profile-title">
        <h2 id="profile-title" className="label">
          Profile
        </h2>
        <form
          action={updateProfileAction}
          className="card"
          style={{ padding: 18, display: 'grid', gap: 14 }}
        >
          <div className="field">
            <span>Username</span>
            <p className="muted" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
              {user.username}
            </p>
          </div>
          <label className="field">
            <span>Display name</span>
            <input
              className="input"
              name="displayName"
              defaultValue={user.displayName}
              maxLength={60}
              required
            />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input
              className="input"
              name="timezone"
              list="timezone-list"
              defaultValue={user.timezone}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
          <datalist id="timezone-list">
            {timezones.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="muted" style={{ fontSize: 14 }}>
              Saved.
            </p>
          ) : null}
          <div>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </section>

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="label">
          Appearance
        </h2>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
          <ThemeToggle />
          <p className="muted" style={{ fontSize: 14 }}>
            Auto follows this device&rsquo;s light or dark setting.
          </p>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="reminders-title">
        <h2 id="reminders-title" className="label">
          Reminders
        </h2>
        <div className="card" style={{ padding: 18 }}>
          <Link href="/settings/reminders" className="btn">
            Reminder times &amp; notifications
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="account-title">
        <h2 id="account-title" className="label">
          Account
        </h2>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
          <p style={{ fontSize: 15 }}>
            Signed in as <b>{user.displayName}</b> · <span className="muted">{user.role}</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <form action={signOut}>
              <button type="submit" className="btn">
                Sign out
              </button>
            </form>
            {user.role === 'owner' ? (
              <Link href="/admin" className="btn btn-dark">
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
        Athena · self-hosted on your Tailscale network
      </p>
    </div>
  );
}
