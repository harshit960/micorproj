import { monthKey } from "./format";
import { sum, type Frequency, type Goal, type Recurring, type Transaction } from "./types";

/** Spendable balance: income − expenses − money moved into savings. */
export const balanceOf = (txs: Transaction[]) =>
  txs.reduce((b, t) => b + (t.type === "income" ? t.amount : -t.amount), 0);

/** Goal total = savings added directly + net money moved in from the balance. */
export const goalSaved = (g: Goal, txs: Transaction[]) =>
  sum(g.contributions) + sum(txs.filter((t) => t.type === "transfer" && t.goalId === g.id));

export function monthTotals(txs: Transaction[], month: string) {
  const m = txs.filter((t) => monthKey(t.date) === month);
  return {
    income: sum(m.filter((t) => t.type === "income")),
    expense: sum(m.filter((t) => t.type === "expense")),
    saved: sum(m.filter((t) => t.type === "transfer")),
  };
}

export function spendByCategory(txs: Transaction[], month: string) {
  const map = new Map<string, number>();
  txs
    .filter((t) => t.type === "expense" && monthKey(t.date) === month)
    .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function spendByTag(txs: Transaction[], month: string) {
  const map = new Map<string, number>();
  txs
    .filter((t) => t.type === "expense" && monthKey(t.date) === month)
    .forEach((t) => t.tags?.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + t.amount)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function allTags(txs: Transaction[]) {
  const count = new Map<string, number>();
  txs.forEach((t) => t.tags?.forEach((tag) => count.set(tag, (count.get(tag) ?? 0) + 1)));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function addPeriod(date: string, freq: Frequency, anchorDay?: number) {
  const [y, m, dd] = date.split("-").map(Number);
  const d = freq === "weekly" ? dd : (anchorDay ?? dd);
  let next: Date;
  if (freq === "weekly") next = new Date(y, m - 1, dd + 7);
  else {
    // m is 1-based, so month index `m - 1 + k` is k months later.
    // Clamp to month end; anchorDay keeps Jan 31 → Feb 28 → Mar 31 from drifting to the 28th.
    const k = freq === "monthly" ? 1 : freq === "quarterly" ? 3 : 12;
    const last = new Date(y, m - 1 + k + 1, 0).getDate();
    next = new Date(y, m - 1 + k, Math.min(d, last));
  }
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

// ---------- forecasting ----------

const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * Average monthly flows from recent history. Uses up to `lookback` complete months that have
 * any activity; with no complete months yet, extrapolates the current month from its pace.
 */
export function monthlyAverages(txs: Transaction[], now: string, lookback = 6) {
  const cur = now.slice(0, 7);
  const months: string[] = [];
  for (let i = 1; i <= lookback; i++) {
    const m = shiftMonth(cur, -i);
    if (txs.some((t) => t.date.startsWith(m))) months.push(m);
  }
  if (months.length) {
    const tot = months.map((m) => monthTotals(txs, m));
    const avg = (k: "income" | "expense" | "saved") => tot.reduce((s, t) => s + t[k], 0) / months.length;
    return { income: avg("income"), expense: avg("expense"), moved: avg("saved"), basis: months.length, extrapolated: false };
  }
  const t = monthTotals(txs, cur);
  const f = daysInMonth(cur) / Math.max(1, Number(now.slice(8, 10)));
  // Income usually lands once (salary) rather than daily, so don't scale it up.
  return { income: t.income, expense: t.expense * f, moved: t.saved, basis: 0, extrapolated: true };
}

/** How this month's spending is tracking against the month's length. */
export function spendingPace(txs: Transaction[], now: string) {
  const cur = now.slice(0, 7);
  const day = Number(now.slice(8, 10));
  const dim = daysInMonth(cur);
  const spent = monthTotals(txs, cur).expense;
  return { spent, projected: day >= dim ? spent : (spent / day) * dim, day, daysInMonth: dim };
}

/** Average monthly amount going into a goal over the last `months` months (transfers + direct adds). */
export function goalMonthlyRate(g: Goal, txs: Transaction[], now: string, months = 3) {
  const since = shiftMonth(now.slice(0, 7), -(months - 1)) + "-01";
  const moved = sum(txs.filter((t) => t.type === "transfer" && t.goalId === g.id && t.date >= since));
  const added = sum(g.contributions.filter((c) => c.date >= since));
  // Don't divide by months that predate the goal.
  const created = new Date(g.createdAt);
  const createdKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-01`;
  const start = createdKey > since ? createdKey : since;
  const [sy, sm] = start.split("-").map(Number);
  const [ny, nm] = now.split("-").map(Number);
  const span = Math.max(1, (ny - sy) * 12 + (nm - sm) + 1);
  return (moved + added) / span;
}

export function goalEta(g: Goal, txs: Transaction[], now: string) {
  const saved = goalSaved(g, txs);
  const left = g.target - saved;
  if (left <= 0) return { done: true as const };
  const rate = goalMonthlyRate(g, txs, now);
  if (rate <= 0) return { done: false as const, rate, months: null };
  const months = Math.ceil(left / rate);
  return { done: false as const, rate, months, month: shiftMonth(now.slice(0, 7), months) };
}

// ---------- recurring ----------

export const PER_MONTH: Record<Frequency, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

/** Average monthly value of a recurring rule (weekly ×4.33, yearly ÷12…). */
export const monthlyEquivalent = (r: Recurring) => r.amount * PER_MONTH[r.freq];

/** Every occurrence of active rules between `from` and `to` (inclusive), soonest first. */
export function upcoming(rules: Recurring[], from: string, to: string) {
  const out: { rule: Recurring; date: string }[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    let d = r.nextDate;
    for (let i = 0; d <= to && i < 60; i++) {
      if (d >= from) out.push({ rule: r, date: d });
      d = addPeriod(d, r.freq, r.anchorDay);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.rule.type.localeCompare(b.rule.type));
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
