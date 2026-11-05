import type { Metadata } from 'next';
import { PlanPage } from '@/components/plan-pages/PlanPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Care' };

export default function CarePage() {
  return <PlanPage plan="care" />;
}
