import { useData } from "../lib/data";

const PROBLEM: Record<string, { title: string; fix: string }> = {
  "missing-db": {
    title: "Cloud sync is off: the Firestore database hasn't been created yet",
    fix: "In the Firebase console (project hangout-c0d41) open Build → Firestore Database → Create database, then paste the rules from firestore.rules into the Rules tab.",
  },
  denied: {
    title: "Cloud sync is blocked by Firestore security rules",
    fix: "In Firebase console → Firestore Database → Rules, add the kosh_users block from firestore.rules and Publish.",
  },
  error: { title: "Cloud sync isn't working right now", fix: "Kosh will keep retrying." },
};

/** One-line sync status for the Account sheet. */
export function SyncStatus() {
  const { user, cloud, syncing, recheckCloud, cloudDetail } = useData();
  if (!user) return <div className="sync-pill local">📱 Stored on this device only — sign in to sync</div>;
  const p = cloud ? PROBLEM[cloud] : undefined;
  if (p)
    return (
      <div className="sync-pill problem">
        <strong>⚠️ {p.title}</strong>
        <span>Your data is safe on this device and uploads automatically once this is fixed.</span>
        <span className="small">{p.fix}</span>
        {cloudDetail && <code className="small">{cloudDetail.slice(0, 160)}</code>}
        <button className="btn tiny ghosty" onClick={recheckCloud}>
          Check again
        </button>
      </div>
    );
  if (cloud === "checking") return <div className="sync-pill local">⏳ Connecting to the cloud…</div>;
  if (cloud === "offline") return <div className="sync-pill local">📴 Offline — changes will sync when you're back online</div>;
  return <div className="sync-pill cloud">{syncing ? "⏳ Syncing changes…" : "☁️ Synced to the cloud"}</div>;
}

/** Banner on every screen while sync is broken, so it can't fail silently. */
export function SyncBanner({ onDetails }: { onDetails: () => void }) {
  const { user, cloud } = useData();
  if (!user || !cloud || !PROBLEM[cloud]) return null;
  return (
    <button className="banner warn" onClick={onDetails}>
      ⚠️ Not syncing — {cloud === "missing-db" ? "cloud database not set up" : cloud === "denied" ? "blocked by database rules" : "can't reach the cloud"}. Saved on this device. <u>Details</u>
    </button>
  );
}
