import type { Metadata } from 'next';
import { PlanHistory } from '@/components/plan-pages/PlanHistory';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'History' };

export default function HistoryPage() {
  return <PlanHistory plan="supplements" />;
}
