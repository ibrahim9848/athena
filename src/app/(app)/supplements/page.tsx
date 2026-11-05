import type { Metadata } from 'next';
import { PlanPage } from '@/components/plan-pages/PlanPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Supplements' };

export default function SupplementsPage() {
  return <PlanPage plan="supplements" />;
}
