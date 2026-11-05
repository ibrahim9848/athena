# Care Plan + Gym Schedule Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Care plan (scalp + face routine) that runs on the supplements engine with its own `/care` pages, and strip workout logging while keeping the gym schedule.

**Architecture:** The supplements engine (slots → items → weekday rules → pure resolver → ticks, history, slot reminders, editor) becomes multi-plan through a `plan` column on slots, items, variants and notes plus a small registry (`src/lib/plans.ts`) for per-plan copy and paths; four shared page bodies render both `/supplements/*` and `/care/*`. Two engine additions serve both plans: `schedule_rules.starts_on` and `supplements.badge`. Workout logging code is deleted; schedule code and the workout tables stay.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript strict, better-sqlite3 + Drizzle, vitest, node-cron, hand-written service worker.

**Spec:** `docs/superpowers/specs/2026-11-05-care-plan-and-gym-schedule-design.md` — appendix A holds the Care seed data; the executor reads both documents.

## Global Constraints

- Node 18.17.1 locally, Next 14.2.x, Node 22 in Docker; no dependency upgrades or additions.
- Schema changes only via `src/db/ddl.mjs` (`SCHEMA_SQL` + `ADDED_COLUMNS`); new columns nullable or defaulted; `applySchema` stays idempotent and is also used by the CLI scripts.
- Never open `./data/app.db` from the host (the Docker container owns it). Tests set `DATABASE_PATH=':memory:'` or a temp file; the dev server uses `./data/dev.db`.
- Supplements copy, seed strings and the pills pages' rendering stay exactly as they are.
- Plan copy comes from the spec's "Plans" table and is pinned in Task 3; it is the only source of plan-specific strings.
- Before each commit: `npm test`, `npm run lint`, `npx tsc --noEmit` green; `npm run build` green at the end of Tasks 5, 6 and 8 (stop any dev server first — a build racing the dev server corrupts `.next`).
- Commits are local, on branch `care-plan`, with explicit `git add` of the task's files; nothing is pushed. Deploying and seeding the live container is the operator's rollout (spec § Rollout), outside this plan.

## Review Focus

1. An item that rotates **and** has a rule with `starts_on` after the rotation start must stay hidden until `starts_on` — Task 2, test `rotation and start date combine`.
2. Care amounts are prose ("4–5 presses per spot", "4 minutes", "two finger-lengths", "a few drops") and must draw one glyph, never four — Task 4, test `care steps with prose amounts draw one glyph`.
3. `seed.mjs --plan care` on a database with live supplements data must leave supplements rows, ticks and their reminders untouched, and remove only reminders pointing at the replaced care slots — Task 7, test `--plan care re-seeds care only`.
4. A phone holding queued `set`/`finish` ops from the old build must receive `ok: true` so its outbox clears — Task 6, test `acknowledges and drops legacy workout ops`.
5. Care history for days before any care tick exists must not render as failed days — Task 5, test `historyStart`.

---

### Task 1: Branch, baseline commit, schema

**Files:**
- Modify: `src/db/ddl.mjs` (SCHEMA_SQL, ADDED_COLUMNS, `applySchema`)
- Modify: `src/db/schema/supplements.ts`
- Test: `tests/schema.test.ts` (new)

**Interfaces:**
- Produces (SQLite): `supplements.plan TEXT NOT NULL DEFAULT 'supplements'`, `supplements.badge TEXT`, `meal_slots.plan` and `day_variants.plan` (same default), `schedule_rules.starts_on TEXT`, table `plan_settings (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL, notes TEXT, PRIMARY KEY (user_id, plan))`.
- Produces (Drizzle, `@/db/schema`): `supplements.plan`, `supplements.badge`, `mealSlots.plan`, `dayVariants.plan`, `scheduleRules.startsOn`, new `planSettings` table (`userId`, `plan`, `notes`); `supplements.form` enum gains `'drop' | 'tube' | 'bottle' | 'tool'`. `supplementSettings` stays exported until Task 3 removes its last use.

- [ ] **Step 1: Branch and commit the pre-existing owner-lock work so later commits stay clean**

```bash
git checkout -b care-plan
git add DECISIONS.md README.md scripts/backup.mjs scripts/create-user.mjs scripts/seed.mjs src/db/ddl.mjs src/db/index.ts tests/dbowner.test.ts
git commit -m "fix: refuse to open a database another host owns"
git add docs/superpowers/specs/2026-11-05-care-plan-and-gym-schedule-design.md docs/superpowers/plans/2026-11-05-care-plan-and-gym-schedule.md
git commit -m "docs: design and plan for the care plan and schedule-only gym"
```

- [ ] **Step 2: Baseline** — Run: `npm test` Expected: 56 passed.

- [ ] **Step 3: Write the failing test** `tests/schema.test.ts` (import `applySchema` the way `tests/dbowner.test.ts` does, with the `// @ts-ignore` line)

```ts
function columns(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; notnull: number; dflt_value: string | null }[];
}

describe('applySchema — plans', () => {
  it('adds plan, badge and starts_on with their defaults', () => {
    const db = new Database(':memory:');
    applySchema(db);
    expect(columns(db, 'supplements').find((c) => c.name === 'plan')).toMatchObject({ notnull: 1, dflt_value: "'supplements'" });
    expect(columns(db, 'supplements').some((c) => c.name === 'badge')).toBe(true);
    expect(columns(db, 'meal_slots').find((c) => c.name === 'plan')).toMatchObject({ notnull: 1, dflt_value: "'supplements'" });
    expect(columns(db, 'day_variants').some((c) => c.name === 'plan')).toBe(true);
    expect(columns(db, 'schedule_rules').some((c) => c.name === 'starts_on')).toBe(true);
    expect(columns(db, 'plan_settings').map((c) => c.name)).toEqual(['user_id', 'plan', 'notes']);
  });

  it('copies existing supplement notes into plan_settings exactly once', () => {
    const db = new Database(':memory:');
    applySchema(db);
    db.prepare("INSERT INTO users (id, username, password_hash, display_name, timezone, role, created_at) VALUES ('u1','u1','x','U1','Asia/Riyadh','owner','2026-01-01T00:00:00Z')").run();
    db.prepare("INSERT INTO supplement_settings (user_id, notes) VALUES ('u1', 'old notes')").run();
    applySchema(db);
    applySchema(db);
    expect(db.prepare('SELECT user_id, plan, notes FROM plan_settings').all()).toEqual([{ user_id: 'u1', plan: 'supplements', notes: 'old notes' }]);
  });
});
```

- [ ] **Step 4: Run it** — `npx vitest run tests/schema.test.ts` Expected: FAIL (no `plan` column).

- [ ] **Step 5: Implement in `src/db/ddl.mjs`** — add the new columns to the `CREATE TABLE` statements *and* to `ADDED_COLUMNS` (types `TEXT NOT NULL DEFAULT 'supplements'`, `TEXT`, `TEXT`); add the `plan_settings` table to `SCHEMA_SQL`; after the ALTER loop in `applySchema` run `INSERT OR IGNORE INTO plan_settings (user_id, plan, notes) SELECT user_id, 'supplements', notes FROM supplement_settings`. Mirror the columns in `src/db/schema/supplements.ts` and add `planSettings` with a composite primary key.

- [ ] **Step 6: Run** — `npm test` Expected: 58 passed. `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit** — `git add src/db/ddl.mjs src/db/schema/supplements.ts tests/schema.test.ts && git commit -m "feat(db): plan column, rule start dates, item badges, per-plan notes"`

---

### Task 2: Resolver — rule start dates and explicit badges

**Files:**
- Modify: `src/lib/plan.ts`
- Test: `tests/plan.test.ts`

**Interfaces:**
- Produces: `PlanRule.startsOn?: string | null`; `PlanSupplement.badge?: string | null`; `PlanSupplement.form` union gains `'drop' | 'tube' | 'bottle' | 'tool'`; `ResolvedDay.dayLabel` is the badge text when the plan uses badges.
- The test file's `rule()` helper gets `startsOn?: string | null` in its `opts`; badges are set by spreading: `{ ...sup(...), badge: 'Wash night' }`.

- [ ] **Step 1: Write the failing tests** (constants `SUNDAY`…`FRIDAY`, `ALL_DAYS` and helpers already exist in the file; 2026-03-03 is a Tuesday, 2026-03-07 a Saturday)

```ts
describe('rule start dates', () => {
  const am = slot('s1', 'am', 'Morning', 0);
  const ada = sup('x', 'Adapalene', 'other', 'pea-sized', 0);
  const base = { supplements: [ada], slots: [am], rules: [rule('r1', 'x', 's1', ALL_DAYS, { startsOn: THURSDAY })], variants: [] as PlanVariant[] };
  const log = (undone: boolean): PlanLog => ({ ruleId: 'r1', date: MONDAY, takenAt: `${MONDAY}T08:00:00Z`, undone });

  it('hides the rule before its start date', () => {
    expect(resolveDay({ ...base, date: MONDAY, logs: [] }).slots).toEqual([]);
  });
  it('shows it on and after the start date', () => {
    expect(resolveDay({ ...base, date: THURSDAY, logs: [] }).progress).toEqual({ taken: 0, total: 1 });
    expect(resolveDay({ ...base, date: FRIDAY, logs: [] }).progress).toEqual({ taken: 0, total: 1 });
  });
  it('still shows a tick logged before the start date, but not an undone one', () => {
    expect(resolveDay({ ...base, date: MONDAY, logs: [log(false)] }).progress).toEqual({ taken: 1, total: 1 });
    expect(resolveDay({ ...base, date: MONDAY, logs: [log(true)] }).slots).toEqual([]);
  });
  it('rotation and start date combine', () => {
    const roller = { ...sup('roll', 'Face roller', 'tool', 'roll', 0), everyNDays: 2, rotationStart: SUNDAY };
    const input = { supplements: [roller], slots: [am], rules: [rule('rr', 'roll', 's1', ALL_DAYS, { startsOn: THURSDAY })], variants: [], logs: [] };
    expect(resolveDay({ ...input, date: '2026-03-03' }).slots).toEqual([]); // Tuesday: rotation day, not started
    expect(resolveDay({ ...input, date: THURSDAY }).progress.total).toBe(1); // rotation day, started
    expect(resolveDay({ ...input, date: FRIDAY }).slots).toEqual([]); // started, not a rotation day
  });
});

describe('explicit day badges', () => {
  const am = slot('s1', 'am', 'Morning', 0);
  const plain = sup('a', 'Minoxidil', 'drop', 'foam', 0); // partial week, no badge
  const wash = { ...sup('b', 'Ketoconazole shampoo', 'bottle', '3–5 min', 1), badge: 'Wash night' };
  const roller = { ...sup('c', 'Face roller', 'tool', 'roll', 2), badge: 'Roller night' };
  const stamp = { ...sup('d', 'Derma stamp', 'tool', 'stamp', 3), badge: 'Stamp night' };
  const input = {
    supplements: [plain, wash, roller, stamp], slots: [am], variants: [], logs: [],
    rules: [rule('ra', 'a', 's1', [1, 3, 5]), rule('rb', 'b', 's1', [1, 3, 5]), rule('rc', 'c', 's1', [6]), rule('rd', 'd', 's1', [6])],
  };
  it('uses the first scheduled badge by item order and ignores unbadged partial-week items', () => {
    const monday = resolveDay({ ...input, date: MONDAY });
    expect(monday.dayLabel).toBe('Wash night');
    expect(monday.dayLabelSupplement?.id).toBe('b');
  });
  it('lower item order wins when two badges are scheduled', () => {
    expect(resolveDay({ ...input, date: '2026-03-07' }).dayLabel).toBe('Roller night');
  });
  it('has no label on a day without badge items', () => {
    expect(resolveDay({ ...input, date: SUNDAY }).dayLabel).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/plan.test.ts` Expected: FAIL (type error on `startsOn`/`badge`, then wrong labels).

- [ ] **Step 3: Implement in `resolveDay`** — in the `active` filter, right after the weekday check: a rule with `startsOn > input.date` is kept only when `latest.get(rule.id)` exists and is not undone (same shape as the rotation pre-start branch). Day label: `const usesBadges = input.supplements.some((s) => !!s.badge)`; if so, `dayLabelSupplement` is the first scheduled supplement (by `sortOrder`, then name) whose `badge` is set and `dayLabel` is that badge; otherwise the existing derivation and `${name} day`. Extend the `form` union.

- [ ] **Step 4: Run** — `npm test` Expected: all pass (old "Multivitamin day" tests unchanged).

- [ ] **Step 5: Commit** — `git add src/lib/plan.ts tests/plan.test.ts && git commit -m "feat(plan): rule start dates and explicit day badges"`

---

### Task 3: Plan registry and plan-scoped server queries

**Files:**
- Create: `src/lib/plans.ts`
- Modify: `src/server/supplements.ts`, `src/server/scheduler.ts`, `src/app/(app)/page.tsx`, `src/app/(app)/supplements/page.tsx`, `src/app/(app)/supplements/facts/page.tsx`, `src/app/(app)/supplements/history/page.tsx`, `src/app/(app)/supplements/edit/page.tsx`, `src/app/(app)/supplements/edit/actions.ts`, `src/app/(app)/settings/reminders/page.tsx`, `src/db/schema/supplements.ts` (drop `supplementSettings`), `tests/access.test.ts`
- Test: `tests/plans.test.ts` (new)

**Interfaces:**
- Produces `src/lib/plans.ts`:

```ts
export type PlanKey = 'supplements' | 'care';
export const PLAN_KEYS: readonly PlanKey[] = ['supplements', 'care'];
export function isPlanKey(v: unknown): v is PlanKey;
export type PlanCopy = {
  key: PlanKey; path: string; name: string; tabLabel: string; title: string; editTitle: string;
  itemNoun: [string, string]; tickWord: string; factsTitle: string; factsLink: string;
  doseLabel: string; disclaimer: string;
};
export const PLANS: Record<PlanKey, PlanCopy>;
```

| field | supplements | care |
| --- | --- | --- |
| path | `/supplements` | `/care` |
| name | Supplements | Care |
| tabLabel | Pills | Care |
| title | Weekly Supplement Plan | Weekly Care Routine |
| editTitle | Edit supplement plan | Edit care routine |
| itemNoun | ['supplement', 'supplements'] | ['step', 'steps'] |
| tickWord | taken | done |
| factsTitle (page heading) | Supplement Facts | Products & rules |
| factsLink (button) | Supplement facts | Products & rules |
| doseLabel | Dose | Amount / how |
| disclaimer | General information, not medical advice — check your plan with a pharmacist. | General information, not medical advice — check your routine with a dermatologist. |

- Produces `src/server/supplements.ts` signatures (rules are the plan's supplements' rules; all other behaviour unchanged):

```ts
getPlanData(userId: string, plan: PlanKey)
resolveDayForUser(userId: string, date: string, plan: PlanKey): ResolvedDay
resolveWeekForUser(userId: string, date: string, plan: PlanKey): ResolvedDay[]
resolveTodayForUser(userId: string, timezone: string, plan: PlanKey): ResolvedDay
historyRange(userId: string, fromDate: string, toDate: string, plan: PlanKey)
getSupplementNotes(userId: string, plan: PlanKey): string | null      // plan_settings
setSupplementNotes(userId: string, plan: PlanKey, notes: string): void // upsert on (userId, plan)
supplementsWithCoverage(userId: string, plan: PlanKey)
getSlotsForUser(userId: string, plan?: PlanKey)                        // all plans when omitted
```

- [ ] **Step 1: Write the failing test** `tests/plans.test.ts`, following `tests/access.test.ts` (env set at the top, dynamic imports, one user `u1`):

```ts
beforeAll(async () => {
  // insert user u1; slots s1 {plan:'supplements', key:'breakfast'} and s2 {plan:'care', key:'am_face'};
  // supplements a (plan 'supplements') and b (plan 'care'); rules r1 (a, s1, ALL days) and r2 (b, s2, ALL days)
});
it('getPlanData returns only the rows of the requested plan', () => {
  const s = sup.getPlanData('u1', 'supplements');
  expect(s.slots.map((x) => x.id)).toEqual(['s1']);
  expect(s.supplements.map((x) => x.id)).toEqual(['a']);
  expect(s.rules.map((x) => x.id)).toEqual(['r1']);
  const c = sup.getPlanData('u1', 'care');
  expect([c.slots[0].id, c.supplements[0].id, c.rules[0].id]).toEqual(['s2', 'b', 'r2']);
});
it('getSlotsForUser lists every plan when no plan is given', () => {
  expect(sup.getSlotsForUser('u1').map((x) => x.plan).sort()).toEqual(['care', 'supplements']);
  expect(sup.getSlotsForUser('u1', 'care').map((x) => x.id)).toEqual(['s2']);
});
it('notes are stored per plan', () => {
  sup.setSupplementNotes('u1', 'care', 'rules');
  expect(sup.getSupplementNotes('u1', 'care')).toBe('rules');
  expect(sup.getSupplementNotes('u1', 'supplements')).toBeNull();
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/plans.test.ts` Expected: FAIL (signatures).

- [ ] **Step 3: Implement** `src/lib/plans.ts` with the table above; change the server signatures; filter `supplements`, `mealSlots`, `dayVariants` by `plan`, rules by `inArray(scheduleRules.supplementId, ids)` (empty array → no query, `[]`); notes via `planSettings`. Remove `supplementSettings` from the Drizzle schema (the SQLite table remains).

- [ ] **Step 4: Update every caller to compile**, passing `'supplements'` for now: the four supplements pages, `src/app/(app)/page.tsx`, `saveNotesAction` and `setAlternatingAction` in `edit/actions.ts`, `tests/access.test.ts` (`getPlanData(B, 'supplements')`, `resolveDayForUser(…, 'supplements')`). Scheduler: for a `slot` reminder, `getSlotForUser(user.id, reminder.refId)` → skip when missing → `resolveDayForUser(user.id, localDate, slot.plan as PlanKey)`, payload `url: PLANS[plan].path`. Reminders page: slot option names become `` `${PLANS[slot.plan as PlanKey].tabLabel} · ${slot.name}` ``.

- [ ] **Step 5: Run** — `npm test`, `npx tsc --noEmit`, `npm run lint` Expected: all green.

- [ ] **Step 6: Commit** — `git add -A src/lib/plans.ts src/server src/app src/db/schema tests && git commit -m "feat(plan): plan registry and plan-scoped queries"`

---

### Task 4: Editor fields (plan, badge, starts on), care glyph forms

**Files:**
- Modify: `src/app/(app)/supplements/edit/actions.ts`, `src/app/(app)/supplements/edit/page.tsx`, `src/components/PillGlyph.tsx`, `src/app/globals.css`
- Test: `tests/plan.test.ts`

**Interfaces:**
- Form fields consumed by the actions: `plan` (hidden, on every *create* form and the notes form; ignored on updates), `badge` (item card), `startsOn` (rule card and add-rule form, `type="date"`). The editor page still hardcodes `plan="supplements"`; Task 5 parameterises it.

- [ ] **Step 1: Add the test** (documents the glyph rule the Care amounts rely on)

```ts
it('care steps with prose amounts draw one glyph', () => {
  for (const dose of ['4–5 presses per spot on thinning areas', '4 minutes', 'two finger-lengths, face and neck', 'a few drops']) {
    expect(doseCount(dose)).toBe(1);
  }
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/plan.test.ts` Expected: PASS already (the rule exists; the test pins it).

- [ ] **Step 3: Actions** — `SUPPLEMENT_FORMS` gains `'drop', 'tube', 'bottle', 'tool'`. `upsertSupplementAction`: `badge: optStr(fd, 'badge')`; on insert `plan = isPlanKey(fd.get('plan')) ? fd.get('plan') : 'supplements'`. Same `plan` handling on insert in `upsertSlotAction` and `upsertVariantAction`. `upsertRuleAction`: `startsOn` validated like `rotationStart` in `parseRotation` (regex `^\d{4}-\d{2}-\d{2}$` and `addDaysYmd(v, 0) === v`, else `null`), and throw `Error('Supplement and slot belong to different plans')` when `supplement.plan !== slot.plan`. `setAlternatingAction` resolves with the plan of rule A's supplement and refuses pairs across plans. `saveNotesAction` reads `plan` the same way. `revalidateSupplementPages()` revalidates, for every key in `PLAN_KEYS`, `path`, `${path}/edit`, `${path}/facts`, `${path}/history`, plus `/`.

- [ ] **Step 4: Editor page** — `SupplementCard`: text input `name="badge"` labelled "Badge" (placeholder `Wash night`) next to the rotation fields; `SupplementFormSelect`: options Drop, Tube, Bottle, Tool; `RuleCard` and `AddRuleForm`: `<input type="date" name="startsOn">` labelled "Starts on"; hidden `plan` on the add-supplement, add-slot, add-variant and notes forms (value `supplements` for now); the dose label text comes from `PLANS.supplements.doseLabel`.

- [ ] **Step 5: Glyphs** — `PillGlyph.FORM_CLASS` adds `drop: 'drop', tube: 'tube', bottle: 'bottle', tool: 'tool'`; `globals.css` adds `.pill.drop`, `.pill.tube`, `.pill.bottle`, `.pill.tool` next to the existing `.pill.*` rules: same box as `.pill.round`, CSS-only (borders, radii, `::before/::after`), coloured by `--c`, readable at the day-box size.

- [ ] **Step 6: Run** — `npm test`, `npx tsc --noEmit`, `npm run lint` Expected: green.

- [ ] **Step 7: Commit** — `git add "src/app/(app)/supplements/edit" src/components/PillGlyph.tsx src/app/globals.css tests/plan.test.ts && git commit -m "feat(editor): plan-aware forms, badge and start-date fields, care glyphs"`

---

### Task 5: Shared page bodies, `/care` routes, nav, home

**Files:**
- Create: `src/components/plan-pages/PlanPage.tsx`, `src/components/plan-pages/PlanFacts.tsx`, `src/components/plan-pages/PlanHistory.tsx`, `src/components/plan-pages/PlanEditor.tsx` (the four supplements page bodies moved here, each `async function X({ plan }: { plan: PlanKey })`)
- Create: `src/app/(app)/care/page.tsx`, `src/app/(app)/care/facts/page.tsx`, `src/app/(app)/care/history/page.tsx`, `src/app/(app)/care/edit/page.tsx`
- Modify: the four `src/app/(app)/supplements/**/page.tsx` (become wrappers), `src/components/supplements/SupplementsView.tsx`, `src/components/AppNav.tsx`, `src/app/(app)/page.tsx`, `src/lib/dates.ts`, `src/server/supplements.ts`
- Test: `tests/plan.test.ts` (`historyStart`), `tests/plans.test.ts` (`firstLogDate`)

**Interfaces:**
- Consumes: `PLANS`, `PlanKey`, the Task 3 server signatures.
- Produces: `SupplementsView` prop `plan: PlanKey` (required); `src/lib/dates.ts`: `historyStart(todayYmd: string, firstLogYmd: string | null, span: number): string` — `todayYmd` when `firstLogYmd` is null, else the later of `addDaysYmd(todayYmd, -(span - 1))` and `firstLogYmd`; `src/server/supplements.ts`: `firstLogDate(userId: string, plan: PlanKey): string | null` (earliest `supplement_logs.date` among the plan's rules).
- Wrapper shape (every route): `export const dynamic = 'force-dynamic'; export const metadata = { title }; export default function Page() { return <PlanPage plan="care" />; }` — metadata titles: supplements as today; care: Care, Products & rules, Care history, Edit care routine.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/plan.test.ts
describe('historyStart', () => {
  it('starts today when the plan has no ticks yet', () => expect(historyStart('2026-11-20', null, 56)).toBe('2026-11-20'));
  it('starts at the first tick when it is inside the window', () => expect(historyStart('2026-11-20', '2026-11-08', 56)).toBe('2026-11-08'));
  it('keeps the full window when ticks go back further', () => expect(historyStart('2026-11-20', '2026-01-01', 56)).toBe('2026-09-26'));
});
// tests/plans.test.ts
it('firstLogDate is per plan', () => {
  sup.setTaken('u1', 'r2', '2026-11-09', true);
  expect(sup.firstLogDate('u1', 'care')).toBe('2026-11-09');
  expect(sup.firstLogDate('u1', 'supplements')).toBeNull();
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/plan.test.ts tests/plans.test.ts` Expected: FAIL (not exported).

- [ ] **Step 3: Implement** `historyStart` and `firstLogDate`; move the four page bodies into `plan-pages/` taking `plan`, replacing every `'supplements'` literal from Task 3 with `plan`/`PLANS[plan]`: title, lede (supplements lede verbatim as today; care: `` `${countWord(n)} ${n === 1 ? 'step' : 'steps'} for your face and scalp, morning and evening. Tap a day to see the routine, and tick off today's steps as you do them.` `` and, when empty, `Nothing scheduled yet. Add steps and rules in the plan editor, then tick them off here.`), buttons (`factsLink`, History, Edit plan → `${path}/…`), disclaimer, facts heading `factsTitle`, editor `editTitle`/`doseLabel`, hidden `plan` fields. `PlanHistory` resolves from `historyStart(today, firstLogDate(user.id, plan), 56)`. Create the care wrappers; turn the supplements pages into wrappers.

- [ ] **Step 4: `SupplementsView`** — add `plan`; `countText` uses `PLANS[plan].tickWord`; in `mode="today"` the eyebrow is `<Link href={copy.path}>{copy.name}</Link>` (the date stays in the `h2`).

- [ ] **Step 5: Home and nav** — `page.tsx`: after the training-day card, `SupplementsView` for `'supplements'` (as now) then for `'care'` with `resolveWeekForUser(user.id, ymd, 'care')` and `gymWeekdays={[]}`. `AppNav`: insert `{ href: '/care', label: 'Care', match: (p) => p.startsWith('/care') }` before Settings with icon `<path d="M12 3.5c3.2 4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 2.3-6 5.5-10Z" />`.

- [ ] **Step 6: Run** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` Expected: green; the build lists `/care`, `/care/facts`, `/care/history`, `/care/edit`.

- [ ] **Step 7: Commit** — `git add -A src tests && git commit -m "feat(care): care routes on the shared plan pages, Care tab, two panels on Today"`

---

### Task 6: Gym — schedule only

**Files:**
- Delete: `src/app/(app)/workouts/[workoutId]/page.tsx`, `src/app/(app)/workouts/history/page.tsx`, `src/app/(app)/workouts/progress/page.tsx`, `src/app/(app)/workouts/day/[programDayId]/actions.ts`, `src/components/workout-log/LogScreen.tsx`, `src/components/workout-log/RestTimer.tsx`, `src/components/workout-log/types.ts`, `src/components/ProgressChart.tsx`, `src/components/workouts-edit/ExercisePicker.tsx`
- Modify: `src/server/workouts.ts` (remove `lastCompletedWorkout`, `getOpenWorkout`, `startWorkout`, `getWorkoutForUser`, `updateWorkoutSet`, `finishWorkout`, `autoFinishStaleWorkouts`, `listWorkoutHistory`, `exerciseProgress` and imports only they used), `src/lib/workout.ts` (remove `epley1Rm`), `src/app/api/sync/route.ts`, `src/lib/outbox.ts` (`SyncOp` = the `tick` variant only), `src/server/scheduler.ts` (drop the `autoFinishStaleWorkouts` call and import), `src/app/(app)/workouts/page.tsx` (button text `Open {day.name}`), `src/app/(app)/workouts/day/[programDayId]/page.tsx` (remove the Start/Continue block and the `getOpenWorkout`/`startWorkoutAction` imports), `public/sw.js` (`VERSION = 'athena-v2'`, `PAGE_CACHE = 'athena-pages-v2'`), `tests/workout.test.ts` (drop the `epley1Rm` describe and import), `tests/access.test.ts` (drop the `workout data isolation` describe and `wk`)
- Test: `tests/sync.test.ts` (new)

**Interfaces:**
- Produces: `POST /api/sync` applies `tick` ops and counts any other `kind` as applied without error (legacy `set`/`finish` from installed phones).

- [ ] **Step 1: Write the failing test** `tests/sync.test.ts`

```ts
process.env.DATABASE_PATH = ':memory:';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ id: 'u1', username: 'u1', displayName: 'U1', timezone: 'Asia/Riyadh', role: 'owner' }),
  slideSessionCookie: () => {},
}));
const post = async (ops: unknown[]) => {
  const { POST } = await import('@/app/api/sync/route');
  return (await POST(new Request('http://localhost/api/sync', { method: 'POST', body: JSON.stringify({ ops }) }))).json();
};
describe('POST /api/sync', () => {
  it('acknowledges and drops legacy workout ops', async () => {
    expect(await post([{ kind: 'set', setId: 'x', reps: 5 }, { kind: 'finish', workoutId: 'y' }])).toEqual({ ok: true, applied: 2, errors: [] });
  });
  it('still reports a tick with a bad date', async () => {
    const res = await post([{ kind: 'tick', ruleId: 'nope', date: 'yesterday', taken: true }]);
    expect(res.ok).toBe(false);
    expect(res.applied).toBe(0);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/sync.test.ts` Expected: first test FAILS (route imports `finishWorkout`; legacy ops hit the removed branches or throw).

- [ ] **Step 3: Delete and trim** the files above. Route loop body: `if (op.kind === 'tick') { …as today… }` and nothing else (a comment says other kinds are the old build's workout ops, dropped so stale outboxes clear).

- [ ] **Step 4: Sweep** — Run: `grep -rnE "workouts/history|workouts/progress|/workouts/\\$\\{|startWorkout|getOpenWorkout|epley1Rm|workout-log|ProgressChart|ExercisePicker" src public` Expected: no output.

- [ ] **Step 5: Run** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` Expected: green; the build's route list has no `/workouts/[workoutId]`, `/workouts/history`, `/workouts/progress`.

- [ ] **Step 6: Commit** — `git add -A src public tests && git commit -m "feat(workouts): schedule only — remove workout logging, history and progress"`

---

### Task 7: Seed — care block, `--plan`, per-plan wipe

**Files:**
- Modify: `scripts/seed-data.mjs`, `scripts/seed.mjs`
- Test: `tests/seed.test.ts` (new)

**Interfaces:**
- Produces `scripts/seed-data.mjs`: `export const CARE_START = '2026-11-08'`; `buildSeed()` additionally returns `care: { slots, supplements, scheduleRules, notes }` with the exact rows of spec appendix A. Slot rows add `defaultTime` (`'07:30'` morning, `'21:30'` evening). Item rows: `{ key, name, form, defaultDose, color, sortOrder, badge, why, watchFor, everyNDays?, rotationStart? }` (roller: `everyNDays: 14, rotationStart: '2026-12-12'`). Rule rows add `startsOn` (`'2026-11-29'` on the Tue/Thu adapalene rule, else `null`). "Every day with a Sunday-only note" is two rules (`[1..6]` and `[0]`), per the appendix.
- Produces `scripts/seed.mjs`: option `--plan <supplements|care|all>` (also `--plan=…`), default `all`; USAGE updated; one `insertPlan(planKey, block)` used for both plans; INSERTs carry `plan`, `badge`, `starts_on`, `default_time`; rotation start = `s.rotationStart ?? (s.everyNDays ? plusDays(today, s.rotationOffset ?? 0) : null)`; notes go to `plan_settings`.
- Wipe for a single plan `P` (in this order, all scoped to the user):

```sql
DELETE FROM supplement_logs WHERE user_id = ? AND rule_id IN (SELECT r.id FROM schedule_rules r JOIN supplements s ON s.id = r.supplement_id WHERE s.user_id = ? AND s.plan = ?);
DELETE FROM schedule_rules WHERE user_id = ? AND supplement_id IN (SELECT id FROM supplements WHERE user_id = ? AND plan = ?);
DELETE FROM reminder_sends WHERE reminder_id IN (SELECT id FROM reminders WHERE user_id = ? AND kind = 'slot' AND ref_id IN (SELECT id FROM meal_slots WHERE user_id = ? AND plan = ?));
DELETE FROM reminders WHERE user_id = ? AND kind = 'slot' AND ref_id IN (SELECT id FROM meal_slots WHERE user_id = ? AND plan = ?);
DELETE FROM day_variants WHERE user_id = ? AND plan = ?;
DELETE FROM meal_slots WHERE user_id = ? AND plan = ?;
DELETE FROM supplements WHERE user_id = ? AND plan = ?;
DELETE FROM plan_settings WHERE user_id = ? AND plan = ?;
```

  `all` keeps today's full wipe (plus `plan_settings`) and seeds both plans and the program; a single plan seeds only that plan and never touches `programs`/`exercises`/`workouts`.

- [ ] **Step 1: Write the failing test** `tests/seed.test.ts` — runs the real scripts with `execFileSync(process.execPath, ['scripts/<script>', …], { env: { ...process.env, DATABASE_PATH: tmp } })` against a `mkdtemp` database (timeout 60 s on the hook):

```ts
beforeAll(() => {
  run('create-user.mjs', '--username', 'seedy', '--password', 'pw-for-tests', '--role', 'owner');
  run('seed.mjs', '--user', 'seedy');
}, 60_000);

it('seeds both plans', () => {
  const db = new Database(dbPath, { readonly: true });
  const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  expect(count("SELECT count(*) n FROM meal_slots WHERE plan = 'care'")).toBe(4);
  expect(count("SELECT count(*) n FROM supplements WHERE plan = 'care'")).toBe(12);
  expect(count("SELECT count(*) n FROM plan_settings")).toBe(2);
  expect(db.prepare("SELECT starts_on FROM schedule_rules WHERE starts_on IS NOT NULL").all()).toEqual([{ starts_on: '2026-11-29' }]);
  expect(db.prepare("SELECT every_n_days, rotation_start FROM supplements WHERE name LIKE 'Face roller%'").get()).toEqual({ every_n_days: 14, rotation_start: '2026-12-12' });
  expect(count("SELECT count(*) n FROM supplements WHERE badge IS NOT NULL")).toBe(3);
});

it('--plan care re-seeds care only', () => {
  // before: record supplements ids; insert a supplement_logs row for a supplements rule; insert two slot reminders
  // (one for a supplements slot, one for a care slot) and a reminder_sends row for the care one
  run('seed.mjs', '--user', 'seedy', '--plan', 'care');
  // after: supplements/meal_slots/schedule_rules ids for plan 'supplements' unchanged; the log row still exists;
  // the supplements-slot reminder still exists; the care-slot reminder and its reminder_sends are gone;
  // care rows exist again with 4 slots / 12 items; program_days count unchanged
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/seed.test.ts` Expected: FAIL (`--plan` rejected; no care rows).

- [ ] **Step 3: Implement** the data block (transcribe appendix A exactly, including notes, `why`, `watch_for`, colours) and the script changes above.

- [ ] **Step 4: Run** — `npm test` Expected: green. Then on a scratch copy: `DATABASE_PATH=./data/scratch.db node scripts/create-user.mjs --username t --password t-pass-123 && DATABASE_PATH=./data/scratch.db node scripts/seed.mjs --user t --plan all` Expected: the counts table prints both plans; delete `./data/scratch.db*` afterwards.

- [ ] **Step 5: Commit** — `git add scripts/seed-data.mjs scripts/seed.mjs tests/seed.test.ts && git commit -m "feat(seed): care routine block and per-plan seeding"`

---

### Task 8: Run it, check it, document it

**Files:**
- Create: `scripts/dev-local.mjs`
- Modify: `package.json` (`"dev:local": "node scripts/dev-local.mjs"`), `.claude/launch.json` (add `{ "name": "athena-dev-local", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev:local"], "port": 3000 }`), `README.md`, `DECISIONS.md`

**Interfaces:**
- `scripts/dev-local.mjs`: sets `DATABASE_PATH` to `./data/dev.db` unless already set, then spawns `process.execPath` with `createRequire(import.meta.url).resolve('next/dist/bin/next')` and `dev`, `stdio: 'inherit'`, exiting with the child's code. (No `npx`, so it works on Windows and Linux alike.)

- [ ] **Step 1: Full check** — `npm test`, `npm run lint`, `npm run build` Expected: green.

- [ ] **Step 2: Dev database** — `DATABASE_PATH=./data/dev.db node scripts/create-user.mjs --username ibrahim --role owner --password <the password in dev-credentials.txt>` then `DATABASE_PATH=./data/dev.db node scripts/seed.mjs --user ibrahim` (skip create-user if `./data/dev.db` already has the user).

- [ ] **Step 3: Start `athena-dev-local` via the browser preview** and sign in. Check, fixing anything that fails before moving on:
  - `/supplements` looks exactly as before (pill box, legend, today's ticks, badges, buttons).
  - `/care`: seven-day box with care glyphs and legend; today's four slots (Morning · Face, Morning · Scalp, Evening · Scalp, Evening · Face) with the right steps for the weekday; tick a step → progress updates, survives reload; Sunday shows no Morning · Scalp; Monday shows "Wash night", Saturday "Stamp night".
  - `/care/facts` shows the 12 products with why/watch text and the rules notes; `/care/history` shows no failed days before today; `/care/edit` shows Badge and Starts on fields and saves them.
  - `/` shows the training-day card (if a training day), the Supplements panel, then the Care panel; nav has five tabs with Care active on `/care`.
  - `/workouts` buttons read "Open {day}"; a day page has no Start button; `/workouts/history` and `/workouts/progress` return 404.
  - Settings → Reminders lists "Pills · …" and "Care · …" slots.
  - In the browser console: `fetch('/api/sync', { method: 'POST', body: JSON.stringify({ ops: [{ kind: 'finish', workoutId: 'x' }] }) }).then((r) => r.json())` → `{ ok: true, applied: 1, errors: [] }`.
  Stop the dev server when done.

- [ ] **Step 4: Docs** — README: feature bullets (gym = day sheets and cues, no log; add the care routine), "Run locally" uses `npm run dev:local` and explains why, seed section documents `--plan` and the live-container rollout order from the spec, changelog line. DECISIONS.md: four entries — plans on one engine (why not a copy), rule start dates, explicit badges over the derived label, gym schedule-only with data kept, per-plan seeding.

- [ ] **Step 5: Commit** — `git add scripts/dev-local.mjs package.json .claude/launch.json README.md DECISIONS.md && git commit -m "docs: care routine, schedule-only gym, dev:local and per-plan seeding"`

---

## After the plan (operator, with the owner's go-ahead)

Spec § Rollout: back up inside the container, `docker compose build && docker compose up -d`, `docker compose exec athena node scripts/seed.mjs --user ibrahim --plan care`, then check `/supplements`, `/care`, a tick, the five tabs and the gone routes on the Tailscale URL. Merge `care-plan` into `main` and push only when the owner says.
