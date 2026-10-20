'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import type { PlanSupplement, ResolvedDay, ResolvedItem } from '@/lib/plan';
import { DAY_NAMES, DAY_TINY, formatYmd, weekdayOfYmd } from '@/lib/dates';
import { sendOps } from '@/lib/outbox';
import { PillGlyph } from '@/components/PillGlyph';

export type SupplementsViewProps = {
  /** Sunday..Saturday of the current week. */
  days: ResolvedDay[];
  todayYmd: string;
  timezone: string;
  /** Weekdays (0=Sun..6=Sat) that have a program day in the active program. */
  gymWeekdays: number[];
  /** "full" = 7-day box + day switching; "today" = today's plan panel only. */
  mode: 'full' | 'today';
};

/** Client-side copy of todayInTz: YYYY-MM-DD right now in the given timezone. */
function ymdNow(timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', opts).format(new Date());
  }
}

type RowGroup = {
  supplement: PlanSupplement;
  glyphs: { key: string; ruleId: string }[];
  stack: boolean;
};

/**
 * Rows of pills for one day-box well: one row per distinct supplement in the
 * day (ordered by supplement sort order), each item contributing `count`
 * glyphs. A multi-glyph item stacks its row vertically, like the reference.
 */
function rowGroupsFor(day: ResolvedDay): RowGroup[] {
  const bySupplement = new Map<string, RowGroup>();
  for (const { items } of day.slots) {
    for (const item of items) {
      let group = bySupplement.get(item.supplement.id);
      if (!group) {
        group = { supplement: item.supplement, glyphs: [], stack: false };
        bySupplement.set(item.supplement.id, group);
      }
      if (item.count > 1) group.stack = true;
      for (let i = 0; i < item.count; i++) {
        group.glyphs.push({ key: `${item.rule.id}-${i}`, ruleId: item.rule.id });
      }
    }
  }
  return [...bySupplement.values()].sort(
    (a, b) =>
      a.supplement.sortOrder - b.supplement.sortOrder ||
      a.supplement.name.localeCompare(b.supplement.name),
  );
}

function ItemText({ item }: { item: ResolvedItem }) {
  return (
    <>
      <span className="glyph">
        <PillGlyph form={item.supplement.form} color={item.supplement.color} />
      </span>
      <span className="txt">
        <span className="nm">{item.supplement.name}</span>
        <span className="item-dose">{` · ${item.dose}`}</span>
        {item.note ? <span className="note">{item.note}</span> : null}
      </span>
    </>
  );
}

export function SupplementsView({ days, todayYmd, timezone, gymWeekdays, mode }: SupplementsViewProps) {
  const router = useRouter();
  const todayWeekday = weekdayOfYmd(todayYmd);

  const [selected, setSelected] = useState(todayWeekday);
  useEffect(() => {
    setSelected(weekdayOfYmd(todayYmd));
  }, [todayYmd]);

  const effective = mode === 'today' ? todayWeekday : selected;
  const day = days.find((d) => d.weekday === effective) ?? null;
  const todayDay = days.find((d) => d.date === todayYmd) ?? null;
  const isTodaySelected = effective === todayWeekday;

  // Optimistic "taken" state for today, initialised from (and re-synced to) props.
  const serverTaken = useMemo(() => {
    const set = new Set<string>();
    if (todayDay) {
      for (const { items } of todayDay.slots) {
        for (const item of items) if (item.taken) set.add(item.rule.id);
      }
    }
    return set;
  }, [todayDay]);
  const [taken, setTaken] = useState<Set<string>>(serverTaken);
  useEffect(() => {
    setTaken(serverTaken);
  }, [serverTaken]);

  async function toggle(ruleId: string) {
    const next = !taken.has(ruleId);
    const updated = new Set(taken);
    if (next) updated.add(ruleId);
    else updated.delete(ruleId);
    setTaken(updated);
    const result = await sendOps([{ kind: 'tick', ruleId, date: todayYmd, taken: next }]);
    if (result === 'sent') router.refresh();
  }

  // Roll the date over at local midnight and refresh when the tab comes back.
  useEffect(() => {
    const check = () => {
      if (ymdNow(timezone) !== todayYmd) router.refresh();
    };
    const interval = window.setInterval(check, 60_000);
    const onVisibility = () => {
      // Refreshing on every return to the tab also keeps ticks made on
      // another device in sync, and covers the midnight rollover.
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timezone, todayYmd, router]);

  const legendSupplements = useMemo(() => {
    const map = new Map<string, PlanSupplement>();
    for (const d of days) {
      for (const { items } of d.slots) {
        for (const item of items) {
          if (!map.has(item.supplement.id)) map.set(item.supplement.id, item.supplement);
        }
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }, [days]);

  const todayItems = useMemo(
    () => (todayDay ? todayDay.slots.flatMap((s) => s.items) : []),
    [todayDay],
  );
  const takenCount = todayItems.filter((item) => taken.has(item.rule.id)).length;
  const countText =
    todayItems.length === 0
      ? 'Nothing scheduled today'
      : takenCount === todayItems.length
        ? `All ${todayItems.length} taken today`
        : `${takenCount} of ${todayItems.length} taken`;

  const box =
    mode === 'full' ? (
      <div>
        <div className="box" role="group" aria-label="Days of the week">
          {days.map((d) => {
            const isToday = d.date === todayYmd;
            const gym = gymWeekdays.includes(d.weekday);
            const ariaLabel =
              DAY_NAMES[d.weekday] +
              (isToday ? ', today' : '') +
              (d.dayLabel ? `, ${d.dayLabel}` : '') +
              (gym ? ', gym day' : '');
            return (
              <button
                key={d.date}
                type="button"
                className="boxcell"
                aria-pressed={d.weekday === selected}
                aria-label={ariaLabel}
                onClick={() => setSelected(d.weekday)}
              >
                <span className="lid">{DAY_TINY[d.weekday]}</span>
                <span className="well">
                  {rowGroupsFor(d).map((group) => (
                    <span
                      key={group.supplement.id}
                      className={group.stack ? 'pills-row stack' : 'pills-row'}
                    >
                      {group.glyphs.map((glyph) => (
                        <PillGlyph
                          key={glyph.key}
                          form={group.supplement.form}
                          color={group.supplement.color}
                          className={isToday && taken.has(glyph.ruleId) ? 'gone' : undefined}
                        />
                      ))}
                    </span>
                  ))}
                </span>
                <span className="tag" style={{ visibility: isToday ? 'visible' : 'hidden' }}>
                  Today
                </span>
              </button>
            );
          })}
        </div>
        <div className="pill-legend">
          {legendSupplements.map((s) => (
            <span key={s.id}>
              <PillGlyph form={s.form} color={s.color} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="grid gap-7">
      {box}
      <section className="plan" aria-labelledby="plan-title">
        <div className="plan-head">
          <div className="plan-title-wrap">
            <p className="eyebrow">{isTodaySelected ? 'Today' : 'Plan for'}</p>
            <h2 id="plan-title">
              {isTodaySelected ? formatYmd(todayYmd) : DAY_NAMES[effective]}
            </h2>
          </div>
          <div className="plan-tools">
            {day?.dayLabel && day.dayLabelSupplement ? (
              <span className="badge">
                <PillGlyph
                  form={day.dayLabelSupplement.form}
                  color={day.dayLabelSupplement.color}
                />
                {day.dayLabel}
              </span>
            ) : null}
            {gymWeekdays.includes(effective) ? (
              <span className="badge">
                <span className="db-icon" aria-hidden="true" />
                Gym day
              </span>
            ) : null}
            {day?.variantLabel ? <span className="badge">{day.variantLabel}</span> : null}
            {mode === 'full' && !isTodaySelected ? (
              <button type="button" className="back" onClick={() => setSelected(todayWeekday)}>
                Back to today
              </button>
            ) : null}
          </div>
        </div>

        {isTodaySelected ? (
          <div className="progress">
            <div className="segs" aria-hidden="true">
              {todayItems.map((item) => (
                <span
                  key={item.rule.id}
                  className={taken.has(item.rule.id) ? 'seg on' : 'seg'}
                  style={{ '--c': item.supplement.color } as CSSProperties}
                />
              ))}
            </div>
            <p className="count" aria-live="polite">
              {countText}
            </p>
          </div>
        ) : null}

        <div className="slots">
          {day && day.slots.length > 0 ? (
            day.slots.map(({ slot, items }) => (
              <div key={slot.id} className="slot">
                <div className="slot-head">
                  <h3 className="slot-name">{slot.name}</h3>
                  {slot.subtitle ? <span className="slot-sub">{slot.subtitle}</span> : null}
                </div>
                <div className="items">
                  {items.map((item) =>
                    isTodaySelected ? (
                      <button
                        key={item.rule.id}
                        type="button"
                        className="item"
                        aria-pressed={taken.has(item.rule.id)}
                        onClick={() => void toggle(item.rule.id)}
                      >
                        <ItemText item={item} />
                        <span className="check" aria-hidden="true" />
                      </button>
                    ) : (
                      <div key={item.rule.id} className="item static">
                        <ItemText item={item} />
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="muted" style={{ padding: '14px 0' }}>
              Nothing scheduled for this day.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
