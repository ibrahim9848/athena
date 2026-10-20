import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');
  return (
    <div className="wrap" style={{ paddingBlock: '15vh 48px', maxWidth: 420 }}>
      <header style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <p className="label">Supplements · Training</p>
        <h1 className="page-title">Athena</h1>
        <p className="lede">Sign in to see your plan for today.</p>
      </header>
      <LoginForm />
    </div>
  );
}
