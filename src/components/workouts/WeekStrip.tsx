import type { ProgramDay } from '@/db/schema';
import { DAY_SHORT } from '@/lib/dates';

/**
 * Sticky Sun–Sat strip. Weekdays with a program day render as dark "gym"
 * cells linking to that day's section; the rest link to the rest-days block.
 */
export function WeekStrip({
  days,
  restDayLabel,
  todayWeekday,
}: {
  days: ProgramDay[];
  restDayLabel: string;
  todayWeekday: number;
}) {
  const byWeekday = new Map<number, ProgramDay>();
  for (const day of days) {
    if (!byWeekday.has(day.weekday)) byWeekday.set(day.weekday, day);
  }
  return (
    <nav className="week" aria-label="Week">
      <ol>
        {DAY_SHORT.map((short, weekday) => {
          const day = byWeekday.get(weekday);
          const liClass =
            [day ? 'gym' : null, weekday === todayWeekday ? 'is-today' : null]
              .filter(Boolean)
              .join(' ') || undefined;
          return (
            <li key={weekday} className={liClass}>
              <a href={day ? `#day-${weekday}` : '#rest'}>
                <span className="dow">{short}</span>
                <span className="what">{day ? day.name : restDayLabel}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
