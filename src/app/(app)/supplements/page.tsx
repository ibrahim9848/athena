import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { todayInTz } from '@/lib/dates';
import { resolveWeekForUser } from '@/server/supplements';
import { getActiveProgram, getProgramDays } from '@/server/workouts';
import { SupplementsView } from '@/components/supplements/SupplementsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Supplements' };

const COUNT_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

export default async function SupplementsPage() {
  const user = await requireUser();
  const { ymd } = todayInTz(user.timezone);

  const days = resolveWeekForUser(user.id, ymd);
  const program = getActiveProgram(user.id);
  const gymWeekdays = program
    ? [...new Set(getProgramDays(program.id).map((d) => d.weekday))]
    : [];

  const supplementIds = new Set<string>();
  for (const day of days) {
    for (const { items } of day.slots) {
      for (const item of items) supplementIds.add(item.supplement.id);
    }
  }
  const n = supplementIds.size;
  const lede =
    n === 0
      ? 'Nothing scheduled yet. Add supplements and rules in the plan editor, then tick off your doses here.'
      : `${countWord(n)} ${n === 1 ? 'supplement' : 'supplements'} timed around your meals. Tap a day to see its plan, and tick off today's doses as you take them.`;

  return (
    <div className="wrap grid gap-7 pb-11 pt-7">
      <header>
        <h1 className="page-title">Weekly Supplement Plan</h1>
        <p className="lede mt-3">{lede}</p>
      </header>

      <SupplementsView
        days={days}
        todayYmd={ymd}
        timezone={user.timezone}
        gymWeekdays={gymWeekdays}
        mode="full"
      />

      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-sm" href="/supplements/facts">
          Supplement facts
        </Link>
        <Link className="btn btn-sm" href="/supplements/history">
          History
        </Link>
        <Link className="btn btn-sm" href="/supplements/edit">
          Edit plan
        </Link>
      </div>

      <p className="disclaimer">
        General information, not medical advice — check your plan with a pharmacist.
      </p>
    </div>
  );
}
