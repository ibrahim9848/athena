import { requireUser } from '@/lib/auth';
import { AppNav } from '@/components/AppNav';
import { PwaSetup } from '@/components/PwaSetup';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <main className="app-main">{children}</main>
      <AppNav />
      <PwaSetup />
    </>
  );
}
