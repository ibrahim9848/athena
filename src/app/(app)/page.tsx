import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { DAY_NAMES, todayInTz } from '@/lib/dates';
import { resolveWeekForUser } from '@/server/supplements';
import { getActiveProgram, getProgramDays } from '@/server/workouts';
import { SupplementsView } from '@/components/supplements/SupplementsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Today' };

export default async function HomePage() {
  const user = await requireUser();
  const { ymd, weekday } = todayInTz(user.timezone);

  const program = getActiveProgram(user.id);
  const programDays = program ? getProgramDays(program.id) : [];
  const gymWeekdays = [...new Set(programDays.map((d) => d.weekday))];
  const todayProgramDay = programDays.find((d) => d.weekday === weekday) ?? null;

  const days = resolveWeekForUser(user.id, ymd);

  return (
    <div className="wrap grid gap-7 pb-11 pt-7">
      <header>
        <h1 className="page-title">Today</h1>
      </header>

      {todayProgramDay ? (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="grid gap-1">
            <p className="eyebrow">Training day</p>
            <p className="focus">
              {DAY_NAMES[weekday]} · {todayProgramDay.name}
              {todayProgramDay.focus ? <span> · {todayProgramDay.focus}</span> : null}
            </p>
          </div>
          <Link className="btn btn-dark" href={`/workouts/day/${todayProgramDay.id}`}>
            Open day
          </Link>
        </section>
      ) : null}

      <SupplementsView
        days={days}
        todayYmd={ymd}
        timezone={user.timezone}
        gymWeekdays={gymWeekdays}
        mode="today"
      />

      <p className="disclaimer">
        General information, not medical advice — check your plan with a pharmacist.
      </p>
    </div>
  );
}
