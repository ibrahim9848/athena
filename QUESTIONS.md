# Open questions / known deviations

Things the spec didn't settle (or where the spec and the reference pages disagree), and the assumption that was shipped. None of them block acceptance; flagging for review.

1. **Ashwagandha pill glyph.** The reference draws ashwagandha as a plain *round* pill (`.pill.round`), but the SPEC 11.1 table says form `tablet` (which renders as the caplet shape) and the `form` enum has no `round`. The seed uses form **`other`** and the glyph component renders `other` as the round pill, so the pill box matches the reference pixel-for-pixel. If a real "round" form is ever wanted, add it to the enum and migrate.

2. **Day summary minutes.** The summary line is computed per SPEC 7.2 (`sets × (45 s + rest_seconds)`, rounded to nearest 5) and gives **40 / 45 / 35 min** for Push / Legs + core / Pull, while the reference page hand-writes **about 50 / 60 / 50 min**. The spec says to compute and not store it, so the computed numbers win; exercise and set counts match the reference exactly.

3. **Disclaimer line.** The home page and `/supplements` hardcode a short "general information, not medical advice" disclaimer so it is always visible (SPEC 6.1), while the verbatim reference disclaimer ("Built from your bottle labels, except creatine, …") lives in the seeded plan notes shown on `/supplements/facts`. The same sentence therefore appears in two places on the facts page for a seeded user.

4. **Zinc dose wording.** SPEC 11.1 says the dose is `1 chewable`; the reference day plan renders `1 chewable tablet` (its facts label says `1 chewable`). The seed follows the spec table, so the facts panel matches the reference and the day plan shows "Zinc · 1 chewable" instead of "… chewable tablet".

5. **Session rule keys.** `session_rules` has only `key` and `text`, no display label, so the seed stores the reference's display labels ("Warm up", "Effort", "Tempo", "Progress") directly in `key`. Fine for rendering; slightly odd as an identifier.

6. **Seeded doses in facts vs reference footnotes.** The reference facts label aggregates ("2 tablets — 1 at breakfast, 1 at dinner", "First dinner on Fri" etc.). In the app these lines are derived from the rules; the per-rule seed reproduces the schedule, not those aggregate strings. The facts page composes its dose/time column from the rules at render time.

7. **Non-interactive password entry.** When stdin is not a TTY, `create-user` cannot hide input; it prints a warning and reads the password visibly (single prompt, no confirmation). `--password` exists for scripted use.

8. **est_minutes left NULL.** `program_days.est_minutes` exists in the schema but the seed leaves it NULL on purpose — SPEC 7.2 says the summary is computed, never stored.

9. **Backup scheduling.** SPEC 10 suggests a compose sidecar or cron line for the daily backup; instead the backup runs inside the app via node-cron at 03:00 (one fewer container, same result). `scripts/backup.mjs` covers manual/external scheduling if ever needed.

10. **Next.js version.** SPEC says Next.js 15; the project pins Next 14.2 (App Router, same architecture). Noted here since DECISIONS.md is owned by another module.

11. **Week strip label for Friday.** SPEC 7.1 describes the reference strip as `Fri "Legs"`, but SPEC 11.2 names the program day `"Legs + core"`, and the strip renders the day's one `name` field — so the strip shows "Legs + core" where the reference shows "Legs". One field cannot produce both; the seeded name follows 11.2.

12. **Rest-timer notification on a locked phone.** The timer's remaining time is timestamp-correct across screen lock, but the vibrate/notify at zero (SPEC 7.3 "if permitted") cannot fire *while* the phone is locked: browsers suspend page JS in the background, and the web platform has no reliable scheduled-notification API (Notification Triggers never shipped). The notification fires as soon as the app is foregrounded again.

13. **One entry per exercise per training day.** The editor refuses adding the same exercise twice to one day: the log screen groups sets by exercise, so two entries (e.g. heavy + back-off) would merge confusingly. Model a back-off scheme as a wider rep range, or duplicate the exercise in the library under a second name.
