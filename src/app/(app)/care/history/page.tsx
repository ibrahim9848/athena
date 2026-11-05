import type { Metadata } from 'next';
import { PlanHistory } from '@/components/plan-pages/PlanHistory';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Care history' };

export default function CareHistoryPage() {
  return <PlanHistory plan="care" />;
}
