import type { Metadata } from 'next';
import { PlanEditor } from '@/components/plan-pages/PlanEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit supplement plan' };

export default function SupplementsEditPage() {
  return <PlanEditor plan="supplements" />;
}
