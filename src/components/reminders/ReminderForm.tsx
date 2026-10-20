'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { DAY_SHORT } from '@/lib/dates';
import {
  deleteReminderAction,
  saveReminderAction,
  type ReminderFormState,
} from '@/app/(app)/settings/reminders/actions';

export type ReminderOption = { id: string; name: string };

export type ReminderValue = {
  id: string;
  kind: 'slot' | 'workout' | 'custom';
  refId: string | null;
  time: string;
  days: number[];
  enabled: boolean;
  label: string | null;
};

type Props = {
  /** null renders the add-reminder form */
  reminder: ReminderValue | null;
  slots: ReminderOption[];
  workoutDays: ReminderOption[];
};

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending ? 'Saving…' : isNew ? 'Add reminder' : 'Save'}
    </button>
  );
}

export function ReminderForm({ reminder, slots, workoutDays }: Props) {
  const [state, action] = useFormState<ReminderFormState, FormData>(saveReminderAction, null);
  const [kind, setKind] = useState<ReminderValue['kind']>(
    reminder?.kind ?? (slots.length > 0 ? 'slot' : workoutDays.length > 0 ? 'workout' : 'custom'),
  );
  const [deleting, setDeleting] = useState(false);

  const refOptions = kind === 'slot' ? slots : kind === 'workout' ? workoutDays : [];
  const refLabel = kind === 'slot' ? 'Meal slot' : 'Training day';
  const refDefault = reminder && reminder.kind === kind ? (reminder.refId ?? undefined) : undefined;

  return (
    <form action={action} className="card" style={{ padding: 16, display: 'grid', gap: 14 }}>
      {reminder ? <input type="hidden" name="id" value={reminder.id} /> : null}

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        }}
      >
        <label className="field">
          <span>Remind about</span>
          <select
            className="select"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ReminderValue['kind'])}
          >
            <option value="slot">Meal slot</option>
            <option value="workout">Training day</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        {kind !== 'custom' ? (
          <label className="field">
            <span>{refLabel}</span>
            <select
              key={kind}
              className="select"
              name="refId"
              defaultValue={refDefault}
              disabled={refOptions.length === 0}
            >
              {refOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>Time</span>
          <input className="input" type="time" name="time" defaultValue={reminder?.time ?? '09:00'} required />
        </label>
      </div>

      {kind === 'slot' && slots.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          No meal slots yet — add slots in the supplements editor first.
        </p>
      ) : null}
      {kind === 'workout' && workoutDays.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          No active program with training days yet.
        </p>
      ) : null}

      <div className="field">
        <span>Days</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 4px' }}>
          {DAY_SHORT.map((name, i) => (
            <label
              key={name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                padding: '0 8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="days"
                value={i}
                defaultChecked={reminder ? reminder.days.includes(i) : true}
                style={{ width: 18, height: 18, accentColor: 'var(--muscle)' }}
              />
              <span style={{ fontSize: 14 }}>{name}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Label</span>
        <input
          className="input"
          name="label"
          defaultValue={reminder?.label ?? ''}
          placeholder="Optional notification title"
          maxLength={120}
        />
      </label>

      {state?.error ? <p className="form-error">{state.error}</p> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            cursor: 'pointer',
            marginRight: 'auto',
          }}
        >
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={reminder?.enabled ?? true}
            style={{ width: 18, height: 18, accentColor: 'var(--muscle)' }}
          />
          <span style={{ fontSize: 14 }}>Enabled</span>
        </label>
        <SaveButton isNew={!reminder} />
        {reminder ? (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              const fd = new FormData();
              fd.append('id', reminder.id);
              void deleteReminderAction(fd).finally(() => setDeleting(false));
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
