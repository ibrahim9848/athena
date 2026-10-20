import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { addDaysYmd, todayInTz } from '@/lib/dates';
import { getLogsBetween, getPlanData } from '@/server/supplements';
import { resolveDay } from '@/lib/plan';
import { HistoryHeat, type HistoryDay } from '@/components/supplements/HistoryHeat';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'History' };

export default async function HistoryPage() {
  const user = await requireUser();
  const { ymd: to } = todayInTz(user.timezone);
  const from = addDaysYmd(to, -55);

  // Resolve all 56 days once, server-side, so the client gets taken/total
  // plus the names and doses of everything missed per day.
  const data = getPlanData(user.id);
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
        <p className="eyebrow">Supplements</p>
        <h1 className="page-title">History</h1>
        <p className="lede mt-3">
          The last eight weeks of doses. Tap a day to see what was missed.
        </p>
      </header>
      <HistoryHeat days={days} />
    </div>
  );
}
