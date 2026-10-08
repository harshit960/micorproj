# Kosh — money, savings & loans tracker

Installable, offline-capable PWA for tracking income/expenses, savings goals and money lent/borrowed.

- **Guest mode** — data stays in `localStorage` on the device.
- **Google sign-in (optional)** — data syncs to Firestore (`kosh_users/{uid}/…`) on the `hangout-c0d41` Firebase project. Guest data is migrated to the cloud on first sign-in.

## Dev

```bash
npm install
npm run dev
npm run build
```

## Credit card statements

Cards tab → Import: PDF (incl. password-protected), CSV or XLSX. Parsing runs entirely in the
browser (`src/lib/statements/`): bank-agnostic line/table heuristics, merchant categorisation,
bill payments skipped, deterministic ids so re-imports never duplicate. If nothing can be read,
signed-in users can opt in to `api/statement.ts` (Gemini) with long numbers/emails masked.

## Firebase setup (one-time, in the hangout-c0d41 console)

> Sync needs a Firestore database. Until it exists the app keeps data on the device and shows a
> "Not syncing" banner; it uploads automatically once the database works.

1. **Authentication → Sign-in method** → enable **Google**.
2. **Authentication → Settings → Authorized domains** → add your deploy domain (e.g. `harshit.art`).
3. **Firestore** → create the database if it doesn't exist, then merge the block in `firestore.rules` into the project's rules.

Config can be overridden with `VITE_FIREBASE_*` env vars (see `src/lib/firebase.ts`).

## AI analysis (Gemini)

`api/analyze.ts` is a Vercel Function that calls Gemini. The key never reaches the browser.

- Set **`GEMINI_API_KEY`** in the Vercel project's Environment Variables (Production + Preview), then redeploy.
- Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`).
- Only signed-in users can call it (their Firebase ID token is verified server-side).
- The client sends aggregated totals only — no transaction notes or names of people.
