'use client';

import { useState } from 'react';
import { DAY_TINY, formatYmd, weekdayOfYmd } from '@/lib/dates';

export type HistoryDay = {
  date: string;
  taken: number;
  total: number;
  /** "Name · dose" for every item not taken that day. */
  missed: string[];
};

function levelOf(day: HistoryDay): number {
  if (day.total === 0 || day.taken === 0) return 0;
  if (day.taken < day.total / 2) return 1;
  if (day.taken < day.total) return 2;
  return 3;
}

/** 8-week heat strip; tapping a day shows what was missed below. */
export function HistoryHeat({ days }: { days: HistoryDay[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const first = days[0];
  const leading = first ? weekdayOfYmd(first.date) : 0;
  const selectedDay = days.find((d) => d.date === selected) ?? null;

  return (
    <div className="grid gap-4">
      <div className="heat">
        {DAY_TINY.map((tiny) => (
          <span key={tiny} className="label text-center" aria-hidden="true">
            {tiny}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className="heat-cell"
            data-level={levelOf(day)}
            aria-pressed={selected === day.date}
            aria-label={`${formatYmd(day.date)}, ${day.taken} of ${day.total} taken`}
            onClick={() => setSelected(selected === day.date ? null : day.date)}
          >
            {Number(day.date.slice(8, 10))}
          </button>
        ))}
      </div>
      {selectedDay ? (
        <div className="card grid gap-1 p-4">
          <p className="eyebrow">{formatYmd(selectedDay.date)}</p>
          <p className="tnum font-semibold">
            {selectedDay.taken} of {selectedDay.total} taken
          </p>
          {selectedDay.missed.length > 0 ? (
            <>
              <p className="label mt-1">Missed</p>
              <ul className="m-0 grid list-disc gap-1 pl-5">
                {selectedDay.missed.map((item, i) => (
                  <li key={`${i}-${item}`} className="muted">
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">
              {selectedDay.total > 0 ? 'Everything taken.' : 'Nothing was scheduled.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
