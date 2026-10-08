import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, type CollectionName, type Collections } from "./types";

type Item<C extends CollectionName> = Collections[C];
type Listener<C extends CollectionName> = (items: Item<C>[]) => void;

export interface Store {
  kind: "local" | "cloud";
  subscribe<C extends CollectionName>(col: C, cb: Listener<C>, onError?: (e: Error) => void): () => void;
  add<C extends CollectionName>(col: C, data: Omit<Item<C>, "id">): Promise<void>;
  /** Create-or-replace with a caller-chosen id (idempotent: recurring runs, backup restore). */
  set<C extends CollectionName>(col: C, id: string, data: Omit<Item<C>, "id">): Promise<void>;
  update<C extends CollectionName>(col: C, id: string, data: Partial<Item<C>>): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
}

export const newId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");

const localKey = (col: CollectionName) => `kosh:${col}`;

function readLocal<C extends CollectionName>(col: C): Item<C>[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(col)) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal<C extends CollectionName>(col: C, items: Item<C>[]) {
  try {
    localStorage.setItem(localKey(col), JSON.stringify(items));
  } catch {
    /* storage unavailable: keep in-memory only */
  }
}

export function createLocalStore(): Store {
  const listeners = new Map<CollectionName, Set<Listener<any>>>();
  const cache = new Map<CollectionName, any[]>();
  const get = <C extends CollectionName>(col: C): Item<C>[] => {
    if (!cache.has(col)) cache.set(col, readLocal(col));
    return cache.get(col)!;
  };
  const set = <C extends CollectionName>(col: C, items: Item<C>[]) => {
    cache.set(col, items);
    writeLocal(col, items);
    listeners.get(col)?.forEach((l) => l(items));
  };

  return {
    kind: "local",
    subscribe(col, cb) {
      if (!listeners.has(col)) listeners.set(col, new Set());
      listeners.get(col)!.add(cb);
      cb(get(col));
      return () => listeners.get(col)!.delete(cb);
    },
    async add(col, data) {
      set(col, [...get(col), { ...data, id: newId() } as any]);
    },
    async set(col, id, data) {
      set(col, [...get(col).filter((x) => x.id !== id), { ...data, id } as any]);
    },
    async update(col, id, data) {
      set(col, get(col).map((x) => (x.id === id ? { ...x, ...data } : x)) as any);
    },
    async remove(col, id) {
      set(col, get(col).filter((x) => x.id !== id) as any);
    },
  };
}

const userCol = (uid: string, col: CollectionName) => collection(db, "kosh_users", uid, col);

// Firestore rejects `undefined` field values.
const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function createCloudStore(uid: string, onWriteError: (e: Error) => void): Store {
  // Firestore applies writes to its local cache immediately (snapshots update right away) but
  // only resolves the promise once the server acks — which never happens offline. Don't make
  // the UI wait for that; surface failures (e.g. rules rejections) through onWriteError.
  const fire = (p: Promise<unknown>) => {
    p.catch((e) => onWriteError(e));
    return Promise.resolve();
  };
  return {
    kind: "cloud",
    subscribe(col, cb, onError) {
      return onSnapshot(
        userCol(uid, col),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }))),
        (e) => onError?.(e),
      );
    },
    async add(col, data) {
      return fire(setDoc(doc(userCol(uid, col), newId()), clean(data as object)));
    },
    async set(col, id, data) {
      return fire(setDoc(doc(userCol(uid, col), id), clean(data as object)));
    },
    async update(col, id, data) {
      // An explicit `undefined` means "clear this field".
      const patch = Object.fromEntries(Object.entries(data as object).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
      return fire(updateDoc(doc(userCol(uid, col), id), patch));
    },
    async remove(col, id) {
      return fire(deleteDoc(doc(userCol(uid, col), id)));
    },
  };
}

export function localItemCount() {
  return COLLECTIONS.reduce((n, c) => n + readLocal(c).length, 0);
}

/** Copy guest data into the signed-in user's Firestore space, then clear it locally. */
export async function migrateLocalToCloud(uid: string) {
  const batch = writeBatch(db);
  for (const col of COLLECTIONS) {
    for (const item of readLocal(col)) {
      const { id, ...rest } = item as any;
      batch.set(doc(userCol(uid, col), id || newId()), clean(rest));
    }
  }
  await batch.commit();
  COLLECTIONS.forEach((c) => {
    try {
      localStorage.removeItem(localKey(c));
    } catch {
      /* ignore */
    }
  });
}
