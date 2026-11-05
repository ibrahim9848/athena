import type { Metadata } from 'next';
import { PlanEditor } from '@/components/plan-pages/PlanEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit care routine' };

export default function CareEditPage() {
  return <PlanEditor plan="care" />;
}
