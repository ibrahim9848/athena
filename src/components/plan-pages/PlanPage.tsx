import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { todayInTz } from '@/lib/dates';
import { PLANS, type PlanKey } from '@/lib/plans';
import { resolveWeekForUser } from '@/server/supplements';
import { getActiveProgram, getProgramDays } from '@/server/workouts';
import { SupplementsView } from '@/components/supplements/SupplementsView';

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

function lede(plan: PlanKey, n: number): string {
  if (plan === 'care') {
    return n === 0
      ? 'Nothing scheduled yet. Add steps and rules in the plan editor, then tick them off here.'
      : `${countWord(n)} ${n === 1 ? 'step' : 'steps'} for your face and scalp, morning and evening. Tap a day to see the routine, and tick off today's steps as you do them.`;
  }
  return n === 0
    ? 'Nothing scheduled yet. Add supplements and rules in the plan editor, then tick off your doses here.'
    : `${countWord(n)} ${n === 1 ? 'supplement' : 'supplements'} timed around your meals. Tap a day to see its plan, and tick off today's doses as you take them.`;
}

/** The weekly plan page body, shared by /supplements and /care. */
export async function PlanPage({ plan }: { plan: PlanKey }) {
  const copy = PLANS[plan];
  const user = await requireUser();
  const { ymd } = todayInTz(user.timezone);

  const days = resolveWeekForUser(user.id, ymd, plan);
  const program = getActiveProgram(user.id);
  // Gym-day doses are a supplements thing; the care routine has no gym badge.
  const gymWeekdays =
    plan === 'supplements' && program
      ? [...new Set(getProgramDays(program.id).map((d) => d.weekday))]
      : [];

  const itemIds = new Set<string>();
  for (const day of days) {
    for (const { items } of day.slots) {
      for (const item of items) itemIds.add(item.supplement.id);
    }
  }

  return (
    <div className="wrap grid gap-7 pb-11 pt-7">
      <header>
        <h1 className="page-title">{copy.title}</h1>
        <p className="lede mt-3">{lede(plan, itemIds.size)}</p>
      </header>

      <SupplementsView
        days={days}
        todayYmd={ymd}
        timezone={user.timezone}
        gymWeekdays={gymWeekdays}
        mode="full"
        plan={plan}
      />

      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-sm" href={`${copy.path}/facts`}>
          {copy.factsLink}
        </Link>
        <Link className="btn btn-sm" href={`${copy.path}/history`}>
          History
        </Link>
        <Link className="btn btn-sm" href={`${copy.path}/edit`}>
          Edit plan
        </Link>
      </div>

      <p className="disclaimer">{copy.disclaimer}</p>
    </div>
  );
}
