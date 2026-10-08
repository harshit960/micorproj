import { useState } from "react";
import { useData } from "../lib/data";
import { analyze, buildSummary, cachedAnalysis, type AiResult } from "../lib/ai";
import { monthlyAverages, spendingPace } from "../lib/calc";
import { money, today } from "../lib/format";
import { Icon, Progress } from "../components/ui";


// ---------- This month's pace ----------

export function PaceCard() {
  const { transactions, budgets } = useData();
  const now = today();
  const p = spendingPace(transactions, now);
  const avg = monthlyAverages(transactions, now);
  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const ref = budgetTotal || (avg.extrapolated ? 0 : avg.expense);
  if (!p.spent) return null;
  const ratio = ref ? p.projected / ref : 0;
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">This month's pace</h3>
        <span className="small muted">
          day {p.day} of {p.daysInMonth}
        </span>
      </div>
      <p className="pace-line">
        Spent <b>{money(p.spent)}</b> so far — on track for <b className={ratio > 1.05 ? "bad-text" : ""}>{money(p.projected)}</b> by month end.
      </p>
      {ref > 0 && (
        <>
          <Progress value={p.projected / ref} tone={ratio > 1.05 ? "bad" : ratio > 0.9 ? "warn" : "accent"} />
          <p className="small muted" style={{ margin: "8px 0 12px" }}>
            {ratio > 1.05 ? "⚠ " : ""}
            {Math.round(ratio * 100)}% of {budgetTotal ? "your total budgets" : "your usual monthly spend"} ({money(ref, { compact: true })})
          </p>
        </>
      )}
    </section>
  );
}

// ---------- AI analysis ----------

const KIND_ICON = { good: "✅", warning: "⚠️", tip: "💡" } as const;
const SUGGESTED = ["Can I afford a ₹20,000 trip next month?", "Where can I cut spending?", "How do I reach my goals faster?"];

export function AiCard({ onSignIn }: { onSignIn: () => void }) {
  const data = useData();
  const [result, setResult] = useState<AiResult | null>(cachedAnalysis);
  const [busy, setBusy] = useState<"analysis" | "ask" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; a: string } | null>(null);

  const run = async (question?: string) => {
    setErr(null);
    setBusy(question ? "ask" : "analysis");
    try {
      const r = await analyze(buildSummary(data), question);
      if (question) setAnswer({ q: question, a: r.answer || r.headline });
      else setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!data.user)
    return (
      <section className="card ai-card">
        <h3 className="card-title">✨ AI money coach</h3>
        <p className="hint">Get a health score, personalised insights and answers to questions like “can I afford this?”. Sign in with Google to use it.</p>
        <button className="btn google" style={{ margin: "12px 0 14px" }} onClick={onSignIn}>
          <Icon name="google" /> Sign in to unlock
        </button>
      </section>
    );

  return (
    <section className="card ai-card">
      <div className="card-head">
        <h3 className="card-title">✨ AI money coach</h3>
        {result?.at && <span className="small muted">{new Date(result.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
      </div>

      {result ? (
        <div className="ai-result">
          <div className="ai-score">
            <div className="ring" style={{ ["--p" as string]: Math.max(0, Math.min(100, result.score)) }}>
              <span>{result.score}</span>
            </div>
            <p className="ai-headline">{result.headline}</p>
          </div>
          <ul className="ai-insights">
            {result.insights.map((i, n) => (
              <li key={n} className={`ai-insight ${i.kind}`}>
                <span className="ai-kind" aria-label={i.kind}>
                  {KIND_ICON[i.kind] ?? "•"}
                </span>
                <span>
                  <b>{i.title}</b>
                  <span className="muted"> {i.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {result.actions.length > 0 && (
            <div className="ai-actions">
              <span className="small muted">Next steps</span>
              <ol>
                {result.actions.map((a, n) => (
                  <li key={n}>{a}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <p className="hint">Gemini looks at your monthly totals, budgets, goals and debts (never your notes or people's names) and tells you how you're doing.</p>
      )}

      <button className="btn primary" style={{ margin: "12px 0" }} disabled={busy !== null} onClick={() => run()}>
        {busy === "analysis" ? <span className="spinner small" /> : "✨"} {result ? "Refresh analysis" : "Analyse my finances"}
      </button>

      <form
        className="ai-ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) run(q.trim());
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your money…" maxLength={400} aria-label="Ask the AI coach" />
        <button className="btn tiny" disabled={!q.trim() || busy !== null}>
          {busy === "ask" ? <span className="spinner small" /> : "Ask"}
        </button>
      </form>
      {!answer && (
        <div className="tag-scroll" style={{ marginTop: 8 }}>
          {SUGGESTED.map((s) => (
            <button key={s} className="tag" onClick={() => setQ(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {answer && (
        <div className="ai-answer">
          <span className="small muted">{answer.q}</span>
          <p>{answer.a}</p>
        </div>
      )}
      {err && <p className="form-error" style={{ marginTop: 8 }}>{err}</p>}
      <p className="small muted" style={{ margin: "10px 0 12px" }}>
        AI suggestions can be wrong — double-check before making big decisions.
      </p>
    </section>
  );
}
