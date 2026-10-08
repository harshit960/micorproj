import { useCallback, useEffect, useState } from "react";
import { useData } from "./lib/data";
import { usePWA } from "./lib/pwa";
import { BudgetForm, ContributeForm, GoalForm, LoanForm, RecurringForm, RepayForm, TxForm } from "./components/forms";
import { RecurringScreen } from "./screens/recurring";
import { Settings } from "./components/settings";
import { Icon, Sheet } from "./components/ui";
import { ActivityScreen, HomeScreen, InsightsScreen, LoansScreen, SavingsScreen, type Open, type Tab } from "./screens/screens";

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

function InstallSection() {
  const pwa = usePWA();
  if (pwa.installed) return <div className="sync-pill cloud">📲 Installed as an app</div>;
  if (pwa.canInstall)
    return (
      <button className="btn primary" onClick={pwa.install}>
        <Icon name="download" /> Install Kosh app
      </button>
    );
  if (pwa.showIOSHint)
    return (
      <div className="install-hint">
        <strong>Install on iPhone</strong>
        <span>
          Tap <ShareGlyph /> <b>Share</b> in Safari, then <b>Add to Home Screen</b>.
        </span>
      </div>
    );
  return null;
}

const ShareGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ verticalAlign: "-3px" }}>
    <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" />
  </svg>
);

function InstallCard() {
  const pwa = usePWA();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("kosh:install-dismissed") === "1";
    } catch {
      return false;
    }
  });
  if (hidden || pwa.installed || !(pwa.canInstall || pwa.showIOSHint)) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("kosh:install-dismissed", "1");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="install-card">
      <img src="/icons/icon-192.png" alt="" />
      <div className="row-main">
        <strong>Get the Kosh app</strong>
        <span className="small muted">
          {pwa.canInstall ? "Works offline, opens full-screen." : (
            <>
              Tap <ShareGlyph /> then <b>Add to Home Screen</b>
            </>
          )}
        </span>
      </div>
      {pwa.canInstall && (
        <button className="btn tiny" onClick={pwa.install}>
          Install
        </button>
      )}
      <button className="icon-btn small" onClick={dismiss} aria-label="Dismiss">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function UpdateToast() {
  const pwa = usePWA();
  if (!pwa.updateReady) return null;
  return (
    <div className="toast" role="status">
      <span>A new version is ready</span>
      <button className="btn tiny" onClick={pwa.applyUpdate}>
        Reload
      </button>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "activity", label: "Activity", icon: "list" },
  { id: "recurring", label: "Recurring", icon: "repeat" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "savings", label: "Savings", icon: "piggy" },
  { id: "loans", label: "Loans", icon: "hand" },
];

const TITLES: Record<Open["kind"], (o: Open) => string> = {
  tx: (o) => (o.item ? "Edit transaction" : (o as any).type === "transfer" ? "Move to savings" : "New transaction"),
  goal: (o) => (o.item ? "Edit goal" : "New savings goal"),
  contribute: (o) => `${(o.item as any).emoji} ${(o.item as any).name}`,
  loan: (o) => (o.item ? "Edit record" : "Lend or borrow"),
  repay: () => "Record repayment",
  recurring: (o) => (o.item ? "Edit recurring" : (o as any).preset?.note ? `Add ${(o as any).preset.note}` : "New recurring item"),
  budget: (o) => (o.item ? `${(o.item as any).category} budget` : "New monthly budget"),
};

export default function App() {
  const { ready, user, guest, error } = useData();
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Open | null>(null);
  const [settings, setSettings] = useState(false);
  const close = useCallback(() => setSheet(null), []);
  const closeSettings = useCallback(() => setSettings(false), []);

  // Home-screen shortcuts (manifest "shortcuts") open straight into a form.
  useEffect(() => {
    if (!ready || (!user && !guest)) return;
    const params = new URLSearchParams(location.search);
    const add = params.get("add");
    if (!add) return;
    if (add === "expense" || add === "income") setSheet({ kind: "tx", type: add });
    else if (add === "savings") setSheet({ kind: "tx", type: "transfer" });
    else if (add === "loan") {
      setTab("loans");
      setSheet({ kind: "loan" });
    }
    history.replaceState(null, "", location.pathname);
  }, [ready, user, guest]);

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
    else if (tab === "insights") setSheet({ kind: "budget" });
    else if (tab === "recurring") setSheet({ kind: "recurring" });
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
      {tab === "home" && <InstallCard />}
      <UpdateToast />

      <main>
        {tab === "home" && <HomeScreen open={setSheet} go={setTab} />}
        {tab === "activity" && <ActivityScreen open={setSheet} />}
        {tab === "recurring" && (
          <RecurringScreen onEdit={(r) => setSheet({ kind: "recurring", item: r })} onAdd={(preset) => setSheet({ kind: "recurring", preset })} />
        )}
        {tab === "insights" && <InsightsScreen open={setSheet} />}
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
        {sheet?.kind === "tx" && <TxForm key={sheet.item?.id ?? "new"} initial={sheet.item} defaultType={sheet.type} defaultGoalId={sheet.goalId} onDone={close} />}
        {sheet?.kind === "goal" && <GoalForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
        {sheet?.kind === "contribute" && <ContributeForm goal={sheet.item} onDone={close} />}
        {sheet?.kind === "loan" && <LoanForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
        {sheet?.kind === "repay" && <RepayForm loan={sheet.item} onDone={close} />}
        {sheet?.kind === "recurring" && (
          <RecurringForm key={sheet.item?.id ?? sheet.preset?.note ?? "new"} initial={sheet.item} preset={sheet.preset} onDone={close} />
        )}
        {sheet?.kind === "budget" && <BudgetForm key={sheet.item?.id ?? "new"} initial={sheet.item} onDone={close} />}
      </Sheet>

      <Sheet open={settings} onClose={closeSettings} title="Account">
        <Settings onDone={closeSettings} install={<InstallSection />} />
      </Sheet>
    </div>
  );
}
