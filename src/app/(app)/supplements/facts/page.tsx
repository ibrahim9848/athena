import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { DAY_LETTER, DAY_NAMES } from '@/lib/dates';
import { getSupplementNotes, supplementsWithCoverage } from '@/server/supplements';
import { PillGlyph } from '@/components/PillGlyph';
import { Markdown } from '@/components/supplements/markdown';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Supplement Facts' };

function listDayNames(days: number[]): string {
  const names = days.map((d) => DAY_NAMES[d] as string);
  if (names.length === 0) return 'no days';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function weekLabel(days: Set<number>, boosted: Set<number>, boostDose: string | null): string {
  const sorted = [...days].sort((a, b) => a - b);
  const base = days.size === 7 ? 'Every day' : listDayNames(sorted);
  if (boosted.size > 0 && boostDose) {
    return `${base}, ${boostDose} on ${listDayNames([...boosted].sort((a, b) => a - b))}`;
  }
  return base;
}

function WatchLines({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line, i) => {
          const match = /^([^:]+):\s*(.*)$/.exec(line);
          return (
            <p key={i} className="watch">
              {match ? (
                <>
                  <b>{match[1]}:</b> {match[2]}
                </>
              ) : (
                line
              )}
            </p>
          );
        })}
    </>
  );
}

export default async function FactsPage() {
  const user = await requireUser();
  const facts = supplementsWithCoverage(user.id);
  const notes = getSupplementNotes(user.id);

  const servingSlotIds = new Set<string>();
  for (const fact of facts) {
    for (const rule of fact.rules) servingSlotIds.add(rule.slotId);
  }

  return (
    <div className="wrap grid gap-7 pb-11 pt-7">
      <section className="facts" aria-labelledby="facts-title">
        <h2 id="facts-title">Supplement Facts</h2>
        <div className="serving">
          <span>
            Serving times <b>{servingSlotIds.size} a day</b>
          </span>
          <span>
            Supplements <b>{facts.length}</b>
          </span>
        </div>
        <div className="rule-thick" />
        <div className="colhead">
          <span>Supplement</span>
          <span>Dose and time</span>
        </div>

        {facts.map(({ supplement, rules, days, boosted, slots }) => {
          const ruleSlotIds = new Set(rules.map((r) => r.slotId));
          const slotNames = slots.filter((s) => ruleSlotIds.has(s.id)).map((s) => s.name);
          const boostDose =
            rules.find((r) => r.doseOverride && r.doseOverride !== supplement.defaultDose)
              ?.doseOverride ?? null;
          return (
            <article key={supplement.id} className="fact">
              <div className="fact-top">
                <div className="fact-id">
                  <h3 className="fact-name">
                    <PillGlyph form={supplement.form} color={supplement.color} />
                    {supplement.name}
                  </h3>
                  <span
                    className="wk"
                    role="img"
                    aria-label={weekLabel(days, boosted, boostDose)}
                  >
                    {DAY_LETTER.map((letter, d) => {
                      const classes = [
                        days.has(d) ? 'on' : null,
                        boosted.has(d) ? 'x2' : null,
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <i
                          key={d}
                          className={classes || undefined}
                          style={{ '--c': supplement.color } as CSSProperties}
                        >
                          {letter}
                        </i>
                      );
                    })}
                  </span>
                </div>
                <p className="fact-amt">
                  <b>{supplement.defaultDose}</b>
                  {slotNames.map((name, i) => (
                    <Fragment key={name}>
                      {i > 0 ? <br /> : null}
                      {name}
                    </Fragment>
                  ))}
                </p>
              </div>
              {supplement.ingredients ? (
                <p className="contains">{supplement.ingredients}</p>
              ) : null}
              {supplement.why ? (
                <p className="why">
                  <b>Why:</b> {supplement.why}
                </p>
              ) : null}
              {supplement.watchFor ? <WatchLines text={supplement.watchFor} /> : null}
            </article>
          );
        })}

        <div className="rule-thick" />
        {notes ? (
          <div className="notes-md pt-3">
            <Markdown text={notes} />
          </div>
        ) : null}
      </section>

      <div>
        <Link className="btn" href="/supplements/edit">
          Edit plan
        </Link>
      </div>
    </div>
  );
}
