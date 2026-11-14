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

`src/data/plan.json` (version 2) holds 182 days aimed at backend/platform roles and forward deployed
engineer (FDE) roles:

- **DSA:** 290 free LeetCode problems (slugs and difficulty verified), weighted toward the starting
  gaps: graphs, union-find, tries, DP and about 80 hard problems. Contests are optional.
- **Backend:** Postgres internals, isolation and locking, Kafka, Redis, idempotency, retries,
  sagas, OAuth/OIDC, and a Friday read through *Designing Data-Intensive Applications* (weeks 7–18).
- **Infra:** a Sunday lab every week that grows one service: Docker, AWS (IAM, VPC, ECS Fargate,
  RDS, SQS/Lambda), Kubernetes (kind, probes, Helm, EKS), Terraform, GitHub Actions with OIDC,
  Prometheus/Grafana, load testing and an incident drill.
- **FDE:** what the role is, staged coding with changing requirements, decomposition practice, LLM
  basics, RAG with an eval set, agents over MCP, messy customer data, regulated-customer design, a
  take-home dry run, demos and customer role-play. Modeled on published OpenAI, Anthropic, Palantir
  and Databricks loops.
- **Design and career:** Hello Interview, ByteByteGo and Gaurav Sen case studies, LLD machine
  coding, CS fundamentals, resume, STAR stories, mocks and referrals.

Resources lean on what engineers recommend most in Hacker News and Reddit threads (DDIA, CMU
15-445, MIT 6.824, Kubernetes the Hard Way, Cantrill, the Builders' Library, the SRE book, Hello
Interview); the Library tab's reference shelf lists them by track.

Weekdays are about 1.5 to 2 hours: two problems plus one design, backend, infra or FDE item.
Saturdays carry a deep dive or a timed mock; Sundays are the lab plus a weekly review. The plan
always starts on a Monday. If you fall behind, Settings can push the whole plan back a week.

When the plan's content changes, `plan.version` goes up and existing progress is migrated on the
next load (`src/data/migrate-v1.json` maps v1 task ids to v2), so checked tasks carry over.

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
2. Import this repo in Vercel and set **Root Directory** to `prep`.
3. Add two environment variables: `MONGODB_URI` and `APP_PASSCODE`. Everything else in
   `.env.example` is optional: push keys are generated on first use and stored in MongoDB, and
   setting `CRON_SECRET` locks the reminder endpoint to callers that know it.
4. Deploy, open the site on your phone, sign in, and install it (Android: Install app; iPhone: Share,
   then Add to Home Screen). Then Settings, Turn on reminders.

### Reminder timing

`vercel.json` schedules the reminder job at 08:00 and 21:00 India time, which matches the default
settings and works on Vercel's free plan. To use other hours, add the repository secrets
`BLOCK26_URL` and `BLOCK26_CRON_SECRET` (and set the same value as `CRON_SECRET` in Vercel); the workflow in `.github/workflows/block26-reminders.yml`
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
