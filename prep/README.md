# Block 26

A mobile-first PWA that runs a 26-week, day-by-day interview prep plan: switching from SDE-1 at a
startup to product MNCs and unicorns. Progress, logs and materials live in MongoDB.

- **Today**: the day's problems (LeetCode links, difficulty), embedded YouTube lessons, readings and
  practice tasks. Check them off, flag problems to revisit, and log minutes and notes.
- **Plan**: four phases (Base, Build, Peak, Race) and 26 weekly themes, with every day's status.
- **Progress**: streak, plan completion heatmap, per-track progress, live LeetCode stats against your
  starting point (237 solved, 4 hard, 1 contest), and the revisit list.
- **Library**: your own links and files (PDF/images/text up to 4 MB, stored in MongoDB GridFS),
  optionally pinned to a day, plus a reference shelf.
- **Reminders**: web push. A morning plan and an evening nudge that only fires if the day isn't done
  (and warns when your streak is about to break).
- Installable, works offline for pages you've opened, light and dark themes.

## The plan

`src/data/plan.json` holds 182 days: 290 LeetCode problems (all free, slugs and difficulty verified
against LeetCode), 112 YouTube lessons (take U forward, NeetCode, Hello Interview, ByteByteGo,
Hussein Nasser, Concept && Coding, Gate Smashers and others), readings and practice tasks. It is
weighted toward the gaps in the starting profile: graphs, union-find, tries, DP, hard problems and
contests, plus LLD (machine coding), HLD, OS/DBMS/networks and backend depth.

Weekdays are about 1.5 to 2 hours: two problems plus one design or CS item. Saturdays carry a deep
dive or a timed mock; Sundays are the LeetCode weekly contest, upsolving and a weekly review. The plan
always starts on a Monday. If you fall behind, Settings can push the whole plan back a week without
losing anything you've done.

## Run locally

```bash
cd prep
npm install
cp .env.example .env.local   # fill in MONGODB_URI at least
npm run dev
```

Without `APP_PASSCODE` the app has no login (fine locally, never in production).

## Deploy (Vercel + MongoDB Atlas)

1. Create a free MongoDB Atlas cluster. Under Network Access allow `0.0.0.0/0` (Vercel has no fixed
   IPs), create a database user, and copy the connection string.
2. Generate push keys: `npm run vapid`.
3. Import this repo in Vercel and set **Root Directory** to `prep`.
4. Add the environment variables from `.env.example`: `MONGODB_URI`, `APP_PASSCODE`,
   `SESSION_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `CRON_SECRET`.
5. Deploy, open the site on your phone, sign in, and install it (Android: Install app; iPhone: Share,
   then Add to Home Screen). Then Settings, Turn on reminders.

### Reminder timing

`vercel.json` schedules the reminder job at 08:00 and 21:00 India time, which matches the default
settings and works on Vercel's free plan. To use other hours, add the repository secrets
`BLOCK26_URL` and `BLOCK26_CRON_SECRET`; the workflow in `.github/workflows/block26-reminders.yml`
then calls the job every hour. The job is idempotent, so running both is safe: each reminder goes
out at most once a day.

## MongoDB collections

| Collection | Holds |
| --- | --- |
| `settings` | start date, time zone, LeetCode username, reminder hours |
| `days` | per-day checked tasks, minutes and notes |
| `revisit` | problems flagged for another attempt |
| `materials`, `files.*` | library entries; uploaded files in GridFS |
| `activity` | dates with any activity (streaks) |
| `leetcode_snapshots` | one LeetCode stats snapshot per day (progress chart) |
| `push_subscriptions`, `reminders_sent` | devices and reminder de-duplication |
