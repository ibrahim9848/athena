# Athena

## What it is

Athena is a small self-hosted routine tracker — supplements, a scalp-and-face care routine and a gym schedule — installable as a PWA. It replaces two static HTML pages (a weekly supplement plan and a Thu–Sat lifting plan) with a server-backed app:

- a daily supplement plan with a seven-day pill box, tick-offs, gym-day doses and a Friday two-meal variant, all data-driven and editable;
- a care routine (scalp and face) on the same engine: morning and evening steps, weekday rules, an every-other-Saturday rotation and start dates for steps that phase in, ticked off the same way;
- a lifting program with day sheets, exercise cues and animated figures — a schedule to follow, not a log;
- a handful of users (owner + trusted friends), each seeing only their own data;
- push reminders for meal and routine slots and for training days.

Everything lives in one SQLite file. The app is reached only over a private Tailscale network — there is no public exposure, no email, no OAuth.

<p align="center">
  <img src="docs/screenshot-supplements.jpg" alt="Weekly supplement plan with the seven-day pill box and today's tick-off" width="420">
  <img src="docs/screenshot-workouts.jpg" alt="Lifting plan with the sticky week strip and set sheet" width="420">
</p>
<p align="center">
  <img src="docs/screenshot-figures.jpg" alt="Exercise cards with animated machine figures and cues" width="840">
</p>

Built end-to-end with [Claude Code](https://claude.com/claude-code) from a written spec (see SPEC.md), including the adversarial review pass whose findings are fixed in the git history.

## Run locally

```bash
npm install
npm run dev:local
```

The app runs at http://localhost:3000 against `./data/dev.db`. (`npm run dev` uses `./data/app.db`, or whatever `DATABASE_PATH` says.)

> **Don't point a host process at the Docker database.** While the container is running, `./data/app.db` belongs to it: a server or script started on Windows against the same file refuses to start (two hosts writing one SQLite file corrupts it). That is why `dev:local` exists; for scripts use `DATABASE_PATH=./data/dev.db node scripts/...`, and run admin scripts against the live data with `docker compose exec athena node scripts/...`.

Create a user and load the default plans:

```bash
DATABASE_PATH=./data/dev.db npm run create-user -- --username ibrahim --role owner
DATABASE_PATH=./data/dev.db npm run seed -- --user ibrahim
```

`seed` takes `--plan supplements|care|all` (default `all`). `all` **replaces** that user's supplements, care routine, lifting program, logs and reminders with the defaults (reminders point at plan rows that get regenerated, so they are removed too — re-create them under Settings → Reminders). A single plan replaces only that plan's slots, items, rules, notes, ticks and slot reminders and leaves everything else alone — this is how the care routine is added to an install that already has supplement history:

```bash
npm run seed -- --user ibrahim --plan care
```

## First user

```bash
npm run create-user -- --username ibrahim --role owner
```

The script prompts for the password twice (hidden input). Options:

| Option | Meaning |
| --- | --- |
| `--username` | required; 2–32 chars of `a-z 0-9 _ . -` |
| `--role` | `owner` or `member` (default `member`) |
| `--display-name` | defaults to the username |
| `--timezone` | IANA name, default `Asia/Riyadh` |
| `--password` | skip the prompt (for non-interactive use; it lands in your shell history) |

The owner gets `/admin` to create more users, reset passwords and delete users.

## Run with Docker

1. Copy `.env.example` to `.env` and fill it in. Generate the VAPID keys once:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Put the two keys in `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, set `VAPID_SUBJECT` to a `mailto:` address, `SESSION_SECRET` to any long random string, and `APP_URL` to the HTTPS URL you will use (your Tailscale URL, see below). Leave `DATABASE_PATH=/data/app.db` as is for Docker.

2. Build and start:

   ```bash
   docker compose up -d
   ```

   The database is stored on the host in `./data` (mounted at `/data` in the container). The container runs as a non-root user, restarts unless stopped, and has a healthcheck on `/api/health`.

3. Create the first user and seed it, inside the container:

   ```bash
   docker compose exec athena node scripts/create-user.mjs --username ibrahim --role owner
   docker compose exec athena node scripts/seed.mjs --user ibrahim
   ```

### Adding the care routine to a running install

The schema migrates itself on start, so the order is: back up, rebuild, seed only the care plan, check.

```bash
docker compose exec athena node scripts/backup.mjs
docker compose build && docker compose up -d
docker compose exec athena node scripts/seed.mjs --user ibrahim --plan care
```

Then open the app: the pills page is unchanged, `/care` shows today's steps, the bottom bar has five tabs, and the old workout-log routes are gone.

## Expose with Tailscale

On the host machine (already joined to your tailnet):

```bash
tailscale serve --bg --https=443 localhost:3000
```

The app is then reachable at `https://<machine>.<tailnet>.ts.net` for everyone on your tailnet, with valid HTTPS (required for push notifications and the PWA install). Set that URL as `APP_URL` in `.env`.

## Install on iPhone

Open the app's URL in Safari, tap **Share → Add to Home Screen**. The icon opens the app in a standalone window with no browser chrome.

## Enable reminders

Go to **Settings → Reminders** in the app, enable the reminders you want and set the times. On iOS, notifications only work after the app has been installed to the Home Screen (previous section) — open it from the Home Screen icon, then tap enable. Slot reminders are skipped automatically when everything in that slot is already ticked.

## Backups and restore

- A backup runs **daily at 03:00** inside the app itself (node-cron) — no sidecar container needed. It runs at 03:00 in the timezone set by `TZ` in `.env` (default `Asia/Riyadh`; the container itself runs in UTC). Backups land in `./data/backups/app-YYYY-MM-DD.db`; the newest 30 are kept.
- Run one manually at any time:

  ```bash
  npm run backup
  # or in Docker:
  docker compose exec athena node scripts/backup.mjs
  ```

  It uses SQLite's online backup (`sqlite3 .backup` semantics), so it is safe while the app is running.

- **Restore**: stop the container, **delete the WAL sidecar files**, copy a backup over the database file, start again. The delete step matters: the database runs in WAL mode, and a leftover `app.db-wal` from the old database would be replayed into the restored file and corrupt it.

  ```bash
  docker compose down
  del data\app.db-wal data\app.db-shm   # (rm -f on Linux/macOS; fine if they don't exist)
  copy data\backups\app-2026-10-18.db data\app.db   # (cp on Linux/macOS)
  docker compose up -d
  ```

## Reset a password

- **Easiest**: sign in as the owner and use `/admin` → reset password.
- The `create-user` script refuses existing usernames, so it cannot reset one. If you are locked out of the owner account, run this one-liner (first argument username, second the new password):

  ```bash
  docker compose exec athena node -e "const D=require('better-sqlite3'),a=require('argon2');(async()=>{const db=new D(process.env.DATABASE_PATH||'data/app.db');const h=await a.hash(process.argv[2]);const n=db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(h,process.argv[1]).changes;console.log(n?'Password updated.':'No such user.');process.exit(n?0:1)})()" ibrahim "new-password"
  ```

  (Drop the `docker compose exec athena` prefix to run it against a local `./data/app.db`.)

## Changelog

One commit per milestone (see `git log`); each milestone's files landed in its own commit:

- `M1: foundation — SQLite schema + Drizzle, argon2 auth with DB sessions, health check, CLI create-user, Docker packaging`
- `M2: supplements — seven-day pill box, day plan with tick-offs and progress, Friday two-meal variant, gym-day doses, facts label, plan editor, history heat-strip`
- `M3: workouts — program overview and day sheets, workout logging with pre-fill and rest timer, history, Epley progress charts, program editor`
- `M4: PWA + reminders — manifest and icons, service worker with offline outbox, web push, per-slot and per-training-day reminders with idempotent sends`
- `M5: polish — admin page, daily 03:00 in-app backups + backup CLI, seed fixture matching the reference pages, README`

Later, on the `care-plan` branch: the supplements engine runs more than one plan (`plan` column, rule start dates, explicit day badges, per-plan notes), the care routine arrives on it with its own `/care` pages and tab, the seed gains `--plan`, and workout logging (live log, rest timer, history, progress) is removed so the Train tab is a schedule only.
