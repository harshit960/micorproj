import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { createCloudStore, createLocalStore, localItemCount, migrateLocalToCloud, type Store } from "./store";
import { addPeriod } from "./calc";
import { today } from "./format";
import type { Budget, Goal, Loan, Recurring, Transaction } from "./types";

interface DataCtx {
  ready: boolean;
  user: User | null;
  guest: boolean;
  store: Store;
  transactions: Transaction[];
  goals: Goal[];
  loans: Loan[];
  recurring: Recurring[];
  budgets: Budget[];
  error: string | null;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  continueAsGuest: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

const GUEST_KEY = "kosh:guest";
const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guest, setGuest] = useState(readGuest);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (u && localItemCount() > 0) {
          try {
            await migrateLocalToCloud(u.uid);
          } catch (e) {
            setError("Couldn't move your guest data to the cloud: " + (e as Error).message);
          }
        }
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  const store = useMemo(
    () => (user ? createCloudStore(user.uid, (e) => setError("Couldn't save to the cloud: " + e.message)) : createLocalStore()),
    [user],
  );

  useEffect(() => {
    if (!authReady) return;
    const onErr = (e: Error) => setError(e.message);
    const unsubs = [
      store.subscribe("transactions", setTransactions, onErr),
      store.subscribe("goals", setGoals, onErr),
      store.subscribe("loans", setLoans, onErr),
      store.subscribe("recurring", setRecurring, onErr),
      store.subscribe("budgets", setBudgets, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [store, authReady]);

  // Post any recurring transactions that have come due. Transaction ids are derived from
  // (rule, date) so two devices running this at once write the same doc, not duplicates.
  const running = useRef(false);
  useEffect(() => {
    if (!authReady || running.current) return;
    const t = today();
    const due = recurring.filter((r) => r.active && r.nextDate <= t);
    if (!due.length) return;
    running.current = true;
    (async () => {
      for (const r of due) {
        let next = r.nextDate;
        for (let i = 0; next <= t && i < 120; i++) {
          await store.set("transactions", `rec_${r.id}_${next}`, {
            type: r.type,
            amount: r.amount,
            category: r.category,
            note: r.note,
            tags: r.tags,
            recurringId: r.id,
            date: next,
            createdAt: Date.now(),
          });
          next = addPeriod(next, r.freq, r.anchorDay);
        }
        await store.update("recurring", r.id, { nextDate: next });
      }
    })()
      .catch((e) => setError("Couldn't post recurring items: " + (e as Error).message))
      .finally(() => (running.current = false));
  }, [recurring, store, authReady]);

  const value: DataCtx = {
    ready: authReady,
    user,
    guest,
    store,
    transactions,
    goals,
    loans,
    recurring,
    budgets,
    error,
    async signIn() {
      setError(null);
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e: any) {
        if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
          await signInWithRedirect(auth, googleProvider);
        } else if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") {
          setError(e?.message ?? "Sign-in failed");
        }
      }
    },
    async logOut() {
      await signOut(auth);
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch {
        /* ignore */
      }
      setGuest(false);
    },
    continueAsGuest() {
      try {
        localStorage.setItem(GUEST_KEY, "1");
      } catch {
        /* ignore */
      }
      setGuest(true);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
