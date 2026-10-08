import { auth } from "./firebase";
import { balanceOf, goalEta, goalSaved, monthlyAverages, monthTotals, shiftMonth, spendByCategory, spendByTag, spendingPace } from "./calc";
import { getCurrency, today } from "./format";
import { loanOutstanding, type Budget, type Goal, type Loan, type Recurring, type Transaction } from "./types";

export interface AiInsight {
  title: string;
  detail: string;
  kind: "good" | "warning" | "tip";
}
export interface AiResult {
  headline: string;
  score: number;
  insights: AiInsight[];
  actions: string[];
  answer: string;
  model?: string;
  at?: number;
}

const r0 = (n: number) => Math.round(n);

/**
 * Aggregated, privacy-preserving snapshot for the model: totals per month/category/goal only.
 * No transaction notes and no names of people you lent to or borrowed from.
 */
export function buildSummary(d: { transactions: Transaction[]; goals: Goal[]; loans: Loan[]; budgets: Budget[]; recurring: Recurring[] }) {
  const now = today();
  const cur = now.slice(0, 7);
  const txs = d.transactions;
  const avg = monthlyAverages(txs, now);
  const pace = spendingPace(txs, now);
  const catNow = new Map(spendByCategory(txs, cur));
  return {
    currency: getCurrency(),
    today: now,
    balance: r0(balanceOf(txs)),
    inGoals: r0(d.goals.reduce((s, g) => s + goalSaved(g, txs), 0)),
    months: Array.from({ length: 6 }, (_, i) => shiftMonth(cur, i - 5)).map((m) => {
      const t = monthTotals(txs, m);
      return {
        month: m,
        income: r0(t.income),
        expense: r0(t.expense),
        movedToSavings: r0(t.saved),
        topCategories: spendByCategory(txs, m).slice(0, 5).map(([c, a]) => [c, r0(a)]),
      };
    }),
    thisMonth: { dayOfMonth: pace.day, daysInMonth: pace.daysInMonth, spentSoFar: r0(pace.spent), projectedSpend: r0(pace.projected) },
    averages: { basisMonths: avg.basis, income: r0(avg.income), expense: r0(avg.expense), net: r0(avg.income - avg.expense) },
    budgets: d.budgets.map((b) => ({ category: b.category, monthlyLimit: b.amount, spentThisMonth: r0(catNow.get(b.category) ?? 0) })),
    goals: d.goals.map((g) => {
      const eta = goalEta(g, txs, now);
      return {
        name: g.name,
        target: g.target,
        saved: r0(goalSaved(g, txs)),
        deadline: g.deadline ?? null,
        monthlyRate: eta.done ? null : r0(eta.rate),
        projectedFinish: eta.done ? "reached" : (eta.month ?? "no recent contributions"),
      };
    }),
    loans: {
      othersOweMe: r0(d.loans.filter((l) => l.direction === "lent").reduce((s, l) => s + loanOutstanding(l), 0)),
      iOwe: r0(d.loans.filter((l) => l.direction === "borrowed").reduce((s, l) => s + loanOutstanding(l), 0)),
      overdue: d.loans.filter((l) => l.dueDate && l.dueDate < now && loanOutstanding(l) > 0).length,
    },
    recurring: d.recurring.filter((r) => r.active).map((r) => ({ type: r.type, category: r.category, amount: r.amount, freq: r.freq })),
    topTagsThisMonth: spendByTag(txs, cur).slice(0, 8).map(([t, a]) => [t, r0(a)]),
  };
}

const cacheKey = () => `kosh:ai:${auth.currentUser?.uid ?? "guest"}`;

export function cachedAnalysis(): AiResult | null {
  try {
    return JSON.parse(localStorage.getItem(cacheKey()) ?? "null");
  } catch {
    return null;
  }
}

export async function analyze(summary: ReturnType<typeof buildSummary>, question?: string): Promise<AiResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with Google to use AI analysis.");
  if (!navigator.onLine) throw new Error("You're offline — AI analysis needs a connection.");
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ summary, question }),
  });
  const data = await res.json().catch(() => ({ error: "AI request failed." }));
  if (!res.ok) throw new Error(data.error ?? "AI request failed.");
  const result = { ...data, at: Date.now() } as AiResult;
  if (!question) {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(result));
    } catch {
      /* ignore */
    }
  }
  return result;
}
