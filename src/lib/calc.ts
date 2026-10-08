import { monthKey } from "./format";
import { sum, type Goal, type Transaction } from "./types";

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

export function addPeriod(date: string, freq: "weekly" | "monthly" | "yearly", anchorDay?: number) {
  const [y, m, dd] = date.split("-").map(Number);
  const d = freq === "weekly" ? dd : (anchorDay ?? dd);
  let next: Date;
  if (freq === "weekly") next = new Date(y, m - 1, dd + 7);
  else if (freq === "monthly") {
    // Clamp to month end; anchorDay keeps Jan 31 → Feb 28 → Mar 31 from drifting to the 28th.
    const last = new Date(y, m + 1, 0).getDate();
    next = new Date(y, m, Math.min(d, last));
  } else next = new Date(y + 1, m - 1, Math.min(d, new Date(y + 1, m, 0).getDate()));
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
