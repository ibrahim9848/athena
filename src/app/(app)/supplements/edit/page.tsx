import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getPlanData, getSupplementNotes } from '@/server/supplements';
import { DAY_SHORT } from '@/lib/dates';
import { PillGlyph } from '@/components/PillGlyph';
import type { DayVariant, MealSlot, ScheduleRule, Supplement } from '@/db/schema';
import {
  deleteRuleAction,
  deleteSlotAction,
  deleteSupplementAction,
  deleteVariantAction,
  saveNotesAction,
  setAlternatingAction,
  upsertRuleAction,
  upsertSlotAction,
  upsertSupplementAction,
  upsertVariantAction,
} from './actions';

export const metadata: Metadata = { title: 'Edit supplement plan' };
export const dynamic = 'force-dynamic';

const SUPPLEMENT_FORMS = ['tablet', 'capsule', 'softgel', 'chewable', 'scoop', 'other'] as const;

/* ---------- shared inline layout styles ---------- */

const section: CSSProperties = { display: 'grid', gap: 12, paddingTop: 36 };
const h2Style: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 26,
  lineHeight: 1,
  textTransform: 'uppercase',
};
const hint: CSSProperties = { fontSize: 14, marginTop: 4 };
const cardPad: CSSProperties = { padding: 16, display: 'grid', gap: 12 };
const fieldGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
};
const btnRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 };
const headRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 };
const checkRow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  cursor: 'pointer',
};
const checkbox: CSSProperties = { width: 20, height: 20, margin: 0, accentColor: 'var(--muscle)' };
const dayCheck: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 44,
  padding: '0 11px',
  border: '1px solid var(--line)',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'var(--font-label)',
  fontWeight: 600,
  fontSize: 13,
};

const normalizeVariant = (v: string | null): string | null =>
  v == null || v === '' || v === 'default' ? null : v;

/* ---------- small pieces ---------- */

function SupplementFormSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select className="select" name="form" defaultValue={defaultValue}>
      {SUPPLEMENT_FORMS.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

/** Seven weekday checkboxes; name="days", value 0=Sun..6=Sat. */
function DayChecks({ selected }: { selected: number[] }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ padding: 0, marginBottom: 6 }}>
        Days
      </legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DAY_SHORT.map((label, day) => (
          <label key={label} style={dayCheck}>
            <input
              type="checkbox"
              name="days"
              value={day}
              defaultChecked={selected.includes(day)}
              style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--muscle)' }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- supplements ---------- */

function SupplementCard({ supplement: s }: { supplement: Supplement }) {
  return (
    <form
      action={upsertSupplementAction}
      className="card"
      style={{ ...cardPad, opacity: s.archived ? 0.55 : undefined }}
    >
      <input type="hidden" name="id" value={s.id} />
      <div style={headRow}>
        <PillGlyph form={s.form} color={s.color} />
        <span className="nm">{s.name}</span>
        {s.archived ? <span className="tag">Archived</span> : null}
      </div>
      <div style={fieldGrid}>
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" defaultValue={s.name} required />
        </label>
        <label className="field">
          <span>Form</span>
          <SupplementFormSelect defaultValue={s.form} />
        </label>
        <label className="field">
          <span>Default dose</span>
          <input className="input" name="defaultDose" defaultValue={s.defaultDose} required />
        </label>
        <label className="field">
          <span>Colour</span>
          <input
            type="color"
            className="input"
            name="color"
            defaultValue={s.color}
            style={{ height: 44, padding: 6 }}
          />
        </label>
        <label className="field">
          <span>Sort order</span>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            name="sortOrder"
            defaultValue={s.sortOrder}
          />
        </label>
        <div className="field">
          <span>Archived</span>
          <label style={checkRow}>
            <input type="checkbox" name="archived" defaultChecked={s.archived} style={checkbox} />
            <span className="muted" style={{ fontSize: 14 }}>
              Hide from the plan
            </span>
          </label>
        </div>
      </div>
      <details>
        <summary className="label" style={{ cursor: 'pointer', minHeight: 44, lineHeight: '44px' }}>
          Details
        </summary>
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            <span>Ingredients</span>
            <textarea className="textarea" name="ingredients" defaultValue={s.ingredients ?? ''} />
          </label>
          <label className="field">
            <span>Why</span>
            <textarea className="textarea" name="why" defaultValue={s.why ?? ''} />
          </label>
          <label className="field">
            <span>Watch for</span>
            <textarea className="textarea" name="watchFor" defaultValue={s.watchFor ?? ''} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea className="textarea" name="notes" defaultValue={s.notes ?? ''} />
          </label>
          <div style={btnRow}>
            <label style={checkRow}>
              <input type="checkbox" name="confirm" style={checkbox} />
              <span style={{ fontSize: 14 }}>Confirm delete</span>
            </label>
            <button type="submit" className="btn btn-danger btn-sm" formAction={deleteSupplementAction}>
              Delete supplement
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Deleting removes its schedule rules and their history. Prefer archiving.
          </p>
        </div>
      </details>
      <div style={btnRow}>
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
      </div>
    </form>
  );
}

function AddSupplementForm() {
  return (
    <form action={upsertSupplementAction} className="card" style={cardPad}>
      <p className="label">Add supplement</p>
      <div style={fieldGrid}>
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" placeholder="Vitamin D" required />
        </label>
        <label className="field">
          <span>Form</span>
          <SupplementFormSelect defaultValue="tablet" />
        </label>
        <label className="field">
          <span>Default dose</span>
          <input className="input" name="defaultDose" placeholder="1 tablet" required />
        </label>
      </div>
      <div style={btnRow}>
        <button type="submit" className="btn btn-dark btn-sm">
          Add supplement
        </button>
      </div>
    </form>
  );
}

/* ---------- meal slots ---------- */

function SlotRow({ slot }: { slot: MealSlot }) {
  return (
    <form action={upsertSlotAction} className="card" style={cardPad}>
      <input type="hidden" name="id" value={slot.id} />
      <div style={fieldGrid}>
        <label className="field">
          <span>Key</span>
          <input
            className="input"
            name="key"
            defaultValue={slot.key}
            autoCapitalize="none"
            autoCorrect="off"
            style={{ textTransform: 'lowercase' }}
            required
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" defaultValue={slot.name} required />
        </label>
        <label className="field">
          <span>Subtitle</span>
          <input className="input" name="subtitle" defaultValue={slot.subtitle ?? ''} />
        </label>
        <label className="field">
          <span>Default time</span>
          <input type="time" className="input" name="defaultTime" defaultValue={slot.defaultTime ?? ''} />
        </label>
        <label className="field">
          <span>Sort order</span>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            name="sortOrder"
            defaultValue={slot.sortOrder}
          />
        </label>
      </div>
      <div style={btnRow}>
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="submit" className="btn btn-danger btn-sm" formAction={deleteSlotAction}>
          Delete
        </button>
      </div>
    </form>
  );
}

function AddSlotForm() {
  return (
    <form action={upsertSlotAction} className="card" style={cardPad}>
      <p className="label">Add meal slot</p>
      <div style={fieldGrid}>
        <label className="field">
          <span>Key</span>
          <input
            className="input"
            name="key"
            placeholder="breakfast"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ textTransform: 'lowercase' }}
            required
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" placeholder="Breakfast" required />
        </label>
        <label className="field">
          <span>Default time</span>
          <input type="time" className="input" name="defaultTime" />
        </label>
      </div>
      <div style={btnRow}>
        <button type="submit" className="btn btn-dark btn-sm">
          Add slot
        </button>
      </div>
    </form>
  );
}

/* ---------- day variants ---------- */

function DaySelect({ name, defaultValue }: { name: string; defaultValue: number }) {
  return (
    <select className="select" name={name} defaultValue={String(defaultValue)}>
      {DAY_SHORT.map((label, day) => (
        <option key={label} value={day}>
          {label}
        </option>
      ))}
    </select>
  );
}

function VariantRow({ variant: v }: { variant: DayVariant }) {
  return (
    <form action={upsertVariantAction} className="card" style={cardPad}>
      <input type="hidden" name="id" value={v.id} />
      <div style={fieldGrid}>
        <label className="field">
          <span>Day</span>
          <DaySelect name="day" defaultValue={v.day} />
        </label>
        <label className="field">
          <span>Variant key</span>
          <input
            className="input"
            name="variant"
            defaultValue={v.variant}
            placeholder="two_meal"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </label>
        <label className="field">
          <span>Label</span>
          <input className="input" name="label" defaultValue={v.label} placeholder="Two-meal day" required />
        </label>
      </div>
      <div style={btnRow}>
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="submit" className="btn btn-danger btn-sm" formAction={deleteVariantAction}>
          Delete
        </button>
      </div>
    </form>
  );
}

function AddVariantForm() {
  return (
    <form action={upsertVariantAction} className="card" style={cardPad}>
      <p className="label">Add day variant</p>
      <div style={fieldGrid}>
        <label className="field">
          <span>Day</span>
          <DaySelect name="day" defaultValue={5} />
        </label>
        <label className="field">
          <span>Variant key</span>
          <input
            className="input"
            name="variant"
            placeholder="two_meal"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </label>
        <label className="field">
          <span>Label</span>
          <input className="input" name="label" placeholder="Two-meal day" required />
        </label>
      </div>
      <div style={btnRow}>
        <button type="submit" className="btn btn-dark btn-sm">
          Add variant
        </button>
      </div>
    </form>
  );
}

/* ---------- schedule rules ---------- */

function RuleCard({
  rule,
  supplements,
  slots,
  variantKeys,
  alternates,
}: {
  rule: ScheduleRule;
  supplements: Supplement[];
  slots: MealSlot[];
  variantKeys: string[];
  alternates: { id: string; label: string }[];
}) {
  const supplement = supplements.find((s) => s.id === rule.supplementId);
  const slot = slots.find((s) => s.id === rule.slotId);
  return (
    <div className="card" style={{ padding: 14, display: 'grid', gap: 12 }}>
      <form action={upsertRuleAction} style={{ display: 'grid', gap: 12 }}>
        <input type="hidden" name="id" value={rule.id} />
        <div style={headRow}>
          {supplement ? <PillGlyph form={supplement.form} color={supplement.color} /> : null}
          <span className="nm">{supplement?.name ?? 'Supplement'}</span>
          <span className="muted">· {slot?.name ?? 'Slot'}</span>
        </div>
        <div style={fieldGrid}>
          <label className="field">
            <span>Supplement</span>
            <select className="select" name="supplementId" defaultValue={rule.supplementId}>
              {supplements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Slot</span>
            <select className="select" name="slotId" defaultValue={rule.slotId}>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DayChecks selected={rule.days} />
        <div style={fieldGrid}>
          <label className="field">
            <span>Dose override</span>
            <input
              className="input"
              name="doseOverride"
              defaultValue={rule.doseOverride ?? ''}
              placeholder={supplement?.defaultDose ?? ''}
            />
          </label>
          <label className="field">
            <span>Note</span>
            <input className="input" name="note" defaultValue={rule.note ?? ''} />
          </label>
          <label className="field">
            <span>Variant</span>
            <select
              className="select"
              name="variant"
              defaultValue={normalizeVariant(rule.variant) ?? 'default'}
            >
              <option value="default">default</option>
              {variantKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sort order</span>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              name="sortOrder"
              defaultValue={rule.sortOrder}
            />
          </label>
        </div>
        <div style={btnRow}>
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>
          <button type="submit" className="btn btn-danger btn-sm" formAction={deleteRuleAction}>
            Delete
          </button>
        </div>
      </form>
      {alternates.length > 0 ? (
        <form
          action={setAlternatingAction}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--line)',
            paddingTop: 12,
          }}
        >
          <input type="hidden" name="ruleAId" value={rule.id} />
          <label className="field" style={{ flex: '1 1 220px' }}>
            <span>Alternate with…</span>
            <select className="select" name="ruleBId" required>
              {alternates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-sm">
            Apply
          </button>
          <p className="muted" style={{ fontSize: 13, flexBasis: '100%' }}>
            Sets this rule to Sun · Tue · Thu · Sat and the other to Mon · Wed · Fri.
          </p>
        </form>
      ) : null}
    </div>
  );
}

function AddRuleForm({ supplements, slots }: { supplements: Supplement[]; slots: MealSlot[] }) {
  if (supplements.length === 0 || slots.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        Add a supplement and a meal slot first, then rules can connect them.
      </p>
    );
  }
  return (
    <form action={upsertRuleAction} className="card" style={cardPad}>
      <p className="label">Add rule</p>
      <div style={fieldGrid}>
        <label className="field">
          <span>Supplement</span>
          <select className="select" name="supplementId" defaultValue={supplements[0].id}>
            {supplements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Slot</span>
          <select className="select" name="slotId" defaultValue={slots[0].id}>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        A new rule starts on every day of the week — edit its days after adding.
      </p>
      <div style={btnRow}>
        <button type="submit" className="btn btn-dark btn-sm">
          Add rule
        </button>
      </div>
    </form>
  );
}

/* ---------- page ---------- */

export default async function SupplementsEditPage() {
  const user = await requireUser();
  const { supplements, slots, rules, variants } = getPlanData(user.id);
  const notes = getSupplementNotes(user.id);

  const supplementById = new Map(supplements.map((s) => [s.id, s]));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const slotPosition = new Map(slots.map((s, i) => [s.id, i]));

  const variantKeys = [
    ...new Set([
      ...variants.map((v) => v.variant),
      ...rules
        .map((r) => normalizeVariant(r.variant))
        .filter((v): v is string => v != null),
    ]),
  ].sort();

  const sortedRules = [...rules].sort((a, b) => {
    const va = normalizeVariant(a.variant) ?? '';
    const vb = normalizeVariant(b.variant) ?? '';
    if (va !== vb) return va < vb ? -1 : 1;
    const sa = slotPosition.get(a.slotId) ?? 999;
    const sb = slotPosition.get(b.slotId) ?? 999;
    if (sa !== sb) return sa - sb;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const na = supplementById.get(a.supplementId)?.name ?? '';
    const nb = supplementById.get(b.supplementId)?.name ?? '';
    return na.localeCompare(nb);
  });

  const ruleGroups: { variant: string | null; rules: ScheduleRule[] }[] = [];
  for (const rule of sortedRules) {
    const v = normalizeVariant(rule.variant);
    const last = ruleGroups[ruleGroups.length - 1];
    if (last && last.variant === v) last.rules.push(rule);
    else ruleGroups.push({ variant: v, rules: [rule] });
  }

  const ruleLabel = (r: ScheduleRule): string => {
    const name = supplementById.get(r.supplementId)?.name ?? 'Supplement';
    const slotName = slotById.get(r.slotId)?.name ?? 'Slot';
    const days = r.days.map((d) => DAY_SHORT[d] ?? '?').join(' ');
    return `${name} · ${slotName} · ${days}`;
  };
  const alternatesFor = (rule: ScheduleRule) =>
    sortedRules
      .filter((r) => r.id !== rule.id && normalizeVariant(r.variant) === normalizeVariant(rule.variant))
      .map((r) => ({ id: r.id, label: ruleLabel(r) }));

  const sortedVariants = [...variants].sort((a, b) => a.day - b.day || a.variant.localeCompare(b.variant));

  return (
    <div className="wrap" style={{ paddingBlock: '28px 44px' }}>
      <header style={{ display: 'grid', gap: 8 }}>
        <p className="eyebrow">Supplements</p>
        <h1 className="page-title">Edit plan</h1>
        <p className="lede">
          Supplements, meal slots, day variants and the schedule rules that build each day. Saved
          changes show on the plan straight away.
        </p>
        <p style={{ marginTop: 4 }}>
          <Link href="/supplements" className="btn btn-sm">
            ← Back to the plan
          </Link>
        </p>
      </header>

      {/* 1 — supplements */}
      <section aria-labelledby="sec-supplements" style={section}>
        <div>
          <h2 id="sec-supplements" style={h2Style}>
            Supplements
          </h2>
          <p className="muted" style={hint}>
            One card per supplement. Archived ones stay here, muted, and never show on the plan.
          </p>
        </div>
        {supplements.map((s) => (
          <SupplementCard key={s.id} supplement={s} />
        ))}
        <AddSupplementForm />
      </section>

      {/* 2 — meal slots */}
      <section aria-labelledby="sec-slots" style={section}>
        <div>
          <h2 id="sec-slots" style={h2Style}>
            Meal slots
          </h2>
          <p className="muted" style={hint}>
            The daily time anchors rules attach to. Deleting a slot also deletes its rules.
          </p>
        </div>
        {slots.map((slot) => (
          <SlotRow key={slot.id} slot={slot} />
        ))}
        <AddSlotForm />
      </section>

      {/* 3 — day variants */}
      <section aria-labelledby="sec-variants" style={section}>
        <div>
          <h2 id="sec-variants" style={h2Style}>
            Day variants
          </h2>
          <p className="muted" style={hint}>
            On a day with a variant, only rules tagged with that variant apply.
          </p>
        </div>
        {sortedVariants.map((v) => (
          <VariantRow key={v.id} variant={v} />
        ))}
        <AddVariantForm />
      </section>

      {/* 4 — schedule rules */}
      <section aria-labelledby="sec-rules" style={section}>
        <div>
          <h2 id="sec-rules" style={h2Style}>
            Schedule rules
          </h2>
          <p className="muted" style={hint}>
            This supplement, in this slot, on these days. A rule keeps at least one day — saving
            with none ticked is ignored.
          </p>
        </div>
        {ruleGroups.map((group) => (
          <div key={group.variant ?? 'default'} style={{ display: 'grid', gap: 12 }}>
            <p className="eyebrow" style={{ marginTop: 4 }}>
              {group.variant == null ? 'Default days' : `Variant · ${group.variant}`}
            </p>
            {group.rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                supplements={supplements}
                slots={slots}
                variantKeys={variantKeys}
                alternates={alternatesFor(rule)}
              />
            ))}
          </div>
        ))}
        <AddRuleForm supplements={supplements} slots={slots} />
      </section>

      {/* 5 — plan notes */}
      <section aria-labelledby="sec-notes" style={section}>
        <div>
          <h2 id="sec-notes" style={h2Style}>
            Plan notes
          </h2>
          <p className="muted" style={hint}>
            Markdown. Shown at the bottom of the Facts page.
          </p>
        </div>
        <form action={saveNotesAction} className="card" style={cardPad}>
          <label className="field">
            <span>Notes (Markdown)</span>
            <textarea
              className="textarea"
              name="notes"
              defaultValue={notes ?? ''}
              rows={12}
              style={{ minHeight: 220 }}
            />
          </label>
          <div style={btnRow}>
            <button type="submit" className="btn btn-primary btn-sm">
              Save notes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
