import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { daysUntil, money, monthKey, prettyDate, prettyMonth, today } from "../lib/format";
import { categoryEmoji, EXPENSE_CATEGORIES, goalSaved, loanOutstanding, loanRepaid, sum, type Goal, type Loan, type Transaction } from "../lib/types";
import { Empty, Icon, Progress, Segmented } from "../components/ui";

export type Open =
  | { kind: "tx"; item?: Transaction }
  | { kind: "goal"; item?: Goal }
  | { kind: "contribute"; item: Goal }
  | { kind: "loan"; item?: Loan }
  | { kind: "repay"; item: Loan };

type Nav = (o: Open) => void;

function TxRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  return (
    <button className="row" onClick={onClick}>
      <span className={`row-icon ${tx.type}`}>{categoryEmoji(tx.type, tx.category)}</span>
      <span className="row-main">
        <span className="row-title">{tx.note || tx.category}</span>
        <span className="row-sub">
          {tx.note ? `${tx.category} · ` : ""}
          {prettyDate(tx.date)}
        </span>
      </span>
      <span className={`row-amt ${tx.type}`}>{money(tx.type === "income" ? tx.amount : -tx.amount, { sign: true })}</span>
    </button>
  );
}

const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

export function HomeScreen({ open, go }: { open: Nav; go: (tab: Tab) => void }) {
  const { transactions, goals, loans } = useData();
  const m = monthKey(today());
  const month = transactions.filter((t) => monthKey(t.date) === m);
  const inc = sum(month.filter((t) => t.type === "income"));
  const exp = sum(month.filter((t) => t.type === "expense"));
  const balance = sum(transactions.filter((t) => t.type === "income")) - sum(transactions.filter((t) => t.type === "expense"));
  const saved = goals.reduce((s, g) => s + goalSaved(g), 0);
  const owedToMe = sum(loans.filter((l) => l.direction === "lent").map((l) => ({ amount: loanOutstanding(l) })));
  const iOwe = sum(loans.filter((l) => l.direction === "borrowed").map((l) => ({ amount: loanOutstanding(l) })));
  const recent = [...transactions].sort(byDateDesc).slice(0, 5);

  const topCats = useMemo(() => {
    const map = new Map<string, number>();
    month.filter((t) => t.type === "expense").forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [month]);

  const dueSoon = loans
    .filter((l) => l.dueDate && loanOutstanding(l) > 0 && daysUntil(l.dueDate) <= 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  return (
    <div className="screen">
      <section className="hero">
        <span className="hero-label">Net balance</span>
        <span className="hero-value">{money(balance)}</span>
        <div className="hero-split">
          <div>
            <span className="dot good" /> In · {prettyMonth(m).split(" ")[0]}
            <strong>{money(inc, { compact: true })}</strong>
          </div>
          <div>
            <span className="dot bad" /> Out
            <strong>{money(exp, { compact: true })}</strong>
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <button className="stat" onClick={() => go("savings")}>
          <span className="stat-label">Saved in goals</span>
          <span className="stat-value">{money(saved, { compact: true })}</span>
        </button>
        <button className="stat" onClick={() => go("loans")}>
          <span className="stat-label">Others owe you</span>
          <span className="stat-value good-text">{money(owedToMe, { compact: true })}</span>
        </button>
        <button className="stat" onClick={() => go("loans")}>
          <span className="stat-label">You owe</span>
          <span className="stat-value bad-text">{money(iOwe, { compact: true })}</span>
        </button>
        <div className="stat">
          <span className="stat-label">Savings rate</span>
          <span className="stat-value">{inc > 0 ? `${Math.round(((inc - exp) / inc) * 100)}%` : "—"}</span>
        </div>
      </div>

      {dueSoon.length > 0 && (
        <section className="card">
          <h3 className="card-title">Due soon</h3>
          {dueSoon.map((l) => {
            const d = daysUntil(l.dueDate!);
            return (
              <button key={l.id} className="row" onClick={() => open({ kind: "repay", item: l })}>
                <span className={`row-icon ${l.direction === "lent" ? "income" : "expense"}`}>{l.person[0]?.toUpperCase()}</span>
                <span className="row-main">
                  <span className="row-title">{l.person}</span>
                  <span className={`row-sub ${d < 0 ? "bad-text" : ""}`}>{d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : `Due in ${d}d`}</span>
                </span>
                <span className={`row-amt ${l.direction === "lent" ? "income" : "expense"}`}>{money(loanOutstanding(l))}</span>
              </button>
            );
          })}
        </section>
      )}

      {topCats.length > 0 && (
        <section className="card">
          <h3 className="card-title">Where it went this month</h3>
          <div className="bars">
            {topCats.map(([cat, amt]) => (
              <div key={cat} className="bar-row">
                <span className="bar-label">
                  {EXPENSE_CATEGORIES.find((c) => c.name === cat)?.emoji} {cat}
                </span>
                <Progress value={amt / topCats[0][1]} tone="warn" />
                <span className="bar-amt">{money(amt, { compact: true })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Recent</h3>
          {transactions.length > 5 && (
            <button className="link" onClick={() => go("activity")}>
              See all
            </button>
          )}
        </div>
        {recent.length ? (
          recent.map((t) => <TxRow key={t.id} tx={t} onClick={() => open({ kind: "tx", item: t })} />)
        ) : (
          <Empty emoji="🪙" title="No transactions yet" text="Tap + to log your first income or expense." />
        )}
      </section>
    </div>
  );
}

export function ActivityScreen({ open }: { open: Nav }) {
  const { transactions } = useData();
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [q, setQ] = useState("");
  const list = transactions
    .filter((t) => filter === "all" || t.type === filter)
    .filter((t) => !q || `${t.note ?? ""} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort(byDateDesc);

  const groups = new Map<string, Transaction[]>();
  list.forEach((t) => {
    const k = monthKey(t.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  });

  return (
    <div className="screen">
      <h1 className="screen-title">Activity</h1>
      <input className="search" placeholder="Search notes or categories" value={q} onChange={(e) => setQ(e.target.value)} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "expense", label: "Expenses" },
          { value: "income", label: "Income" },
        ]}
      />
      {groups.size === 0 && <Empty emoji="🔍" title="Nothing here" text={q ? "No matches for that search." : "Your transactions will show up here."} />}
      {[...groups.entries()].map(([k, txs]) => {
        const net = sum(txs.filter((t) => t.type === "income")) - sum(txs.filter((t) => t.type === "expense"));
        return (
          <section key={k} className="card">
            <div className="card-head">
              <h3 className="card-title">{prettyMonth(k)}</h3>
              <span className={`small ${net >= 0 ? "good-text" : "bad-text"}`}>{money(net, { sign: true })}</span>
            </div>
            {txs.map((t) => (
              <TxRow key={t.id} tx={t} onClick={() => open({ kind: "tx", item: t })} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function SavingsScreen({ open }: { open: Nav }) {
  const { goals } = useData();
  const total = goals.reduce((s, g) => s + goalSaved(g), 0);
  const target = sum(goals.map((g) => ({ amount: g.target })));
  const sorted = [...goals].sort((a, b) => goalSaved(a) / a.target - goalSaved(b) / b.target);

  return (
    <div className="screen">
      <h1 className="screen-title">Savings</h1>
      <section className="hero small-hero">
        <span className="hero-label">Total saved</span>
        <span className="hero-value">{money(total)}</span>
        {target > 0 && (
          <>
            <Progress value={total / target} tone="good" />
            <span className="hero-foot">
              {Math.round((total / target) * 100)}% of {money(target, { compact: true })} across {goals.length} goal{goals.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      </section>
      {goals.length === 0 && <Empty emoji="🐷" title="No savings goals" text="Create a goal — a trip, a gadget, an emergency fund — and watch it fill up." />}
      <div className="goal-list">
        {sorted.map((g) => {
          const s = goalSaved(g);
          const pct = s / g.target;
          const done = pct >= 1;
          const d = g.deadline ? daysUntil(g.deadline) : null;
          const perMonth = d && d > 0 && !done ? (g.target - s) / Math.max(1, d / 30) : null;
          return (
            <article key={g.id} className={`goal ${done ? "done" : ""}`}>
              <button className="goal-top" onClick={() => open({ kind: "goal", item: g })}>
                <span className="goal-emoji">{g.emoji}</span>
                <span className="row-main">
                  <span className="row-title">{g.name}</span>
                  <span className="row-sub">
                    {money(s)} of {money(g.target)}
                  </span>
                </span>
                <span className="goal-pct">{done ? "🎉" : `${Math.round(pct * 100)}%`}</span>
              </button>
              <Progress value={pct} tone="good" />
              <div className="goal-foot">
                <span className="small muted">
                  {done
                    ? "Goal reached!"
                    : d === null
                      ? `${money(g.target - s, { compact: true })} to go`
                      : d < 0
                        ? "Past target date"
                        : `${money(perMonth ?? 0, { compact: true })}/mo for ${d}d`}
                </span>
                <button className="btn tiny" onClick={() => open({ kind: "contribute", item: g })}>
                  <Icon name="plus" size={16} /> Add
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function LoansScreen({ open }: { open: Nav }) {
  const { loans } = useData();
  const [tab, setTab] = useState<"open" | "settled">("open");
  const owedToMe = sum(loans.filter((l) => l.direction === "lent").map((l) => ({ amount: loanOutstanding(l) })));
  const iOwe = sum(loans.filter((l) => l.direction === "borrowed").map((l) => ({ amount: loanOutstanding(l) })));

  const visible = loans.filter((l) => (tab === "open" ? loanOutstanding(l) > 0 : loanOutstanding(l) === 0));
  const people = new Map<string, Loan[]>();
  visible
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || b.date.localeCompare(a.date))
    .forEach((l) => {
      if (!people.has(l.person)) people.set(l.person, []);
      people.get(l.person)!.push(l);
    });

  return (
    <div className="screen">
      <h1 className="screen-title">Lent & borrowed</h1>
      <div className="stat-grid two">
        <div className="stat tinted good">
          <span className="stat-label">
            <Icon name="down" size={14} /> Others owe you
          </span>
          <span className="stat-value">{money(owedToMe)}</span>
        </div>
        <div className="stat tinted bad">
          <span className="stat-label">
            <Icon name="up" size={14} /> You owe
          </span>
          <span className="stat-value">{money(iOwe)}</span>
        </div>
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: "Open" },
          { value: "settled", label: "Settled" },
        ]}
      />
      {people.size === 0 && (
        <Empty
          emoji={tab === "open" ? "🤝" : "✅"}
          title={tab === "open" ? "All square" : "Nothing settled yet"}
          text={tab === "open" ? "Track money you lend or borrow so nothing slips through the cracks." : "Fully repaid records land here."}
        />
      )}
      {[...people.entries()].map(([person, ls]) => {
        const net = ls.reduce((s, l) => s + (l.direction === "lent" ? 1 : -1) * loanOutstanding(l), 0);
        return (
          <section key={person} className="card">
            <div className="card-head">
              <h3 className="card-title person">
                <span className="avatar">{person[0]?.toUpperCase()}</span>
                {person}
              </h3>
              {tab === "open" && <span className={`small ${net >= 0 ? "good-text" : "bad-text"}`}>{net >= 0 ? `owes you ${money(net)}` : `you owe ${money(-net)}`}</span>}
            </div>
            {ls.map((l) => {
              const left = loanOutstanding(l);
              const d = l.dueDate ? daysUntil(l.dueDate) : null;
              return (
                <div key={l.id} className="loan">
                  <button className="loan-main" onClick={() => open({ kind: "loan", item: l })}>
                    <span className="row-main">
                      <span className="row-title">
                        {l.direction === "lent" ? "You lent" : "You borrowed"} {money(l.amount)}
                      </span>
                      <span className="row-sub">
                        {prettyDate(l.date)}
                        {l.note ? ` · ${l.note}` : ""}
                        {d !== null && left > 0 && <span className={d < 0 ? "bad-text" : ""}> · {d < 0 ? `${-d}d overdue` : `due ${prettyDate(l.dueDate!)}`}</span>}
                      </span>
                    </span>
                    <Icon name="chevron" size={18} />
                  </button>
                  <Progress value={loanRepaid(l) / l.amount} tone={l.direction === "lent" ? "good" : "warn"} />
                  <div className="goal-foot">
                    <span className="small muted">{left > 0 ? `${money(left)} left` : "Settled"}</span>
                    {left > 0 && (
                      <button className="btn tiny" onClick={() => open({ kind: "repay", item: l })}>
                        <Icon name="check" size={16} /> {l.direction === "lent" ? "Got paid" : "Paid back"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export type Tab = "home" | "activity" | "savings" | "loans";
