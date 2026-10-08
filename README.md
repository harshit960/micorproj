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

## Firebase setup (one-time, in the hangout-c0d41 console)

1. **Authentication → Sign-in method** → enable **Google**.
2. **Authentication → Settings → Authorized domains** → add your deploy domain (e.g. `harshit.art`).
3. **Firestore** → create the database if it doesn't exist, then merge the block in `firestore.rules` into the project's rules.

Config can be overridden with `VITE_FIREBASE_*` env vars (see `src/lib/firebase.ts`).
