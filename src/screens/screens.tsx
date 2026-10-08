import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { allTags, balanceOf, goalEta, goalSaved, monthTotals, shiftMonth, spendByCategory, spendByTag } from "../lib/calc";
import { AiCard, ForecastCard, PaceCard } from "./plan";
import { daysUntil, money, monthKey, prettyDate, prettyMonth, today } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import {
  categoryEmoji,
  EXPENSE_CATEGORIES,
  loanOutstanding,
  loanRepaid,
  sum,
  type Budget,
  type Goal,
  type Loan,
  type Transaction,
  type TxType,
} from "../lib/types";
import { Empty, Icon, MonthPicker, Progress, Segmented } from "../components/ui";

export type Open =
  | { kind: "tx"; item?: Transaction; type?: TxType; goalId?: string }
  | { kind: "goal"; item?: Goal }
  | { kind: "contribute"; item: Goal }
  | { kind: "loan"; item?: Loan }
  | { kind: "repay"; item: Loan }
  | { kind: "budget"; item?: Budget };

export type Tab = "home" | "activity" | "insights" | "savings" | "loans";
type Nav = (o: Open) => void;

const catEmoji = (name: string) => EXPENSE_CATEGORIES.find((c) => c.name === name)?.emoji ?? "•";

function TxRow({ tx, goals, onClick }: { tx: Transaction; goals: Goal[]; onClick: () => void }) {
  if (tx.type === "transfer") {
    const g = goals.find((x) => x.id === tx.goalId);
    const into = tx.amount > 0;
    return (
      <button className="row" onClick={onClick}>
        <span className="row-icon transfer">{g?.emoji ?? "🐷"}</span>
        <span className="row-main">
          <span className="row-title">{tx.note || (into ? `To ${g?.name ?? "savings"}` : `From ${g?.name ?? "savings"}`)}</span>
          <span className="row-sub">
            {into ? "Moved to savings" : "Withdrawn from savings"} · {prettyDate(tx.date)}
          </span>
        </span>
        <span className="row-amt transfer">{money(-tx.amount, { sign: true })}</span>
      </button>
    );
  }
  return (
    <button className="row" onClick={onClick}>
      <span className={`row-icon ${tx.type}`}>{categoryEmoji(tx.type, tx.category)}</span>
      <span className="row-main">
        <span className="row-title">
          {tx.note || tx.category}
          {tx.recurringId && <span className="rec-badge" title="Recurring">🔁</span>}
        </span>
        <span className="row-sub">
          {tx.note ? `${tx.category} · ` : ""}
          {prettyDate(tx.date)}
          {tx.tags?.map((t) => (
            <span key={t} className="tag-mini">
              #{t}
            </span>
          ))}
        </span>
      </span>
      <span className={`row-amt ${tx.type}`}>{money(tx.type === "income" ? tx.amount : -tx.amount, { sign: true })}</span>
    </button>
  );
}

const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

function BudgetRow({ b, spent, onClick }: { b: Budget; spent: number; onClick: () => void }) {
  const pct = spent / b.amount;
  const over = spent > b.amount;
  return (
    <button className="budget-row" onClick={onClick}>
      <div className="budget-top">
        <span className="row-title">
          {catEmoji(b.category)} {b.category}
        </span>
        <span className={`small ${over ? "bad-text" : "muted"}`}>
          {over ? `⚠ Over by ${money(spent - b.amount, { compact: true })}` : `${money(b.amount - spent, { compact: true })} left`}
        </span>
      </div>
      <Progress value={pct} tone={over ? "bad" : pct > 0.8 ? "warn" : "accent"} />
      <span className="small muted">
        {money(spent, { compact: true })} of {money(b.amount, { compact: true })}
      </span>
    </button>
  );
}

export function HomeScreen({ open, go }: { open: Nav; go: (tab: Tab) => void }) {
  const { transactions, goals, loans, budgets } = useData();
  const prefs = usePrefs();
  const m = monthKey(today());
  const { income: inc, expense: exp, saved: savedThisMonth } = monthTotals(transactions, m);
  const balance = balanceOf(transactions);
  const inGoals = goals.reduce((s, g) => s + goalSaved(g, transactions), 0);
  const owedToMe = sum(loans.filter((l) => l.direction === "lent").map((l) => ({ amount: loanOutstanding(l) })));
  const iOwe = sum(loans.filter((l) => l.direction === "borrowed").map((l) => ({ amount: loanOutstanding(l) })));
  const recent = [...transactions].sort(byDateDesc).slice(0, 5);
  const catSpend = new Map(spendByCategory(transactions, m));
  const hotBudgets = [...budgets].sort((a, b) => (catSpend.get(b.category) ?? 0) / b.amount - (catSpend.get(a.category) ?? 0) / a.amount).slice(0, 3);

  const dueSoon = loans
    .filter((l) => l.dueDate && loanOutstanding(l) > 0 && daysUntil(l.dueDate) <= 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  return (
    <div className="screen">
      <section className="hero">
        <div className="hero-head">
          <span className="hero-label">Available balance</span>
          <button className="hero-eye" onClick={prefs.toggleHidden} aria-label={prefs.hidden ? "Show amounts" : "Hide amounts"}>
            <Icon name={prefs.hidden ? "eyeoff" : "eye"} size={18} />
          </button>
        </div>
        <span className="hero-value">{money(balance)}</span>
        <div className="hero-split three">
          <div>
            <span className="dot good" /> In
            <strong>{money(inc, { compact: true })}</strong>
          </div>
          <div>
            <span className="dot bad" /> Out
            <strong>{money(exp, { compact: true })}</strong>
          </div>
          <div>
            <span className="dot save" /> Saved
            <strong>{money(savedThisMonth, { compact: true })}</strong>
          </div>
        </div>
        <span className="hero-foot">{prettyMonth(m)}</span>
      </section>

      <div className="quick">
        <button onClick={() => open({ kind: "tx", type: "expense" })}>
          <span className="quick-icon expense">−</span>Expense
        </button>
        <button onClick={() => open({ kind: "tx", type: "income" })}>
          <span className="quick-icon income">+</span>Income
        </button>
        <button onClick={() => open({ kind: "tx", type: "transfer" })}>
          <span className="quick-icon transfer">🐷</span>To savings
        </button>
        <button onClick={() => open({ kind: "loan" })}>
          <span className="quick-icon loan">🤝</span>Lend
        </button>
      </div>

      <div className="stat-grid">
        <button className="stat" onClick={() => go("savings")}>
          <span className="stat-label">In savings goals</span>
          <span className="stat-value">{money(inGoals, { compact: true })}</span>
        </button>
        <div className="stat">
          <span className="stat-label">Savings rate</span>
          <span className="stat-value">{inc > 0 ? `${Math.round(((inc - exp) / inc) * 100)}%` : "—"}</span>
        </div>
        <button className="stat" onClick={() => go("loans")}>
          <span className="stat-label">Others owe you</span>
          <span className="stat-value good-text">{money(owedToMe, { compact: true })}</span>
        </button>
        <button className="stat" onClick={() => go("loans")}>
          <span className="stat-label">You owe</span>
          <span className="stat-value bad-text">{money(iOwe, { compact: true })}</span>
        </button>
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

      {hotBudgets.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">Budgets</h3>
            <button className="link" onClick={() => go("insights")}>
              All
            </button>
          </div>
          <div className="budget-list">
            {hotBudgets.map((b) => (
              <BudgetRow key={b.id} b={b} spent={catSpend.get(b.category) ?? 0} onClick={() => open({ kind: "budget", item: b })} />
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
          recent.map((t) => <TxRow key={t.id} tx={t} goals={goals} onClick={() => open({ kind: "tx", item: t })} />)
        ) : (
          <Empty emoji="🪙" title="No transactions yet" text="Tap + to log your first income or expense." />
        )}
      </section>
    </div>
  );
}

export function ActivityScreen({ open }: { open: Nav }) {
  const { transactions, goals } = useData();
  const [filter, setFilter] = useState<"all" | TxType>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const tags = useMemo(() => allTags(transactions), [transactions]);
  const goalName = (id?: string) => goals.find((g) => g.id === id)?.name ?? "";
  const list = transactions
    .filter((t) => filter === "all" || t.type === filter)
    .filter((t) => !tag || t.tags?.includes(tag))
    .filter((t) => !q || `${t.note ?? ""} ${t.category} ${t.tags?.join(" ") ?? ""} ${goalName(t.goalId)}`.toLowerCase().includes(q.toLowerCase().replace(/^#/, "")))
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
      <input className="search" type="search" placeholder="Search notes, categories, #tags" value={q} onChange={(e) => setQ(e.target.value)} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "expense", label: "Out" },
          { value: "income", label: "In" },
          { value: "transfer", label: "Savings" },
        ]}
      />
      {tags.length > 0 && (
        <div className="tag-scroll" role="group" aria-label="Filter by tag">
          {tags.map((t) => (
            <button key={t} className={`tag ${tag === t ? "on" : ""}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}
      {tag && (
        <div className="filter-summary">
          <span>
            <b>#{tag}</b> · {list.length} item{list.length === 1 ? "" : "s"} · spent{" "}
            {money(sum(list.filter((t) => t.type === "expense")))}
          </span>
          <button className="link" onClick={() => setTag(null)}>
            Clear
          </button>
        </div>
      )}
      {groups.size === 0 && <Empty emoji="🔍" title="Nothing here" text={q || tag ? "No matches for that filter." : "Your transactions will show up here."} />}
      {[...groups.entries()].map(([k, txs]) => {
        const net = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);
        return (
          <section key={k} className="card">
            <div className="card-head">
              <h3 className="card-title">{prettyMonth(k)}</h3>
              <span className={`small ${net >= 0 ? "good-text" : "bad-text"}`}>{money(net, { sign: true })}</span>
            </div>
            {txs.map((t) => (
              <TxRow key={t.id} tx={t} goals={goals} onClick={() => open({ kind: "tx", item: t })} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ---------- Insights ----------

function barPath(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function TrendChart({ months, txs, selected, onSelect }: { months: string[]; txs: Transaction[]; selected: string; onSelect: (m: string) => void }) {
  const data = months.map((m) => ({ m, ...monthTotals(txs, m) }));
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const W = 320,
    H = 150,
    top = 8,
    base = 124,
    gw = W / data.length,
    bw = 14;
  const focus = data.find((d) => d.m === (hover ?? selected)) ?? data[data.length - 1];
  return (
    <figure className="chart">
      <div className="chart-head">
        <div className="legend">
          <span>
            <i className="sw in" /> Income
          </span>
          <span>
            <i className="sw out" /> Expenses
          </span>
        </div>
        <div className="chart-readout" aria-live="polite">
          <b>{prettyMonth(focus.m).split(" ")[0].slice(0, 3)}</b> In {money(focus.income, { compact: true })} · Out {money(focus.expense, { compact: true })}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income and expenses over the last six months">
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={base - (base - top) * f} y2={base - (base - top) * f} className="grid" />
        ))}
        {data.map((d, i) => {
          const cx = gw * i + gw / 2;
          const hi = ((base - top) * d.income) / max;
          const he = ((base - top) * d.expense) / max;
          const active = d.m === (hover ?? selected);
          return (
            <g key={d.m} className={active ? "active" : ""}>
              <path d={barPath(cx - bw - 1, base - hi, bw, hi, 4)} className="bar in" />
              <path d={barPath(cx + 1, base - he, bw, he, 4)} className="bar out" />
              <text x={cx} y={H - 6} textAnchor="middle" className={`tick ${active ? "on" : ""}`}>
                {prettyMonth(d.m).slice(0, 3)}
              </text>
              <rect
                x={gw * i}
                y={0}
                width={gw}
                height={H}
                fill="transparent"
                onPointerEnter={() => setHover(d.m)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onSelect(d.m)}
                style={{ cursor: "pointer" }}
              >
                <title>
                  {prettyMonth(d.m)}: income {money(d.income)}, expenses {money(d.expense)}
                </title>
              </rect>
            </g>
          );
        })}
        <line x1="0" x2={W} y1={base} y2={base} className="axis" />
      </svg>
      <figcaption className="sr-only">
        {data.map((d) => `${prettyMonth(d.m)}: income ${money(d.income)}, expenses ${money(d.expense)}`).join("; ")}
      </figcaption>
    </figure>
  );
}

function ShareBars({ rows, total, label }: { rows: [string, number][]; total: number; label: (k: string) => string }) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <div className="bars">
      {rows.map(([k, amt]) => (
        <div key={k} className="bar-row">
          <span className="bar-label">{label(k)}</span>
          <Progress value={amt / max} />
          <span className="bar-amt">
            {money(amt, { compact: true })}
            <span className="muted"> {Math.round((amt / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function InsightsScreen({ open }: { open: Nav }) {
  const { transactions, budgets, signIn } = useData();
  const current = monthKey(today());
  const [month, setMonth] = useState(current);
  const t = monthTotals(transactions, month);
  const cats = spendByCategory(transactions, month);
  const tags = spendByTag(transactions, month);
  const catSpend = new Map(cats);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  // For the month in progress, compare with the same point last month (not last month's full total).
  const isCurrent = month === current;
  const dayCut = today().slice(8, 10);
  const prevKey = shiftMonth(month, -1);
  const prevExpense = sum(
    transactions.filter((x) => x.type === "expense" && x.date.startsWith(prevKey) && (!isCurrent || x.date.slice(8, 10) <= dayCut)),
  );
  const delta = prevExpense > 0 ? (t.expense - prevExpense) / prevExpense : null;
  const budgetTotal = sum(budgets);

  return (
    <div className="screen">
      <h1 className="screen-title">Insights</h1>
      <MonthPicker value={month} onChange={setMonth} max={current} />

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Income</span>
          <span className="stat-value good-text">{money(t.income, { compact: true })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Expenses</span>
          <span className="stat-value bad-text">{money(t.expense, { compact: true })}</span>
          {delta !== null && (
            <span className={`small ${delta > 0 ? "bad-text" : "good-text"}`}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))}% vs {isCurrent ? "same day last month" : "last month"}
            </span>
          )}
        </div>
        <div className="stat">
          <span className="stat-label">Moved to savings</span>
          <span className="stat-value">{money(t.saved, { compact: true })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Net (in − out)</span>
          <span className={`stat-value ${t.income - t.expense >= 0 ? "good-text" : "bad-text"}`}>{money(t.income - t.expense, { compact: true })}</span>
        </div>
      </div>

      {month === current && <PaceCard />}
      <AiCard onSignIn={signIn} />

      <section className="card">
        <h3 className="card-title">Last 6 months</h3>
        <TrendChart months={months} txs={transactions} selected={month} onSelect={setMonth} />
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Budgets</h3>
          <button className="link" onClick={() => open({ kind: "budget" })}>
            + Add
          </button>
        </div>
        {budgets.length === 0 ? (
          <p className="hint">Set a monthly limit for a category (like Food or Shopping) and track how close you are.</p>
        ) : (
          <div className="budget-list">
            {budgets.map((b) => (
              <BudgetRow key={b.id} b={b} spent={catSpend.get(b.category) ?? 0} onClick={() => open({ kind: "budget", item: b })} />
            ))}
            <p className="small muted">
              Total budgeted {money(budgetTotal, { compact: true })} · spent in budgeted categories{" "}
              {money(sum(budgets.map((b) => ({ amount: catSpend.get(b.category) ?? 0 }))), { compact: true })}
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">Spending by category</h3>
        {cats.length ? <ShareBars rows={cats} total={t.expense} label={(k) => `${catEmoji(k)} ${k}`} /> : <p className="hint">No expenses in {prettyMonth(month)}.</p>}
      </section>

      {tags.length > 0 && (
        <section className="card">
          <h3 className="card-title">Spending by tag</h3>
          <ShareBars rows={tags} total={t.expense} label={(k) => `#${k}`} />
          <p className="small muted" style={{ marginTop: -4, paddingBottom: 10 }}>
            An expense with several tags counts toward each of them.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------- Savings ----------

export function SavingsScreen({ open }: { open: Nav }) {
  const { goals, transactions } = useData();
  const total = goals.reduce((s, g) => s + goalSaved(g, transactions), 0);
  const target = sum(goals.map((g) => ({ amount: g.target })));
  const sorted = [...goals].sort((a, b) => goalSaved(a, transactions) / a.target - goalSaved(b, transactions) / b.target);

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
      {goals.length > 0 && (
        <button className="btn ghost" onClick={() => open({ kind: "tx", type: "transfer" })}>
          <Icon name="arrow" size={18} /> Move money to savings
        </button>
      )}
      <ForecastCard />
      {goals.length === 0 && <Empty emoji="🐷" title="No savings goals" text="Create a goal — a trip, a gadget, an emergency fund — then move money into it from your balance." />}
      <div className="goal-list">
        {sorted.map((g) => {
          const s = goalSaved(g, transactions);
          const pct = s / g.target;
          const done = pct >= 1;
          const d = g.deadline ? daysUntil(g.deadline) : null;
          const perMonth = d && d > 0 && !done ? (g.target - s) / Math.max(1, d / 30) : null;
          const eta = done ? null : goalEta(g, transactions, today());
          const late = !!(eta && !eta.done && g.deadline && (eta.months == null || eta.month! > g.deadline.slice(0, 7)));
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
                <span className="small muted goal-eta">
                  {done
                    ? "Goal reached!"
                    : d === null
                      ? `${money(g.target - s, { compact: true })} to go`
                      : d < 0
                        ? "Past target date"
                        : `Need ${money(perMonth ?? 0, { compact: true })}/mo for ${d}d`}
                  {!done && eta && !eta.done && (
                    <span className={late ? "bad-text" : ""}>
                      {eta.months == null ? "No savings in the last 3 months" : `At your pace: ${prettyMonth(eta.month!)}${late ? " ⚠ after target" : ""}`}
                    </span>
                  )}
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

// ---------- Loans ----------

async function remind(l: Loan) {
  const text = `Hi ${l.person}, just a friendly reminder about the ${money(loanOutstanding(l))}${l.note ? ` for ${l.note}` : ""}${
    l.dueDate ? ` (due ${prettyDate(l.dueDate)})` : ""
  }. Thanks! 🙂`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
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
                      <span className="btn-pair">
                        {l.direction === "lent" && (
                          <button className="btn tiny ghosty" onClick={() => remind(l)} aria-label={`Send ${l.person} a reminder`}>
                            <Icon name="share" size={15} /> Remind
                          </button>
                        )}
                        <button className="btn tiny" onClick={() => open({ kind: "repay", item: l })}>
                          <Icon name="check" size={16} /> {l.direction === "lent" ? "Got paid" : "Paid back"}
                        </button>
                      </span>
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
