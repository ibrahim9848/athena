# Routine — personal supplements + gym tracker

Handoff spec for Claude Code. Read this whole file, then read the two reference pages in `reference/` before writing any code. Build in the milestone order at the end and stop at the end of each milestone for review.

---

## 1. What this is

A small self-hosted web app (installable PWA) that replaces two static pages the owner already uses:

- `reference/supplement-plan.html` — a weekly supplement plan with a daily tick-off.
- `reference/lifting-plan.html` — a Thu–Sat machine-based lifting plan with exercise cues.

The new app keeps everything those pages do, but:

1. stores data on a server instead of in the browser (so history survives and works across phone + PC),
2. supports a handful of users (owner + up to ~5 trusted people), each with their own plans and logs,
3. lets a user **edit** their plans in the app instead of editing HTML,
4. adds a **workout log** (weights, reps, per set) and simple progress views,
5. installs to the iPhone Home Screen as a PWA and can send reminder notifications.

Users reach it only over a private Tailscale network. There is no public internet exposure, so auth can be simple — but it must still exist, because several people share the server.

---

## 2. Non-goals (do not build)

- No native iOS/Android app. PWA only.
- No social features, sharing, leaderboards, or public pages.
- No AI features, no chat.
- No barcode scanning, no nutrition/calorie tracking, no food logging.
- No exercise video library. Exercise illustrations are **optional** (see 7.4).
- No email, no OAuth providers, no password reset flows. Owner resets passwords with a CLI command.
- No multi-tenant/organisation layer. One instance = one group of friends.

---

## 3. Stack

Keep it boring and single-container.

- **Next.js 15 (App Router) + TypeScript**, server actions for mutations.
- **SQLite** file database via **Drizzle ORM** (`better-sqlite3`). One file at `/data/app.db`. WAL mode on.
- **Auth**: username + password, Argon2 hashing, server-side sessions in the DB, httpOnly cookie. First user created via `npm run create-user`.
- **Styling**: Tailwind. Reuse the visual language of the reference pages (fonts, spacing, dark mode) — see section 8.
- **PWA**: web manifest, service worker (use `serwist` or `next-pwa`), Web Push via the `web-push` package with VAPID keys from env.
- **Scheduling**: a small in-process scheduler (`node-cron`) in a custom server entry for sending reminder pushes. No external queue.
- **Container**: one `Dockerfile` (multi-stage, `node:22-alpine`, non-root), one `docker-compose.yml`, volume `./data:/data`.
- **Tests**: Vitest for the plan-resolution logic (section 6.3) and the Friday/gym-day rules. No E2E suite required.

If a library above is unavailable or clearly worse at build time, swap it and note the swap in `DECISIONS.md`.

---

## 4. Users and access

- Table `users`: `id`, `username` (unique), `password_hash`, `display_name`, `timezone` (IANA string, default `Asia/Riyadh`), `role` (`owner` | `member`), `created_at`.
- Everyone sees only their own data. There is no "view another user's plan" feature.
- `owner` additionally gets `/admin`: list users, create user, reset a user's password, delete a user (with confirmation). That's all.
- Session cookie lifetime: 90 days, sliding.
- All dates/"today" logic uses the **user's timezone**, never the server's.

---

## 5. Data model

Use Drizzle schema files; one file per area. All ids are UUIDs (text). All timestamps are ISO strings in UTC. Every user-owned table has `user_id` and queries always filter by it.

### 5.1 Supplements

```
supplements
  id, user_id, name, form ('tablet'|'capsule'|'softgel'|'chewable'|'scoop'|'other'),
  default_dose (text, e.g. "1 tablet", "5 g"), ingredients (text, optional),
  why (text, optional), watch_for (text, optional), notes (text, optional),
  color (hex, for the pill glyph), sort_order, archived (bool)

meal_slots            -- a user's daily time anchors
  id, user_id, key (text, e.g. 'breakfast'), name, subtitle (optional),
  default_time (HH:MM local, optional, used for reminders), sort_order

schedule_rules        -- "this supplement, in this slot, on these days"
  id, user_id, supplement_id, slot_id,
  days (JSON int[] 0=Sun..6=Sat), dose_override (text, optional),
  note (optional), variant (text, optional: 'default' | 'two_meal' — see 6.2)

day_variants          -- per-weekday overrides (Friday two-meal rule)
  id, user_id, day (0..6), variant (text, 'two_meal'), label (text)

supplement_logs       -- one row per tick
  id, user_id, date (YYYY-MM-DD in user tz), rule_id, taken_at (UTC), undone (bool)
```

Design choice: a tick is a row in `supplement_logs`; un-ticking sets `undone=true` rather than deleting, so history is auditable. "Taken" = latest row for (date, rule_id) has `undone=false`.

### 5.2 Workouts

```
exercises
  id, user_id, name, equipment (text, optional), main_muscles (JSON string[]),
  helping_muscles (JSON string[]), cues (text, markdown), view ('side'|'front'|'top', optional),
  illustration_svg (text, optional, see 7.4), sort_order, archived

programs
  id, user_id, name, description, is_active (bool)

program_days
  id, program_id, weekday (0..6), name ("Push"), focus ("chest, shoulders, triceps"),
  est_minutes (int), sort_order

program_exercises
  id, program_day_id, exercise_id, sets (int), reps_min (int), reps_max (int),
  rest_seconds (int), per_side (bool), sort_order

session_rules         -- the "Every session" block: warm-up, effort, tempo, progress
  id, program_id, key (text), text

workouts              -- one logged training session
  id, user_id, program_day_id (optional), date (YYYY-MM-DD), started_at, finished_at,
  notes (optional)

workout_sets
  id, workout_id, exercise_id, set_number, weight_kg (real, optional),
  reps (int, optional), rpe (real, optional), done (bool), created_at
```

### 5.3 Reminders

```
push_subscriptions   id, user_id, endpoint, p256dh, auth, created_at
reminders            id, user_id, kind ('slot'|'workout'|'custom'), ref_id (slot/program_day id),
                     time (HH:MM local), days (JSON int[]), enabled (bool), label
reminder_sends       id, reminder_id, sent_for_date, sent_at   -- idempotency
```

---

## 6. Supplement module — behaviour

### 6.1 What the reference page does (keep all of it)

- Seven-day strip of "boxes" showing the pills scheduled each day; today is marked. Tapping a day shows that day's plan; "Back to today" returns.
- A day is a **Multivitamin day** or a **Zinc day** (they alternate so they never coincide).
- Items are grouped by meal slot (Breakfast / First lunch / Dinner / Before bed).
- On **today only**, each item is a toggle; ticking it removes the pill from the day box and advances a progress bar ("3 of 6 taken", "All 6 taken today").
- **Gym days (Thu, Fri, Sat)** change magnesium's dose from 1 to 2 capsules and show a "Gym day dose" note.
- **Friday is a two-meal day**: the slots become First dinner / Second dinner / Before bed, and items are redistributed (see seed data).
- A "Supplement Facts" panel lists each supplement with its weekday dots, dose, timing, ingredients, "Why", "Watch for", "Breaks", "Expect", "Blood tests" text.
- A "Daily amounts from pills" table with limits and footnotes. In the new app this is a free-text/markdown **notes** block on the plan — do not try to compute nutrient totals.
- A disclaimer line ("general information, not medical advice") stays visible on the plan page.
- Date rolls over automatically at local midnight and when the tab regains focus.

### 6.2 Generalisation

The reference hard-codes one person's plan. The app must express it through data so any user can build their own:

- A user has meal slots (any number, any names, ordered).
- A user may mark any weekday with a `day_variant` (e.g. Friday = `two_meal`). Schedule rules can be tagged with a variant; when resolving a day that has a variant, use only rules tagged with that variant for that user; otherwise use rules with variant `default`/null. This reproduces the Friday rule without special-casing Friday in code.
- A supplement's dose can be overridden per rule (`dose_override`), which reproduces "2 capsules on gym days" as a rule for days [4,5,6] with `dose_override = '2 capsules'` and a note "Gym day dose". No "gym day" concept in the supplement module itself.
- Alternating days are simply two rules with disjoint `days` arrays. Provide a UI helper "alternate with …" that sets days to [0,2,4,6] / [1,3,5], but store plain day arrays.

### 6.3 Plan resolution (pure function, unit-tested)

```
resolveDay(user, date) -> { dayLabel, slots: [{ slot, items: [{ rule, supplement, dose, note, taken }] }], progress: { taken, total } }
```

Rules: pick variant for weekday → filter rules by variant and `days ∋ weekday` → group by slot in slot order → attach latest log state. Items with `archived` supplements are excluded. Must be deterministic and timezone-correct.

### 6.4 Screens

- `/` (home) — today's supplement plan as the reference shows it, plus a small card at the top if today is a training day ("Thursday · Push · start workout").
- `/supplements` — the 7-day strip + plan for selected day (the reference page, data-driven).
- `/supplements/facts` — the facts panel + plan notes.
- `/supplements/edit` — manage supplements, slots, rules, variants. Simple forms; a rule editor row = supplement, slot, weekday checkboxes, dose override, note, variant.
- `/supplements/history` — calendar heat-strip for the last 8 weeks: per day, taken/total; tap a day to see what was missed.

---

## 7. Workout module — behaviour

### 7.1 What the reference page does (keep all of it)

- Sticky week strip: Sun–Wed "Walk", Thu "Push", Fri "Legs", Sat "Pull"; today dotted.
- "Every session" rules block: Warm up / Effort / Tempo / Progress.
- Per day: name, focus line, summary ("5 exercises · 17 sets · about 50 min"), a sheet listing exercises with rest time and `sets × reps`, with "each arm" for per-side moves.
- "How to do each one": a card per exercise with main/helping muscle chips, a 2–3 sentence cue, and an animated side/front/top-view figure (a "Pause figures" button stops the animation).
- A rest-days block ("Walk 8,000–10,000 steps a day. Sleep 7 hours or more.").

### 7.2 Generalisation

- A user can have several programs; one is active. The week strip reads from the active program's `program_days`. Days without a program day show a user-editable label (default "Rest") stored on the program (`rest_day_label`, `rest_day_notes`).
- Everything on the reference page is editable: program name, session rules, days, exercise order, sets/reps/rest, cues, muscles.
- Summary line ("5 exercises · 17 sets · about 50 min") is computed: exercises count, sum of sets, and minutes = sum over exercises of `sets × (45 s + rest_seconds)` rounded to nearest 5. Do not store it.

### 7.3 Logging a workout (new)

- From the day page, "Start workout" creates a `workouts` row and opens `/workouts/[id]`.
- The log screen lists each exercise with N set rows (weight kg, reps, done checkbox). Pre-fill weight and reps from the **last completed workout of the same program day** for that exercise; if none, leave blank but show the target rep range.
- A rest timer starts automatically when a set is marked done, using that exercise's `rest_seconds`; it must keep counting if the phone screen is locked (use timestamps, not `setInterval` accumulation) and vibrate/notify at zero if permitted.
- "Finish" sets `finished_at`. Unfinished workouts older than 12 h are auto-finished.
- Progression hint: after finishing, for each exercise where every set hit `reps_max`, show "Hit the top of the range — add 2.5–5 kg next time". Pure UI, no auto-changes.

### 7.4 Exercise illustrations (optional, last milestone)

The reference page draws animated stick-figure-on-machine SVGs via a hand-written engine (`PF` in `reference/lifting-plan.html`). Porting it is **not required**. Options, in order of preference:

1. Store a static SVG string per exercise (`illustration_svg`) and ship the 16 seeded exercises with a single mid-lift frame rendered from the reference engine. (Rendering them once is fine — open the reference in a browser, pause, and copy the SVG markup.)
2. If time allows, port the engine as a React component that animates `pose(t)`.
3. If neither, show the muscle chips and cue only. The app must look complete without any figures.

### 7.5 Screens

- `/workouts` — week strip + active program overview (the reference page, data-driven).
- `/workouts/day/[programDayId]` — the day sheet + exercise cards + "Start workout".
- `/workouts/[workoutId]` — live logging screen.
- `/workouts/history` — list of past sessions; tap to see sets.
- `/workouts/progress` — per exercise, a simple line chart of best set (weight × reps → estimated 1RM via Epley) over time. Use a light chart lib or inline SVG.
- `/workouts/edit` — programs, days, exercises, session rules.

---

## 8. Look and feel

Match the reference pages; they are the design system.

- Fonts: Big Shoulders Display (headings, uppercase, tight leading), Barlow (body), Barlow Semi Condensed (labels, uppercase, letter-spaced). Load from Google Fonts.
- Colour tokens: copy the `:root` and dark-mode blocks from both references into Tailwind theme values. Light background `#edf0f3`, surface `#ffffff`, accent red `#d22f45`; dark background `#0f1317`, accent `#ff5468`. Respect `prefers-color-scheme`, plus a manual toggle stored per device.
- Mobile-first, max content width 780px, 16px gutters, `viewport-fit=cover` with safe-area padding. Sticky week strip with backdrop blur.
- Rounded 12–14px cards, 1px `--line` borders, tabular numerals for all numbers.
- Supplement "pill" glyphs: keep the shapes per `form` (caplet, chewable, softgel, round, capsule, scoop) — reuse the CSS from the supplement reference.
- Big tap targets (≥44px). Toggles use `aria-pressed`. Keyboard focus ring in accent colour.

---

## 9. PWA + notifications

- `manifest.webmanifest`: name "Routine", standalone display, theme colour from tokens, 192/512 icons (generate a simple icon: red circle on dark square with a white "R"; make it a real PNG, not a placeholder).
- Service worker: cache the app shell; API/data requests are network-first. Offline: today's resolved plan and the current workout must render from the last cached response, and ticks/sets made offline are queued in IndexedDB and replayed when back online. Keep this simple: a single outbox with retry on `online`.
- iOS: add `apple-mobile-web-app-capable`, `apple-touch-icon`, status-bar style. Push on iOS only works once the app is installed to the Home Screen and the user has tapped "Enable reminders" — the settings page must explain this in one line.
- Reminders: user sets per-slot times and a per-training-day time in `/settings/reminders`. The scheduler runs every minute, converts each enabled reminder to the user's local time, sends at most once per reminder per date (`reminder_sends`), and skips a slot reminder if everything in that slot is already ticked.
- All pushes are served over HTTPS. In deployment, HTTPS comes from `tailscale serve` in front of the container (see 10). Locally, use `next dev` on http://localhost (push testing locally can be skipped).

---

## 10. Deployment

Target: the owner's Windows PC running Docker Desktop, reachable to friends through Tailscale.

- `docker compose up -d` must be the only command needed after `.env` is filled.
- `.env.example` with: `DATABASE_PATH=/data/app.db`, `SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `APP_URL`.
- `npm run create-user -- --username ibrahim --role owner` prompts for a password.
- `npm run backup` copies the DB with `sqlite3 .backup` semantics to `/data/backups/app-YYYY-MM-DD.db` and keeps the last 30. The compose file includes a tiny sidecar or cron line that runs it daily at 03:00.
- `README.md` sections, in this order: what it is · run locally · first user · run with Docker · expose with `tailscale serve --bg --https=443 localhost:3000` · install on iPhone (Share → Add to Home Screen) · enable reminders · backups and restore · reset a password.
- Container runs as non-root, healthcheck on `/api/health`, restart `unless-stopped`.

---

## 11. Seed data

Create `npm run seed -- --user <username>` that loads the owner's current plans exactly as in the reference pages. This is the acceptance fixture; the app's default screens must reproduce the reference pages from this data.

### 11.1 Supplements (slots, supplements, rules)

Slots (default variant): `breakfast` "Breakfast" (subtitle "Protein bar, honey and coffee"), `lunch` "First lunch", `dinner` "Dinner", `bed` "Before bed".

Friday variant `two_meal` slots: `dinner1` "First dinner" (subtitle "Two meals on Fridays"), `dinner2` "Second dinner", `bed` "Before bed".

Supplements and default-variant rules (days: 0=Sun … 6=Sat):

| Supplement | form | dose | slot | days | note |
|---|---|---|---|---|---|
| Multivitamin | tablet | 1 tablet | lunch | 0,2,4,6 | At least an hour away from coffee |
| Zinc | chewable | 1 chewable | dinner | 1,3,5 | |
| Omega-3 | softgel | 1 softgel | lunch | 0–6 | |
| Ashwagandha | tablet | 1 tablet | breakfast | 0–6 | |
| Ashwagandha | tablet | 1 tablet | dinner | 0–6 | |
| Creatine | scoop | 5 g | dinner | 0–6 | |
| Magnesium | capsule | 1 capsule | bed | 0,1,2,3 | |
| Magnesium | capsule | 2 capsules (override) | bed | 4,5,6 | Gym day dose |

Friday (`two_meal` variant) rules: Ashwagandha → dinner1; Omega-3 → dinner1; Zinc → dinner1 (note "Keeps it hours away from the magnesium"); Multivitamin → dinner1 (note "At least an hour away from coffee"; it is still a day-5 rule only if day 5 is in its days — it is not, so it will not appear; keep the rule so the user can toggle days later); Ashwagandha → dinner2; Creatine → dinner2; Magnesium 2 capsules → bed.

Ingredients / why / watch-for text: copy verbatim from `reference/supplement-plan.html` ("Supplement Facts" section) into the `ingredients`, `why`, `watch_for`, `notes` fields. The "Daily amounts from pills" table and its footnotes go into the plan `notes` as markdown, including the disclaimer line.

### 11.2 Program "Thu–Sat Lifting Plan"

Session rules: Warm up / Effort / Tempo / Progress — text verbatim from the reference. Rest-day label "Walk", rest-day notes verbatim from the "Sunday to Wednesday" block.

Thursday "Push" — focus "chest, shoulders, triceps":
1. Chest press — 4 × 8–10, rest 120 s — main Chest; helping Triceps
2. Incline chest press — 3 × 10–12, rest 90 s — Upper chest; Triceps
3. Shoulder press — 3 × 8–10, rest 120 s — Shoulders; Triceps
4. Cable lateral raise — 4 × 12–15, rest 60 s, per side — Side shoulders
5. Triceps pushdown — 3 × 10–12, rest 60 s — Triceps

Friday "Legs + core" — focus "quads, hamstrings, glutes, calves, abs":
1. Leg press — 4 × 8–10, rest 150 s — Quads; Glutes
2. Seated leg curl — 3 × 10–12, rest 90 s — Hamstrings; Calves
3. Leg extension — 3 × 10–12, rest 90 s — Quads
4. Hip thrust machine — 3 × 8–12, rest 120 s — Glutes; Hamstrings
5. Standing calf raise — 4 × 10–15, rest 60 s — Calves
6. Ab crunch machine — 3 × 10–15, rest 60 s — Abs

Saturday "Pull" — focus "back, rear shoulders, biceps":
1. Lat pulldown — 4 × 8–10, rest 120 s — Lats; Biceps
2. Seated row — 3 × 8–12, rest 90 s — Mid back; Biceps, rear shoulders
3. Rear-delt fly — 3 × 12–15, rest 60 s — Rear shoulders; Upper back
4. Biceps curl machine — 3 × 10–12, rest 60 s — Biceps
5. Straight-arm pulldown — 3 × 12–15, rest 60 s — Lats; Rear shoulders

Cues and view (side/front/top) for every exercise: copy verbatim from the reference page's "How to do each one" cards.

---

## 12. Acceptance checklist

Milestone is done only when every line in its block is true.

**M1 — Foundation**
- [ ] `docker compose up` serves the app; `/api/health` returns 200.
- [ ] Owner can be created from CLI, log in, log out; a second user cannot see the owner's data (write a test).
- [ ] Seed command loads section 11 without errors.

**M2 — Supplements**
- [ ] `/supplements` on a seeded account looks like `reference/supplement-plan.html` for every weekday, including the Friday two-meal layout and gym-day magnesium.
- [ ] Ticking today's items updates the day box, the progress bar, and persists across devices (check in a second browser).
- [ ] `resolveDay` unit tests cover: alternating days, variant day, dose override, archived supplement, timezone rollover at local midnight.
- [ ] Editing a rule in `/supplements/edit` changes the plan immediately.

**M3 — Workouts**
- [ ] `/workouts` matches `reference/lifting-plan.html` content (strip, rules, three day sheets, cue cards, rest block); figures may be absent.
- [ ] Start → log sets → rest timer → finish works on an iPhone-sized viewport with the keyboard open.
- [ ] Pre-fill from last session works; progression hint appears when all sets hit `reps_max`.
- [ ] Progress chart renders for an exercise with ≥2 logged sessions.

**M4 — PWA + reminders**
- [ ] Lighthouse PWA installable; Home Screen install on iOS gives a standalone window with no browser chrome.
- [ ] Offline: open the app with network off → today's plan and an in-progress workout still render; a tick made offline appears on the server after reconnecting.
- [ ] A slot reminder fires at the set local time once, and does not fire if the slot is already fully ticked.

**M5 — Polish (optional)**
- [ ] Exercise illustrations per 7.4.
- [ ] Admin page.
- [ ] Backup script + daily run; restore procedure tested once.

---

## 13. Working rules for Claude Code

- Keep a `DECISIONS.md` listing anything you chose that this spec didn't settle.
- Don't add features not in this file. If something seems missing, add it to `QUESTIONS.md` and continue with the simplest assumption.
- Commit after each milestone with a message `M1: …`, `M2: …`.
- Prefer server components and server actions; keep client JS to the interactive parts (toggles, workout log, timer, charts).
- Every DB query goes through a function that takes `userId` explicitly. No query in a route handler without it.
- Run `npm run lint && npm run test && npm run build` before declaring a milestone done.
