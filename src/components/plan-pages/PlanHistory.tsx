import { requireUser } from '@/lib/auth';
import { addDaysYmd, historyStart, todayInTz } from '@/lib/dates';
import { resolveDay } from '@/lib/plan';
import { PLANS, type PlanKey } from '@/lib/plans';
import { firstLogDate, getLogsBetween, getPlanData } from '@/server/supplements';
import { HistoryHeat, type HistoryDay } from '@/components/supplements/HistoryHeat';

/** The history heat-strip page body, shared by /supplements/history and /care/history. */
export async function PlanHistory({ plan }: { plan: PlanKey }) {
  const copy = PLANS[plan];
  const user = await requireUser();
  const { ymd: to } = todayInTz(user.timezone);
  // Up to eight weeks, but never before the plan's first tick: the days before
  // a routine existed are not missed days.
  const from = historyStart(to, firstLogDate(user.id, plan), 56);

  // Resolve every day once, server-side, so the client gets taken/total
  // plus the names and doses of everything missed per day.
  const data = getPlanData(user.id, plan);
  const logs = getLogsBetween(user.id, from, to);
  const days: HistoryDay[] = [];
  for (let date = from; date <= to; date = addDaysYmd(date, 1)) {
    const resolved = resolveDay({
      date,
      ...data,
      logs: logs.filter((l) => l.date === date),
    });
    const items = resolved.slots.flatMap((s) => s.items);
    days.push({
      date,
      taken: resolved.progress.taken,
      total: resolved.progress.total,
      missed: items
        .filter((item) => !item.taken)
        .map((item) => `${item.supplement.name} · ${item.dose}`),
    });
  }

  return (
    <div className="wrap grid gap-7 pb-11 pt-7">
      <header>
        <p className="eyebrow">{copy.name}</p>
        <h1 className="page-title">History</h1>
        <p className="lede mt-3">
          {plan === 'care'
            ? 'The last eight weeks of your routine. Tap a day to see what was missed.'
            : 'The last eight weeks of doses. Tap a day to see what was missed.'}
        </p>
      </header>
      <HistoryHeat days={days} />
    </div>
  );
}
