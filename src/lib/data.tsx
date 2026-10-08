import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { createCloudStore, createLocalStore, localItemCount, migrateLocalToCloud, type Store } from "./store";
import type { Goal, Loan, Transaction } from "./types";

interface DataCtx {
  ready: boolean;
  user: User | null;
  guest: boolean;
  store: Store;
  transactions: Transaction[];
  goals: Goal[];
  loans: Loan[];
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

  const store = useMemo(() => (user ? createCloudStore(user.uid) : createLocalStore()), [user]);

  useEffect(() => {
    if (!authReady) return;
    const onErr = (e: Error) => setError(e.message);
    const unsubs = [
      store.subscribe("transactions", setTransactions, onErr),
      store.subscribe("goals", setGoals, onErr),
      store.subscribe("loans", setLoans, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [store, authReady]);

  const value: DataCtx = {
    ready: authReady,
    user,
    guest,
    store,
    transactions,
    goals,
    loans,
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
