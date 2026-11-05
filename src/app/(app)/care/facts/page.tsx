import type { Metadata } from 'next';
import { PlanFacts } from '@/components/plan-pages/PlanFacts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Products & rules' };

export default function CareFactsPage() {
  return <PlanFacts plan="care" />;
}
