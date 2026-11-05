import type { Metadata } from 'next';
import { PlanFacts } from '@/components/plan-pages/PlanFacts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Supplement Facts' };

export default function FactsPage() {
  return <PlanFacts plan="supplements" />;
}
