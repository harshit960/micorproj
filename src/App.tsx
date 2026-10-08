import { useCallback, useState } from "react";
import { useData } from "./lib/data";
import { CURRENCIES, getCurrency, setCurrency } from "./lib/format";
import { ContributeForm, GoalForm, LoanForm, RepayForm, TxForm } from "./components/forms";
import { Icon, Sheet } from "./components/ui";
import { ActivityScreen, HomeScreen, LoansScreen, SavingsScreen, type Open, type Tab } from "./screens/screens";

function Welcome() {
  const { signIn, continueAsGuest, error } = useData();
  return (
    <div className="welcome">
      <div className="welcome-art" aria-hidden>
        <div className="coin c1">₹</div>
        <div className="coin c2">$</div>
        <div className="coin c3">€</div>
      </div>
      <h1>
        Kosh<span className="accent-text">.</span>
      </h1>
      <p className="welcome-sub">Spending, savings goals and money you've lent — in one calm little place.</p>
      <ul className="welcome-points">
        <li>💸 Log income & expenses in two taps</li>
        <li>🐷 Fill up savings goals</li>
        <li>🤝 Never forget who owes whom</li>
      </ul>
      <div className="welcome-actions">
        <button className="btn google" onClick={signIn}>
          <Icon name="google" /> Continue with Google
        </button>
        <button className="btn ghost" onClick={continueAsGuest}>
          Use without an account
        </button>
        <p className="small muted center">Guest data stays on this device. Sign in any time to sync it.</p>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

function Settings({ onDone }: { onDone: () => void }) {
  const { user, signIn, logOut, store } = useData();
  const [cur, setCur] = useState(getCurrency());
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

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "activity", label: "Activity", icon: "list" },
  { id: "savings", label: "Savings", icon: "piggy" },
  { id: "loans", label: "Loans", icon: "hand" },
];

const TITLES: Record<Open["kind"], (o: Open) => string> = {
  tx: (o) => (o.item ? "Edit transaction" : "New transaction"),
  goal: (o) => (o.item ? "Edit goal" : "New savings goal"),
  contribute: (o) => `${(o.item as any).emoji} ${(o.item as any).name}`,
  loan: (o) => (o.item ? "Edit record" : "Lend or borrow"),
  repay: () => "Record repayment",
};

export default function App() {
  const { ready, user, guest, error } = useData();
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Open | null>(null);
  const [settings, setSettings] = useState(false);
  const close = useCallback(() => setSheet(null), []);
  const closeSettings = useCallback(() => setSettings(false), []);

  if (!ready)
    return (
      <div className="splash">
        <div className="spinner" />
      </div>
    );
  if (!user && !guest) return <Welcome />;

  const fab = () => {
    if (tab === "savings") setSheet({ kind: "goal" });
    else if (tab === "loans") setSheet({ kind: "loan" });
    else setSheet({ kind: "tx" });
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="small muted">{greet}</span>
          <strong className="topbar-name">{user?.displayName?.split(" ")[0] ?? "there"} 👋</strong>
        </div>
        <button className="avatar-btn" onClick={() => setSettings(true)} aria-label="Settings">
          {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" />}
        </button>
      </header>

      {error && <div className="banner">{error}</div>}

      <main>
        {tab === "home" && <HomeScreen open={setSheet} go={setTab} />}
        {tab === "activity" && <ActivityScreen open={setSheet} />}
        {tab === "savings" && <SavingsScreen open={setSheet} />}
        {tab === "loans" && <LoansScreen open={setSheet} />}
      </main>

      <button className="fab" onClick={fab} aria-label="Add">
        <Icon name="plus" size={28} />
      </button>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <Sheet open={!!sheet} onClose={close} title={sheet ? TITLES[sheet.kind](sheet) : ""}>
        {sheet?.kind === "tx" && <TxForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
        {sheet?.kind === "goal" && <GoalForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
        {sheet?.kind === "contribute" && <ContributeForm goal={sheet.item} onDone={close} />}
        {sheet?.kind === "loan" && <LoanForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
        {sheet?.kind === "repay" && <RepayForm loan={sheet.item} onDone={close} />}
      </Sheet>

      <Sheet open={settings} onClose={closeSettings} title="Account">
        <Settings onDone={closeSettings} />
      </Sheet>
    </div>
  );
}
