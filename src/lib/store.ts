import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocFromServer,
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

export function createCloudStore(
  uid: string,
  onWriteError: (e: Error) => void,
  onPending?: (col: CollectionName, pending: boolean) => void,
): Store {
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
        { includeMetadataChanges: true },
        (snap) => {
          onPending?.(col, snap.metadata.hasPendingWrites);
          cb(snap.docs.map((d) => ({ ...(d.data() as any), id: d.id })));
        },
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

export type CloudStatus = "ok" | "missing-db" | "denied" | "offline" | "error";

/**
 * Ask the server directly whether this user's cloud space is usable. Uses Firestore's REST
 * API rather than the SDK: when the database doesn't exist the SDK only reports "client is
 * offline", while REST says exactly what's wrong (404 database missing / 403 rules).
 */
export async function checkCloud(uid: string, idToken: string): Promise<{ status: CloudStatus; detail?: string }> {
  if (!navigator.onLine) return { status: "offline" };
  const projectId = db.app.options.projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/kosh_users/${uid}/meta/ping`;
  let res: Response;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    res = await fetch(url, { headers: { authorization: `Bearer ${idToken}` }, signal: ctrl.signal });
    clearTimeout(t);
  } catch {
    return { status: "offline" };
  }
  if (res.ok) return { status: "ok" };
  const body = await res.json().catch(() => ({}) as any);
  const msg: string = body?.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 404) return /database .* does not exist/i.test(msg) ? { status: "missing-db", detail: msg } : { status: "ok" }; // 404 doc = fine
  if (res.status === 403) return { status: "denied", detail: msg };
  if (res.status === 401) {
    // Token not accepted by REST: a token-less probe still reveals a missing database…
    const anon = await fetch(url).catch(() => null);
    const anonMsg: string = anon ? ((await anon.json().catch(() => ({}))) as any)?.error?.message ?? "" : "";
    if (anon?.status === 404 && /database .* does not exist/i.test(anonMsg)) return { status: "missing-db", detail: anonMsg };
    // …otherwise let the SDK decide (it handles its own auth).
    try {
      await getDocFromServer(doc(db, "kosh_users", uid, "meta", "ping"));
      return { status: "ok" };
    } catch (e: any) {
      return { status: e?.code === "permission-denied" ? "denied" : e?.code === "unavailable" ? "offline" : "error", detail: e?.message };
    }
  }
  return { status: res.status >= 500 ? "offline" : "error", detail: msg };
}

/** Copy guest/offline data into the signed-in user's Firestore space, then clear it locally. */
export async function migrateLocalToCloud(uid: string) {
  const items = COLLECTIONS.flatMap((col) => readLocal(col).map((item) => [col, item] as const));
  // Firestore batches are capped at 500 writes.
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    for (const [col, item] of items.slice(i, i + 400)) {
      const { id, ...rest } = item as any;
      batch.set(doc(userCol(uid, col), id || newId()), clean(rest));
    }
    await batch.commit();
  }
  COLLECTIONS.forEach((c) => {
    try {
      localStorage.removeItem(localKey(c));
    } catch {
      /* ignore */
    }
  });
}
