import type { Metadata } from 'next';
import { Fragment } from 'react';
import { requireOwner } from '@/lib/auth';
import { DEFAULT_TIMEZONE, formatYmd } from '@/lib/dates';
import { listUsers } from '@/server/users';
import { createUserAction, deleteUserAction, resetPasswordAction } from './actions';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

function formatCreated(createdAt: string): string {
  const ymd = createdAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return createdAt;
  return formatYmd(ymd, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function AdminPage({ searchParams }: { searchParams?: SearchParams }) {
  const owner = await requireOwner();
  const allUsers = listUsers();
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;
  const ok = typeof searchParams?.ok === 'string' ? searchParams.ok : undefined;

  return (
    <div className="wrap" style={{ paddingBlock: '28px 48px', display: 'grid', gap: 26 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <p className="eyebrow">Owner tools</p>
        <h1 className="page-title">Admin</h1>
        <p className="lede">Everyone on this instance. Each person sees only their own data.</p>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="muted" role="status">
          {ok}
        </p>
      ) : null}

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="users-title">
        <h2 id="users-title" className="label">
          Users
        </h2>
        <div className="card" style={{ padding: '4px 14px', overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td style={{ borderBottom: 'none', fontWeight: 600 }}>{u.username}</td>
                    <td style={{ borderBottom: 'none' }}>{u.displayName}</td>
                    <td style={{ borderBottom: 'none' }}>
                      {u.role}
                      {u.id === owner.id ? <span className="muted"> (you)</span> : null}
                    </td>
                    <td style={{ borderBottom: 'none', whiteSpace: 'nowrap' }}>
                      {formatCreated(u.createdAt)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ paddingTop: 0 }}>
                      <details>
                        <summary
                          className="label"
                          style={{ cursor: 'pointer', padding: '12px 0', minHeight: 44 }}
                        >
                          Manage
                        </summary>
                        <div style={{ display: 'grid', gap: 20, padding: '4px 0 14px' }}>
                          <form
                            action={resetPasswordAction}
                            style={{ display: 'grid', gap: 10, maxWidth: 360 }}
                          >
                            <input type="hidden" name="userId" value={u.id} />
                            <label className="field">
                              <span>New password</span>
                              <input
                                className="input"
                                name="password"
                                type="password"
                                minLength={6}
                                autoComplete="new-password"
                                required
                              />
                            </label>
                            <div>
                              <button type="submit" className="btn btn-sm">
                                Save
                              </button>
                            </div>
                          </form>
                          {u.role === 'owner' ? (
                            <p className="muted" style={{ fontSize: 14 }}>
                              Owner accounts cannot be deleted from here.
                            </p>
                          ) : (
                            <form action={deleteUserAction} style={{ display: 'grid', gap: 10 }}>
                              <input type="hidden" name="userId" value={u.id} />
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  minHeight: 44,
                                  fontSize: 15,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  name="confirm"
                                  required
                                  style={{ width: 20, height: 20, flex: 'none' }}
                                />
                                Really delete this user and all their data
                              </label>
                              <div>
                                <button type="submit" className="btn btn-sm btn-danger">
                                  Delete
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }} aria-labelledby="create-title">
        <h2 id="create-title" className="label">
          Create user
        </h2>
        <form
          action={createUserAction}
          className="card"
          style={{ padding: 18, display: 'grid', gap: 14 }}
        >
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern="[A-Za-z0-9_.-]{2,32}"
              title="2-32 characters: letters, digits, _ . -"
              required
            />
          </label>
          <label className="field">
            <span>Display name</span>
            <input className="input" name="displayName" maxLength={60} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input
              className="input"
              name="timezone"
              defaultValue={DEFAULT_TIMEZONE}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select className="select" name="role" defaultValue="member">
              <option value="member">member</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <div>
            <button type="submit" className="btn btn-primary">
              Create user
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
