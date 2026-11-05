# Care plan + gym schedule only — design

Date: 2026-11-05. Status: draft for owner approval.

## Intent

Ibrahim has started a scalp routine (minoxidil, rosemary oil, ketoconazole
shampoo, weekly derma stamp) and a face routine (cleanser, niacinamide,
sunscreen, adapalene, fortnightly face roller). He wants to tick these off
in Athena every day the way he ticks off supplements. At the same time the
gym part of the app should become a reference schedule only: the Thu–Sat
plan stays, but nothing is logged any more.

Two changes, one release:

1. **Care**: a new section, built on the supplements engine, that looks and
   works like the supplements page.
2. **Gym schedule only**: remove workout logging (start workout, set
   logging, rest timer, history, progress charts); keep the program
   overview, week strip, day sheets, exercise cards with figures, session
   rules and the program editor.

## Goals

- A `/care` page that mirrors `/supplements`: seven-day box with glyphs and
  legend, selected-day plan with slots and items, tick-offs with the
  progress bar on today, day badges, and the same History / Edit plan /
  facts-style pages.
- The scalp and face routine from Ibrahim's two sheets (appendix A) seeded
  as the Care plan, with **week 1 starting Sunday 2026-11-08**.
- Everything the supplements engine already does works for Care unchanged:
  weekday rules, day variants, dose overrides and notes, every-N-days
  rotation, ticks through `/api/sync` (online and offline outbox),
  history, per-slot push reminders, the plan editor.
- Two small engine additions, available to both plans: a **start date on a
  rule** ("from week 4") and an **explicit day badge** on an item ("Wash
  night").
- Supplements keep working exactly as today, on the live database, with no
  data loss. Existing rows are labelled as the `supplements` plan by a
  default value; nothing is moved.
- Gym pages lose every logging control and route; the schedule pages are
  untouched otherwise. Workout tables and the two practice workouts stay
  in the database.

## Non-goals

- No redesign. Care reuses the supplements page layout, CSS classes and
  components; the owner explicitly chose this over mockups.
- No new reminder kinds. The monthly progress photo ("1st of each month")
  is written into the Care notes, not scheduled.
- No modelling of every exception on the sheets. Where the engine cannot
  express a rule (e.g. "skip niacinamide the morning after rolling"), the
  text goes into the rule's note (appendix A says which).
- No deletion of workout data or tables; no migration that rewrites
  supplement rows.
- Not upgrading Next.js, not changing the sync protocol beyond dropping the
  workout ops.

## Anti-goals (would make this a failure even if it "works")

- Breaking or visually changing the pills page, or losing a single existing
  tick. The live DB is used every day.
- Care steps leaking into the supplements pill box, facts label or day
  badge, or the Friday two-meal variant applying to Care.
- A seed step that wipes the supplements plan when loading Care.
- Phones with queued offline workout ops failing to sync after the update.

## Constraints

- Next 14.2 / React 18 / TypeScript strict; Node 18.17 locally, Node 22 in
  Docker. SQLite via better-sqlite3 + Drizzle; schema is idempotent DDL in
  `src/db/ddl.mjs` (`CREATE TABLE IF NOT EXISTS` + `ADDED_COLUMNS` ALTERs),
  shared by the CLI scripts — new columns must be nullable or have a
  default, new tables go in `SCHEMA_SQL`.
- Tests: vitest (`npm test`), currently 56 passing across
  `tests/{plan,workout,access,dbowner}.test.ts`. `npm run lint` and
  `npm run build` must pass.
- One host per database file (owner lock): develop against
  `DATABASE_PATH=./data/dev.db`; never run host processes against
  `./data/app.db` while the container runs. Deploy = `docker compose build`
  + `up -d`; admin scripts via `docker compose exec athena node scripts/…`.
- The supplements seed fixture must keep reproducing the reference page
  verbatim (`scripts/seed-data.mjs` header comment).
- The uncommitted owner-lock changes (`src/db/ddl.mjs`, `src/db/index.ts`,
  scripts, `tests/dbowner.test.ts`, README/DECISIONS) stay in the tree;
  this work builds on top of them. Commit/push only when the owner says.

## Approaches considered

1. **Teach the supplements engine to run more than one plan** (chosen).
   Add a `plan` label to slots, items, variants and notes; every query and
   page takes the plan. One engine, one editor, one history view; the
   rotation and the new rule start date serve both plans. Trade-off:
   touches live supplements code paths, so the plan tests and a full
   re-check of the pills pages are part of the job.
2. **Copy the supplements module into a Care module.** New tables and
   copied pages (~2,600 lines). Zero risk to pills, but two near-identical
   code bases; every later fix is done twice. Rejected for maintenance.
3. **Care items inside the supplements plan as a category with a filter.**
   Least work, but Care would show in the pill box, facts and day badge,
   and the two-meal variant would apply to it. Rejected.

For the gym side there is one sensible way: delete the logging UI, server
functions, sync ops and scheduler hooks that only serve logging; keep
schedule pages and data. Dropping the tables was considered and rejected
(nothing gained, data lost).

## Design

### Plans

A plan is a key: `'supplements' | 'care'`. A small registry
(`src/lib/plans.ts`, name is the builder's call) holds per-plan copy and
routing so the pages are shared, not duplicated:

| field | supplements | care |
| --- | --- | --- |
| base path | `/supplements` | `/care` |
| tab label | Pills | Care |
| page title | Weekly Supplement Plan | Weekly Care Routine |
| item noun | supplement(s) | step(s) |
| tick words | taken / "All N taken today" | done / "All N done today" |
| facts page title | Supplement Facts | Products & rules |
| disclaimer | …check your plan with a pharmacist. | …check your routine with a dermatologist. |
| "dose" field label in editor | Dose | Amount / how |

### Data model

New columns (all via `ADDED_COLUMNS`, so existing databases migrate on
start):

- `supplements.plan TEXT NOT NULL DEFAULT 'supplements'`
- `meal_slots.plan TEXT NOT NULL DEFAULT 'supplements'`
- `day_variants.plan TEXT NOT NULL DEFAULT 'supplements'`
- `schedule_rules.starts_on TEXT NULL` — `YYYY-MM-DD`; the rule applies
  only on dates `>= starts_on`. Before that date it behaves as if it did
  not exist, except that a dated tick that was logged still shows (same
  treatment the resolver gives rotation before `rotation_start`).
- `supplements.badge TEXT NULL` — explicit day badge text, e.g. "Wash
  night".
- `supplements.form` gains care glyph forms: `drop`, `tube`, `bottle`,
  `tool` (SQLite stores text; the Drizzle enum and `PillGlyph` grow).

Notes per plan: `supplement_settings` is keyed by user only, so Care notes
need a second row. Builder's choice between (a) a new
`plan_settings (user_id, plan, notes, PRIMARY KEY (user_id, plan))` table
with a one-time copy of the existing row into `('supplements')`, or (b)
rebuilding `supplement_settings` with the composite key. Either way the
existing supplements notes must survive unchanged.

Rules implicitly belong to the plan of their supplement and slot; a rule
never spans plans. `supplement_logs` stays shared (rule ids are global
UUIDs), so `/api/sync` `tick` ops need no change.

### Resolver (`src/lib/plan.ts`)

- `PlanRule.startsOn?: string | null`; `resolveDay` skips rules with
  `startsOn > date` unless a non-undone log exists for that rule and date.
- `PlanSupplement.badge?: string | null`. Day label: if **any** item in the
  plan has an explicit badge, the day label is the first scheduled item
  (by item sort order) with a badge, or none; otherwise the existing
  derivation (first item whose rules don't cover all seven days, or
  rotating) applies. Supplements have no badges, so their behaviour is
  unchanged.
- `resolveWeek` unchanged apart from the above. Pure; tests added for
  start dates (before, on, after; logged-before shows), badge precedence,
  and that no badges = old behaviour.

### Server (`src/server/supplements.ts`)

Every function that reads plan data takes the plan: `getPlanData(userId,
plan)`, `resolveDayForUser/WeekForUser/TodayForUser`, `historyRange`,
`getSupplementNotes/setSupplementNotes`, `supplementsWithCoverage`,
`getSlotsForUser(userId, plan?)` (no plan = all, for the reminders page).
`setTaken`, `getRuleForUser`, `getSlotForUser` stay by id. Queries filter
on the new `plan` columns.

### Pages and components

- `/care`, `/care/facts`, `/care/history`, `/care/edit` render the same
  components as their `/supplements` twins with the plan passed in; the
  supplements routes keep their paths. The `/supplements/*` pages become
  thin wrappers around shared page bodies (or the builder uses a dynamic
  `[plan]` segment — their call; the URLs above are fixed).
- `SupplementsView` (rename optional) takes the plan copy. In `today` mode
  the panel eyebrow shows the plan name ("Supplements", "Care") instead of
  "Today" so two panels can sit on one page.
- Facts page: the supplements "Daily amounts from pills" table is plain
  markdown inside the seeded supplements notes, so nothing is conditional;
  the Care facts page is the product list (name, amount, why, watch for)
  plus the Care notes block. Title from the registry.
- Editor: adds "Badge" on the item card and "Starts on" (date, optional) on
  each rule, both plans. The variants section stays generic (Care has none
  seeded). The "Alternate every other day with…" helper lists items of the
  same plan only.
- Home (`/`): training-day card as today, then the supplements today panel,
  then the Care today panel. Each panel heading links to its plan page.
- Nav: five tabs — Today, Pills, Train, Care, Settings. Care icon is a
  droplet-style outline in the same stroke style as the others.
- Reminders settings: slot options come from both plans, labelled
  "Care · Morning · Face" etc. The scheduler's "skip when everything in the
  slot is ticked" resolves the day for the slot's plan. `workout`-kind
  reminders stay (they are schedule reminders); if they currently consult
  logging state (open/finished workout), they simply send on the program
  day's weekday instead.
- `revalidateSupplementPages()` covers both plans' paths.
- Service worker: `public/sw.js` names its caches `athena-assets` and
  `athena-pages` (its `VERSION` constant is unused), so rename the page
  cache (e.g. `athena-pages-v2`) and let the activate step delete the old
  one, so installed phones fetch the new pages and drop the removed routes.

### Gym: schedule only

Remove:

- Routes: `workouts/[workoutId]/page.tsx` (live log), `workouts/history/`,
  `workouts/progress/`, `workouts/day/[programDayId]/actions.ts`
  (`startWorkoutAction`).
- Components: `components/workout-log/*` (LogScreen, RestTimer, types),
  `components/ProgressChart.tsx`, and
  `components/workouts-edit/ExercisePicker.tsx` (used only by the progress
  page).
- Server (`src/server/workouts.ts`): `lastCompletedWorkout`,
  `getOpenWorkout`, `startWorkout`, `getWorkoutForUser`,
  `updateWorkoutSet`, `finishWorkout`, `autoFinishStaleWorkouts`,
  `listWorkoutHistory`, `exerciseProgress` and their helpers; the scheduler
  stops calling `autoFinishStaleWorkouts`.
- Sync: `set` and `finish` ops leave the `SyncOp` union and the route.
  **Unknown op kinds are acknowledged and dropped** (not rejected) so a
  phone with old queued ops clears its outbox.
- UI: the overview's "Open · Start" buttons become "Open day"; the day
  sheet loses Start/Continue workout, "last time" prefill and any link to
  history/progress; the home card already says "Open day".
- Tests that only cover removed code go with it; anything covering the
  schedule stays.

Keep: `workouts/page.tsx`, `workouts/day/[programDayId]/page.tsx`,
`workouts/edit/*`, `components/workouts/*`, figures and pose engine, program/exercise/session-rule server functions,
`workout`-kind reminders, and the `workouts` / `workout_sets` tables with
their rows (unused, not dropped).

### Seed

- `scripts/seed-data.mjs` gains a `care` block (appendix A), with
  `CARE_START = '2026-11-08'` and dates derived from it (week 4 Sunday =
  2026-11-29, first roller night = Saturday of week 5 = 2026-12-12).
- `scripts/seed.mjs` writes `plan` on every row and gains
  `--plan <supplements|care|all>` (default `all` keeps today's behaviour
  for a fresh user). `--plan care` deletes and re-creates **only** care
  rows (slots, items, rules, variants, notes, the logs of care rules, and
  reminders that point at the re-created care slots) and leaves
  supplements rows and ticks untouched. This is how Care is loaded on the
  live database.
- The 07:30 / 21:30 reminder defaults go in `meal_slots.default_time`; the
  seed creates no reminder rows.
- README documents the flag and the rollout order below.

### Rollout

Run by the operator after the build is verified and the owner says go — not
part of building. The builder never runs Docker steps or seeds against the
live container.

1. Back up inside the container (`scripts/backup.mjs`).
2. `docker compose build && docker compose up -d` (schema migrates on start).
3. `docker compose exec athena node scripts/seed.mjs --user ibrahim --plan care`.
4. Check `/supplements` is unchanged, `/care` shows today, a tick syncs, the
   nav has five tabs, `/workouts/history` is gone.

## Left to the builder

Component parameterisation (props vs. context), the registry shape, the
`plan_settings` choice above, glyph drawings and the Care tab icon, item
colours (distinct from the supplements palette; suggestions in appendix A),
lede copy, test layout, and the order of work — except that the gym removal
and the Care build are independent and may be done in either order.

## Appendix A — Care plan seed (from the owner's two routine sheets)

Week runs Sunday–Saturday. `CARE_START = 2026-11-08` (week 1).
Weekdays: 0=Sun … 6=Sat.

Slots (plan `care`, in order; default reminder times 07:30 / 21:30):

| key | name | sort |
| --- | --- | --- |
| `am_face` | Morning · Face | 0 |
| `am_scalp` | Morning · Scalp | 1 |
| `pm_scalp` | Evening · Scalp | 2 |
| `pm_face` | Evening · Face | 3 |

Items and rules (`dose` = the "amount / how" text shown after the name):

| # | item | form | dose | rules (slot: days [, extra]) | badge |
| --- | --- | --- | --- | --- | --- |
| 1 | Cleanser (CeraVe Foaming) | bottle | wash | `am_face`: every day; `pm_face`: every day. Sunday-only `am_face` rule note: "Morning after rolling: water only, then moisturizer" | — |
| 2 | Niacinamide (The Ordinary 10% + Zinc 1%) | drop | a few drops | `am_face`: every day. Sunday-only rule note: "Skip the morning after rolling" | — |
| 3 | Sunscreen (Anthelios UVMune 400 SPF 50+) | tube | two finger-lengths, face and neck | `am_face`: every day. Note: "Last step. Reapply around midday if outside" | — |
| 4 | Adapalene (Differin 0.1%) | tube | pea-sized, on dry skin | `pm_face`: Mon, Wed [1,3]; `pm_face`: Tue, Thu [2,4] **starts_on 2026-11-29**. Note: "Keep off eye corners, nostril creases and lips" | — |
| 5 | Face roller 0.5 mm | tool | light pressure, 4–5 passes each direction | `pm_face`: Sat [6], **every_n_days 14, rotation_start 2026-12-12**. Note: "Alcohol spray before and after. Moisturizer only tonight" | Roller night |
| 6 | Moisturizer (CeraVe Lotion) | bottle | thin layer | `pm_face`: every day | — |
| 7 | Minoxidil foam | drop | on dry scalp, skin not hair | `am_scalp`: Mon–Sat [1–6]; `pm_scalp`: Sun–Fri [0–5]. PM note: "Leave on 4 h before washing" | — |
| 8 | Rosemary oil (Mielle) | drop | massage in, wait 1 hr | `pm_scalp`: Mon, Wed, Fri [1,3,5] | — |
| 9 | Ketoconazole shampoo | bottle | leave 3–5 min, then dry | `pm_scalp`: [1,3,5] | Wash night |
| 10 | Regular shampoo | bottle | then dry | `pm_scalp`: Sat [6] | — |
| 11 | Derma stamp 1.0 mm | tool | 4–5 presses per spot on thinning areas | `pm_scalp`: Sat [6]. Note: "Alcohol spray before and after. Nothing on the scalp for 24 h" | Stamp night |
| 12 | Scalp massage | other | 4 minutes | `pm_scalp`: Tue, Thu [2,4] | — |

"Every day" rules that carry a Sunday-only note are two rules: one for
[1–6] without the note and one for [0] with it.

Item `sort_order` follows the table (0–11). Within-slot order (rule
`sort_order`): Morning · Face = cleanser, niacinamide, sunscreen. Evening ·
Face = cleanser, adapalene, face roller, moisturizer. Evening · Scalp =
rosemary oil, ketoconazole shampoo, regular shampoo, derma stamp, minoxidil,
scalp massage.

Badge precedence: every Saturday has the derma stamp ("Stamp night") and,
every other week from 2026-12-12, the face roller ("Roller night"). The
day label is the first scheduled badge item by item sort order, and the
face roller (5) sorts before the derma stamp (11), so roller Saturdays read
"Roller night" and the others "Stamp night". Mon/Wed/Fri read "Wash night".

Suggested colours (builder may adjust; distinct from each other, and none
equal to a supplement colour — the pills use #B4385A, #B85D12, #2C5FC4,
#38804A, #0A7C86, #7450BF): cleanser #4FA3D1, niacinamide #C44DB0,
sunscreen #E0A526, adapalene #E06D3A, roller #7A7F87, moisturizer #3A9D8F,
minoxidil #1F8AA8, rosemary #7FA62B, ketoconazole #5B7A99, regular shampoo
#8E9AA6, derma stamp #D22F45, massage #A67C52.

Per-item facts (`why` / `watch_for`, shown on Products & rules):

- Minoxidil — why: "Morning and evening every day; the rest of the routine
  is arranged around it. Dry scalp, on the skin rather than the hair; leave
  it at least 4 hours before washing or heavy sweating." watch: "No
  minoxidil for 24 hours after stamping (Saturday night and Sunday
  morning)."
- Rosemary oil — why: "Massage in on wash nights and leave for an hour
  before the ketoconazole shampoo." watch: "Not within 24 hours of
  stamping."
- Ketoconazole shampoo — why: "Three wash nights a week; leave it on 3–5
  minutes, dry fully before minoxidil." watch: "Not within 24 hours of
  stamping."
- Regular shampoo — why: "Saturday only, before the stamp; dry fully
  first."
- Derma stamp — why: "Weekly on Saturday after a regular shampoo: 4–5
  straight presses per spot across the thinning areas. Start at 1.0 mm;
  after about a month with no lasting irritation, 1.5 mm." watch:
  "Redness and pinpoint bleeding are normal, real pain is not. Spray the
  needles with 70% alcohol before and after; never share it. Skip the week
  if the scalp is sore, has spots or is sunburnt. Replace every 2–3
  months, sooner if it drags."
- Scalp massage — why: "4 minutes on Tuesday and Thursday; skip Saturday
  and Sunday."
- Cleanser — why: "First step morning and evening."
- Niacinamide — why: "Every morning under sunscreen."
- Sunscreen — why: "The rule that matters most: without it the sun keeps
  the marks dark. Two finger-lengths for face and neck as the last morning
  step; reapply around midday if outside."
- Adapalene — why: "Monday–Thursday nights on fully dry skin, a pea for the
  whole face. Weeks 1–3 Monday and Wednesday only; Tuesday and Thursday
  join from week 4." watch: "Dryness and peeling in weeks 2–6 are normal
  and pimples can flare in the first month. If it stings or flakes badly,
  drop back to 2 nights a week. Keep off eye corners, nostril creases and
  lips. Alternative: azelaic acid 10% on the same nights — gentler, slower."
- Face roller — why: "Every other Saturday from week 5 (first 2026-12-12):
  cleanser, dry, roll, moisturizer only. Light pressure, 4–5 passes in each
  direction, lifting between passes." watch: "0.5 mm only and never the
  scalp stamp. Spray with 70% alcohol before and after. Not over active
  pimples, eyes or lips. Bleeding means too much pressure. Skip the week
  with pimples in the area, sunburn or peeling. Replace every 2–3 months.
  Next morning: water, moisturizer, sunscreen; adapalene restarts Monday."
- Moisturizer — why: "Every evening, after adapalene on adapalene nights."

Care notes (markdown block on Products & rules):

```
## Rules to remember
- After stamping, nothing goes on the scalp for 24 hours — no minoxidil, ketoconazole or rosemary oil.
- Sunscreen every morning; without it nothing else works.
- Don't squeeze pimples — that is what leaves new marks.
- On stamp Saturdays, roll the face first, then stamp the scalp, each with its own tool.
- Progress photos on the 1st of each month: hairline and crown, and both cheeks, same light and angle. Judge hair at 3–6 months, skin at 3 months (most marks fade by 4–6).
```
