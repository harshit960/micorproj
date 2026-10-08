import { useRef, useState, type ReactNode } from "react";
import { useData } from "../lib/data";
import { CURRENCIES, getCurrency, money, prettyDate, setCurrency, today } from "../lib/format";
import { usePrefs, type Theme } from "../lib/prefs";
import { categoryEmoji, COLLECTIONS, type CollectionName } from "../lib/types";
import { Icon, Segmented } from "./ui";

async function saveFile(name: string, body: string, type: string) {
  const file = new File([body], name, { type });
  // Installed iOS apps can't download via <a download>; the share sheet can save to Files.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const FREQ_LABEL = { weekly: "Every week", monthly: "Every month", yearly: "Every year" };

function RecurringList() {
  const { recurring, store } = useData();
  if (!recurring.length)
    return <p className="hint">No recurring items. Choose “Repeat” when adding an expense or income, such as rent or salary.</p>;
  return (
    <div className="rec-list">
      {[...recurring]
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
        .map((r) => (
          <div key={r.id} className={`rec-item ${r.active ? "" : "paused"}`}>
            <span className={`row-icon ${r.type}`}>{categoryEmoji(r.type, r.category)}</span>
            <span className="row-main">
              <span className="row-title">
                {r.note || r.category} · {money(r.type === "income" ? r.amount : -r.amount, { sign: true })}
              </span>
              <span className="row-sub">
                {FREQ_LABEL[r.freq]} · {r.active ? `next ${prettyDate(r.nextDate)}` : "paused"}
              </span>
            </span>
            <button className="btn tiny ghosty" onClick={() => store.update("recurring", r.id, { active: !r.active })}>
              {r.active ? "Pause" : "Resume"}
            </button>
            <button
              className="icon-btn small"
              aria-label="Delete recurring item"
              onClick={() => confirm("Stop this recurring item? Past entries stay.") && store.remove("recurring", r.id)}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
    </div>
  );
}

export function Settings({ onDone, install }: { onDone: () => void; install: ReactNode }) {
  const data = useData();
  const { user, signIn, logOut, store, transactions, goals } = data;
  const prefs = usePrefs();
  const [cur, setCur] = useState(getCurrency());
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const goalName = (id?: string) => goals.find((g) => g.id === id)?.name ?? "";
    const rows = [
      ["Date", "Type", "Category", "Amount", "Currency", "Goal", "Tags", "Note"],
      ...[...transactions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [t.date, t.type, t.category, t.type === "income" ? t.amount : -t.amount, getCurrency(), goalName(t.goalId), (t.tags ?? []).join(" "), t.note ?? ""]),
    ];
    saveFile(`kosh-transactions-${today()}.csv`, rows.map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv");
  };

  const exportJson = () => {
    const payload = {
      app: "kosh",
      version: 1,
      exportedAt: new Date().toISOString(),
      currency: getCurrency(),
      data: Object.fromEntries(COLLECTIONS.map((c) => [c, data[c]])),
    };
    saveFile(`kosh-backup-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const importJson = async (file: File) => {
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "kosh" || typeof parsed.data !== "object") throw new Error("That isn't a Kosh backup file.");
      const items = COLLECTIONS.flatMap((c) => (Array.isArray(parsed.data[c]) ? parsed.data[c].map((x: any) => [c, x] as const) : []));
      if (!confirm(`Restore ${items.length} items from this backup? Items with the same id are replaced; everything else is kept.`)) return;
      for (const [col, item] of items as [CollectionName, any][]) {
        if (!item?.id) continue;
        const { id, ...rest } = item;
        await store.set(col, String(id), rest);
      }
      setMsg(`Restored ${items.length} items ✓`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="form">
      <div className="profile">
        {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="avatar big">{user?.displayName?.[0] ?? "👤"}</span>}
        <div>
          <strong>{user?.displayName ?? "Guest"}</strong>
          <span className="small muted">{user?.email ?? "Data saved on this device only"}</span>
        </div>
      </div>
      <div className={`sync-pill ${store.kind}`}>{store.kind === "cloud" ? "☁️ Synced to the cloud" : "📱 Stored locally"}</div>
      {install}

      <h3 className="settings-h">Display</h3>
      <div className="field">
        <span>Theme</span>
        <Segmented<Theme>
          value={prefs.theme}
          onChange={prefs.setTheme}
          options={[
            { value: "system", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </div>
      <label className="switch-row">
        <span>
          <strong>Hide amounts</strong>
          <span className="small muted">Mask balances when using the app in public</span>
        </span>
        <input type="checkbox" className="switch" checked={prefs.hidden} onChange={prefs.toggleHidden} />
      </label>
      <label className="field">
        <span>Currency</span>
        <select
          value={cur}
          onChange={(e) => {
            setCurrency(e.target.value);
            setCur(e.target.value);
            location.reload();
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code}>{c.code}</option>
          ))}
        </select>
      </label>

      <h3 className="settings-h">
        <Icon name="repeat" size={16} /> Recurring
      </h3>
      <RecurringList />

      <h3 className="settings-h">Your data</h3>
      <div className="row2">
        <button className="btn ghost" onClick={exportCsv} disabled={!transactions.length}>
          <Icon name="download" size={18} /> CSV
        </button>
        <button className="btn ghost" onClick={exportJson}>
          <Icon name="download" size={18} /> Backup
        </button>
      </div>
      <button className="btn ghost" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={18} /> Restore from backup
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = "";
        }}
      />
      {msg && <p className="small center">{msg}</p>}

      <h3 className="settings-h">Account</h3>
      {user ? (
        <button className="btn ghost" onClick={() => logOut().then(onDone)}>
          Sign out
        </button>
      ) : (
        <>
          <button className="btn google" onClick={() => signIn().then(onDone)}>
            <Icon name="google" /> Sign in to sync
          </button>
          <button className="btn ghost" onClick={() => logOut().then(onDone)}>
            Back to welcome screen
          </button>
        </>
      )}
    </div>
  );
}
