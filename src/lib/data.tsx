import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { checkCloud, createCloudStore, createLocalStore, localItemCount, migrateLocalToCloud, type CloudStatus, type Store } from "./store";
import { addPeriod } from "./calc";
import { today } from "./format";
import type { Budget, Card, Goal, Loan, MerchantRule, Recurring, Transaction } from "./types";

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
  cards: Card[];
  merchants: MerchantRule[];
  error: string | null;
  /** Cloud sync health for signed-in users (null for guests). */
  cloud: CloudStatus | "checking" | null;
  cloudDetail?: string;
  syncing: boolean;
  recheckCloud: () => void;
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
  const [cards, setCards] = useState<Card[]>([]);
  const [merchants, setMerchants] = useState<MerchantRule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [cloud, setCloud] = useState<CloudStatus | "checking" | null>(null);
  const [cloudDetail, setCloudDetail] = useState<string>();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setCloud(u ? "checking" : null);
        setAuthReady(true);
      }),
    [],
  );

  // Verify the cloud database really works before trusting it with data. Until it does
  // (database not created, rules rejecting us…), keep everything on this device.
  const okKey = (uid: string) => `kosh:cloud-ok:${uid}`;
  const wasOk = (uid: string) => {
    try {
      return localStorage.getItem(okKey(uid)) === "1";
    } catch {
      return false;
    }
  };
  const [checkTick, setCheckTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const r = await checkCloud(user.uid, await user.getIdToken().catch(() => ""));
      if (cancelled) return;
      setCloudDetail(r.detail);
      if (r.status === "ok") {
        try {
          localStorage.setItem(okKey(user.uid), "1");
        } catch {
          /* ignore */
        }
        if (localItemCount() > 0) {
          try {
            await migrateLocalToCloud(user.uid);
          } catch (e) {
            setError("Couldn't upload your on-device data: " + (e as Error).message);
          }
        }
      }
      if (!cancelled) setCloud(r.status);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, checkTick]);

  // Re-check when the connection comes back, and every minute while something's wrong.
  useEffect(() => {
    if (!user || cloud === "ok" || cloud === "checking") return;
    const again = () => setCheckTick((n) => n + 1);
    window.addEventListener("online", again);
    const t = setInterval(again, 60000);
    return () => {
      window.removeEventListener("online", again);
      clearInterval(t);
    };
  }, [user, cloud]);

  const useCloud = !!user && (cloud === "ok" || ((cloud === "checking" || cloud === "offline") && wasOk(user.uid)));
  const store = useMemo(
    () =>
      user && useCloud
        ? createCloudStore(
            user.uid,
            (e) => setError("Couldn't save to the cloud: " + e.message),
            (col, p) => setPending((prev) => (prev[col] === p ? prev : { ...prev, [col]: p })),
          )
        : createLocalStore(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, useCloud],
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
      store.subscribe("cards", setCards, onErr),
      store.subscribe("merchants", setMerchants, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [store, authReady]);

  // Post any recurring transactions that have come due. Transaction ids are derived from
  // (rule, date) so two devices running this at once write the same doc, not duplicates.
  const running = useRef(false);
  useEffect(() => {
    if (!authReady || running.current) return;
    const t = today();
    // Scheduled savings wait until their goal has loaded (and never post into a deleted goal).
    const due = recurring.filter((r) => r.active && r.nextDate <= t && (r.type !== "transfer" || goals.some((g) => g.id === r.goalId)));
    if (!due.length) return;
    running.current = true;
    (async () => {
      for (const r of due) {
        let next = r.nextDate;
        for (let i = 0; next <= t && i < 120; i++) {
          await store.set(
            "transactions",
            `rec_${r.id}_${next}`,
            r.type === "transfer"
              ? { type: "transfer", amount: r.amount, category: "Savings", goalId: r.goalId, note: r.note, recurringId: r.id, date: next, createdAt: Date.now() }
              : { type: r.type, amount: r.amount, category: r.category, note: r.note, tags: r.tags, recurringId: r.id, date: next, createdAt: Date.now() },
          );
          next = addPeriod(next, r.freq, r.anchorDay);
        }
        await store.update("recurring", r.id, { nextDate: next });
      }
    })()
      .catch((e) => setError("Couldn't post recurring items: " + (e as Error).message))
      .finally(() => (running.current = false));
  }, [recurring, goals, store, authReady]);

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
    cards,
    merchants,
    error,
    cloud,
    cloudDetail,
    syncing: useCloud && Object.values(pending).some(Boolean),
    recheckCloud: () => {
      setCloud("checking");
      setCheckTick((n) => n + 1);
    },
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
