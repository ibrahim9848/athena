import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { requireUser } from '@/lib/auth';
import { DAY_NAMES } from '@/lib/dates';
import type { Exercise, ProgramExercise } from '@/db/schema';
import {
  getDayExercises,
  getExercisesForUser,
  getProgramDays,
  getPrograms,
  getSessionRules,
} from '@/server/workouts';
import {
  addExerciseAction,
  addProgramAction,
  addProgramDayAction,
  addProgramExerciseAction,
  addSessionRuleAction,
  deleteExerciseAction,
  deleteProgramAction,
  deleteProgramDayAction,
  deleteProgramExerciseAction,
  deleteSessionRuleAction,
  setActiveProgramAction,
  updateExerciseAction,
  updateProgramAction,
  updateProgramDayAction,
  updateProgramExerciseAction,
  updateSessionRuleAction,
} from './actions';

export const metadata: Metadata = { title: 'Edit program' };
export const dynamic = 'force-dynamic';

/* ---------- shared inline styles ---------- */

const sectionStyle: CSSProperties = { display: 'grid', gap: 14 };
const cardStyle: CSSProperties = { padding: 16, display: 'grid', gap: 14 };
const fieldsGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  alignItems: 'end',
};
const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const btnRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 };
const checkLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  cursor: 'pointer',
};
const checkboxStyle: CSSProperties = { width: 18, height: 18, accentColor: 'var(--muscle)' };

/* ---------- small server-side helpers ---------- */

function WeekdaySelect({ name, defaultValue }: { name: string; defaultValue: number }) {
  return (
    <select className="select" name={name} defaultValue={defaultValue}>
      {DAY_NAMES.map((dayName, i) => (
        <option key={dayName} value={i}>
          {dayName}
        </option>
      ))}
    </select>
  );
}

function ExerciseOptions({ library }: { library: Exercise[] }) {
  return (
    <>
      {library.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
          {e.archived ? ' (archived)' : ''}
        </option>
      ))}
    </>
  );
}

/** Sets / reps / rest / sort / per-side fields, shared by edit and add rows. */
function SchemeFields({ pe }: { pe?: ProgramExercise }) {
  return (
    <>
      <label className="field">
        <span>Sets</span>
        <input className="input" name="sets" type="number" min={1} required defaultValue={pe?.sets ?? 3} />
      </label>
      <label className="field">
        <span>Reps min</span>
        <input className="input" name="repsMin" type="number" min={1} required defaultValue={pe?.repsMin ?? 8} />
      </label>
      <label className="field">
        <span>Reps max</span>
        <input className="input" name="repsMax" type="number" min={1} required defaultValue={pe?.repsMax ?? 12} />
      </label>
      <label className="field">
        <span>Rest (s)</span>
        <input
          className="input"
          name="restSeconds"
          type="number"
          min={0}
          step={5}
          required
          defaultValue={pe?.restSeconds ?? 90}
        />
      </label>
      <label className="field">
        <span>Sort</span>
        <input className="input" name="sortOrder" type="number" defaultValue={pe?.sortOrder ?? 0} />
      </label>
      <label style={checkLabel}>
        <input type="checkbox" name="perSide" style={checkboxStyle} defaultChecked={pe?.perSide ?? false} />
        <span className="label">Per side</span>
      </label>
    </>
  );
}

/* ---------- page ---------- */

export default async function WorkoutsEditPage() {
  const user = await requireUser();
  const programsList = getPrograms(user.id);
  const exerciseLibrary = getExercisesForUser(user.id, true);
  const programsDetail = programsList.map((program) => ({
    program,
    days: getProgramDays(program.id).map((day) => ({ day, items: getDayExercises(day.id) })),
    rules: getSessionRules(program.id),
  }));

  return (
    <div className="wrap" style={{ paddingBlock: '28px 48px', display: 'grid', gap: 32 }}>
      <header style={{ display: 'grid', gap: 8 }}>
        <p className="label">Programs · Days · Exercises</p>
        <h1 className="page-title">Edit</h1>
        <p className="lede">
          Change your programs, training days, exercise library and session rules. Each row saves on
          its own.
        </p>
      </header>

      {/* ================= 1 · PROGRAMS ================= */}
      <section style={sectionStyle} aria-labelledby="programs-h">
        <h2 className="eyebrow" id="programs-h">
          Programs
        </h2>

        {programsDetail.map(({ program }) => (
          <article key={program.id} className="card" style={cardStyle}>
            <form action={updateProgramAction} style={{ display: 'grid', gap: 12 }}>
              <input type="hidden" name="programId" value={program.id} />
              <div style={fieldsGrid}>
                <label className="field">
                  <span>Name</span>
                  <input className="input" name="name" defaultValue={program.name} required />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input className="input" name="description" defaultValue={program.description ?? ''} />
                </label>
                <label className="field">
                  <span>Rest day label</span>
                  <input className="input" name="restDayLabel" defaultValue={program.restDayLabel} />
                </label>
              </div>
              <label className="field">
                <span>Rest day notes</span>
                <textarea className="textarea" name="restDayNotes" defaultValue={program.restDayNotes ?? ''} />
              </label>
              <p className="note">The first line may be a focus line with “·”, e.g. “Walk · easy recovery”.</p>
              <div style={btnRow}>
                <button type="submit" className="btn btn-sm btn-dark">
                  Save
                </button>
                <label style={checkLabel}>
                  <input type="checkbox" name="confirm" style={checkboxStyle} />
                  <span className="label">Confirm delete</span>
                </label>
                <button type="submit" className="btn btn-sm btn-danger" formAction={deleteProgramAction}>
                  Delete
                </button>
              </div>
            </form>
            <form action={setActiveProgramAction} style={btnRow}>
              <input type="hidden" name="programId" value={program.id} />
              <label style={checkLabel}>
                <input
                  type="radio"
                  name="active"
                  value={program.id}
                  defaultChecked={program.isActive}
                  style={checkboxStyle}
                />
                <span className="label">Active</span>
              </label>
              {program.isActive ? (
                <span className="badge">Active program</span>
              ) : (
                <button type="submit" className="btn btn-sm">
                  Set active
                </button>
              )}
            </form>
          </article>
        ))}

        <form action={addProgramAction} className="card" style={cardStyle}>
          <h3 className="label">Add program</h3>
          <div style={fieldsGrid}>
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" required />
            </label>
            <label className="field">
              <span>Description</span>
              <input className="input" name="description" />
            </label>
            <label className="field">
              <span>Rest day label</span>
              <input className="input" name="restDayLabel" placeholder="Rest" />
            </label>
          </div>
          <label className="field">
            <span>Rest day notes</span>
            <textarea className="textarea" name="restDayNotes" />
          </label>
          <div style={btnRow}>
            <button type="submit" className="btn btn-sm btn-primary">
              Add program
            </button>
          </div>
        </form>
      </section>

      {/* ================= 2 · DAYS, EXERCISES & RULES ================= */}
      <section style={sectionStyle} aria-labelledby="days-h">
        <h2 className="eyebrow" id="days-h">
          Days, exercises &amp; session rules
        </h2>

        {programsDetail.length === 0 ? <p className="muted">Add a program first.</p> : null}

        {programsDetail.map(({ program, days, rules }) => (
          <details key={program.id} className="card" style={{ padding: 16 }} open={program.isActive}>
            <summary
              style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
            >
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>
                {program.name}
              </span>
              {program.isActive ? <span className="badge">Active</span> : null}
              <span className="muted" style={{ fontSize: 14 }}>
                {days.length} day{days.length === 1 ? '' : 's'} · {rules.length} rule
                {rules.length === 1 ? '' : 's'}
              </span>
            </summary>

            <div style={{ display: 'grid', gap: 20, paddingTop: 16 }}>
              {/* ----- days ----- */}
              <div style={{ display: 'grid', gap: 14 }}>
                <h3 className="label">Days</h3>
                {days.length === 0 ? <p className="muted">No days yet.</p> : null}

                {days.map(({ day, items }) => (
                  <div
                    key={day.id}
                    style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}
                  >
                    <form action={updateProgramDayAction} style={{ display: 'grid', gap: 10 }}>
                      <input type="hidden" name="dayId" value={day.id} />
                      <div style={fieldsGrid}>
                        <label className="field">
                          <span>Weekday</span>
                          <WeekdaySelect name="weekday" defaultValue={day.weekday} />
                        </label>
                        <label className="field">
                          <span>Name</span>
                          <input className="input" name="name" defaultValue={day.name} required />
                        </label>
                        <label className="field">
                          <span>Focus</span>
                          <input className="input" name="focus" defaultValue={day.focus ?? ''} />
                        </label>
                        <label className="field">
                          <span>Sort</span>
                          <input className="input" name="sortOrder" type="number" defaultValue={day.sortOrder} />
                        </label>
                      </div>
                      <div style={btnRow}>
                        <button type="submit" className="btn btn-sm btn-dark">
                          Save day
                        </button>
                        <button type="submit" className="btn btn-sm btn-danger" formAction={deleteProgramDayAction}>
                          Delete day
                        </button>
                      </div>
                    </form>

                    {/* ----- that day's program exercises ----- */}
                    <div
                      style={{ display: 'grid', gap: 14, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}
                    >
                      <h4 className="label">
                        {day.name} · {DAY_NAMES[day.weekday] ?? `Day ${day.weekday}`} exercises
                      </h4>
                      {items.length === 0 ? <p className="muted">No exercises yet.</p> : null}

                      {items.map(({ pe }) => (
                        <form key={pe.id} action={updateProgramExerciseAction} style={{ display: 'grid', gap: 10 }}>
                          <input type="hidden" name="programExerciseId" value={pe.id} />
                          <div style={fieldsGrid}>
                            <label className="field" style={fullRow}>
                              <span>Exercise</span>
                              <select className="select" name="exerciseId" defaultValue={pe.exerciseId}>
                                <ExerciseOptions library={exerciseLibrary} />
                              </select>
                            </label>
                            <SchemeFields pe={pe} />
                          </div>
                          <div style={btnRow}>
                            <button type="submit" className="btn btn-sm btn-dark">
                              Save
                            </button>
                            <button
                              type="submit"
                              className="btn btn-sm btn-danger"
                              formAction={deleteProgramExerciseAction}
                            >
                              Delete
                            </button>
                          </div>
                        </form>
                      ))}

                      <form action={addProgramExerciseAction} style={{ display: 'grid', gap: 10 }}>
                        <input type="hidden" name="programDayId" value={day.id} />
                        <div style={fieldsGrid}>
                          <label className="field" style={fullRow}>
                            <span>Add exercise</span>
                            <select className="select" name="exerciseId" required defaultValue="">
                              <option value="" disabled>
                                Pick an exercise…
                              </option>
                              <ExerciseOptions library={exerciseLibrary} />
                            </select>
                          </label>
                          <SchemeFields />
                        </div>
                        <div style={btnRow}>
                          <button type="submit" className="btn btn-sm">
                            Add to day
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ))}

                <form
                  action={addProgramDayAction}
                  style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}
                >
                  <input type="hidden" name="programId" value={program.id} />
                  <h4 className="label">Add day</h4>
                  <div style={fieldsGrid}>
                    <label className="field">
                      <span>Weekday</span>
                      <WeekdaySelect name="weekday" defaultValue={0} />
                    </label>
                    <label className="field">
                      <span>Name</span>
                      <input className="input" name="name" placeholder="Push" required />
                    </label>
                    <label className="field">
                      <span>Focus</span>
                      <input className="input" name="focus" placeholder="chest, shoulders, triceps" />
                    </label>
                    <label className="field">
                      <span>Sort</span>
                      <input className="input" name="sortOrder" type="number" defaultValue={0} />
                    </label>
                  </div>
                  <div style={btnRow}>
                    <button type="submit" className="btn btn-sm">
                      Add day
                    </button>
                  </div>
                </form>
              </div>

              {/* ----- session rules ----- */}
              <div style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <h3 className="label">Every session rules</h3>
                {rules.length === 0 ? <p className="muted">No rules yet.</p> : null}

                {rules.map((rule) => (
                  <form key={rule.id} action={updateSessionRuleAction} style={{ display: 'grid', gap: 10 }}>
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <div style={fieldsGrid}>
                      <label className="field">
                        <span>Key</span>
                        <input className="input" name="key" defaultValue={rule.key} required />
                      </label>
                      <label className="field" style={fullRow}>
                        <span>Text</span>
                        <input className="input" name="text" defaultValue={rule.text} required />
                      </label>
                      <label className="field">
                        <span>Sort</span>
                        <input className="input" name="sortOrder" type="number" defaultValue={rule.sortOrder} />
                      </label>
                    </div>
                    <div style={btnRow}>
                      <button type="submit" className="btn btn-sm btn-dark">
                        Save
                      </button>
                      <button type="submit" className="btn btn-sm btn-danger" formAction={deleteSessionRuleAction}>
                        Delete
                      </button>
                    </div>
                  </form>
                ))}

                <form action={addSessionRuleAction} style={{ display: 'grid', gap: 10 }}>
                  <input type="hidden" name="programId" value={program.id} />
                  <div style={fieldsGrid}>
                    <label className="field">
                      <span>Key</span>
                      <input className="input" name="key" placeholder="Warm up" required />
                    </label>
                    <label className="field" style={fullRow}>
                      <span>Text</span>
                      <input className="input" name="text" placeholder="5 min easy on the bike…" required />
                    </label>
                    <label className="field">
                      <span>Sort</span>
                      <input className="input" name="sortOrder" type="number" defaultValue={0} />
                    </label>
                  </div>
                  <div style={btnRow}>
                    <button type="submit" className="btn btn-sm">
                      Add rule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </details>
        ))}
      </section>

      {/* ================= 3 · EXERCISE LIBRARY ================= */}
      <section style={sectionStyle} aria-labelledby="library-h">
        <h2 className="eyebrow" id="library-h">
          Exercise library
        </h2>

        {exerciseLibrary.map((exercise) => (
          <form
            key={exercise.id}
            action={updateExerciseAction}
            className="card"
            style={{ ...cardStyle, opacity: exercise.archived ? 0.65 : 1 }}
          >
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <div style={fieldsGrid}>
              <label className="field">
                <span>Name</span>
                <input className="input" name="name" defaultValue={exercise.name} required />
              </label>
              <label className="field">
                <span>Equipment</span>
                <input className="input" name="equipment" defaultValue={exercise.equipment ?? ''} />
              </label>
              <label className="field">
                <span>Main muscles</span>
                <input
                  className="input"
                  name="mainMuscles"
                  defaultValue={exercise.mainMuscles.join(', ')}
                  placeholder="Chest, Triceps"
                />
              </label>
              <label className="field">
                <span>Helping muscles</span>
                <input className="input" name="helpingMuscles" defaultValue={exercise.helpingMuscles.join(', ')} />
              </label>
              <label className="field">
                <span>View</span>
                <select className="select" name="view" defaultValue={exercise.view ?? ''}>
                  <option value="">—</option>
                  <option value="side">Side</option>
                  <option value="front">Front</option>
                  <option value="top">Top</option>
                </select>
              </label>
              <label className="field">
                <span>Sort</span>
                <input className="input" name="sortOrder" type="number" defaultValue={exercise.sortOrder} />
              </label>
            </div>
            <label className="field">
              <span>Cues (one per line)</span>
              <textarea className="textarea" name="cues" defaultValue={exercise.cues ?? ''} />
            </label>
            <div style={btnRow}>
              <label style={checkLabel}>
                <input type="checkbox" name="archived" style={checkboxStyle} defaultChecked={exercise.archived} />
                <span className="label">Archived</span>
              </label>
              <button type="submit" className="btn btn-sm btn-dark">
                Save
              </button>
              <label style={checkLabel}>
                <input type="checkbox" name="confirm" style={checkboxStyle} />
                <span className="label">Confirm delete</span>
              </label>
              <button type="submit" className="btn btn-sm btn-danger" formAction={deleteExerciseAction}>
                Delete
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              Deleting an exercise also erases its logged sets from every past workout — archive it
              instead to keep history.
            </p>
          </form>
        ))}

        <form action={addExerciseAction} className="card" style={cardStyle}>
          <h3 className="label">Add exercise</h3>
          <div style={fieldsGrid}>
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" required />
            </label>
            <label className="field">
              <span>Equipment</span>
              <input className="input" name="equipment" />
            </label>
            <label className="field">
              <span>Main muscles</span>
              <input className="input" name="mainMuscles" placeholder="Chest, Triceps" />
            </label>
            <label className="field">
              <span>Helping muscles</span>
              <input className="input" name="helpingMuscles" />
            </label>
            <label className="field">
              <span>View</span>
              <select className="select" name="view" defaultValue="">
                <option value="">—</option>
                <option value="side">Side</option>
                <option value="front">Front</option>
                <option value="top">Top</option>
              </select>
            </label>
            <label className="field">
              <span>Sort</span>
              <input className="input" name="sortOrder" type="number" defaultValue={0} />
            </label>
          </div>
          <label className="field">
            <span>Cues (one per line)</span>
            <textarea className="textarea" name="cues" />
          </label>
          <div style={btnRow}>
            <button type="submit" className="btn btn-sm btn-primary">
              Add exercise
            </button>
          </div>
        </form>

        <p className="caption">
          Figures are matched by exercise name — renaming an exercise may detach its figure.
        </p>
      </section>
    </div>
  );
}
