import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { analyze, buildSummary, cachedAnalysis, type AiResult } from "../lib/ai";
import { balanceOf, goalSaved, monthlyAverages, shiftMonth, spendingPace } from "../lib/calc";
import { money, prettyMonth, today } from "../lib/format";
import { Icon, Progress } from "../components/ui";

const shortMonth = (m: string) => prettyMonth(m).slice(0, 3);

// ---------- Savings forecast ----------

function ProjectionChart({ base, perMonth, extra }: { base: number; perMonth: number; extra: number }) {
  const now = today().slice(0, 7);
  const N = 12;
  const pts = Array.from({ length: N + 1 }, (_, i) => ({ m: shiftMonth(now, i), cur: base + perMonth * i, plus: base + (perMonth + extra) * i }));
  const [hover, setHover] = useState<number | null>(null);
  const vals = pts.flatMap((p) => (extra > 0 ? [p.cur, p.plus] : [p.cur]));
  const lo = Math.min(0, ...vals),
    hi = Math.max(1, ...vals);
  const W = 320,
    H = 150,
    L = 4,
    R = 316,
    T = 10,
    B = 122;
  const x = (i: number) => L + ((R - L) * i) / N;
  const y = (v: number) => B - ((B - T) * (v - lo)) / (hi - lo || 1);
  const line = (k: "cur" | "plus") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const focus = pts[hover ?? N];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * N);
    setHover(Math.max(0, Math.min(N, i)));
  };
  return (
    <figure className="chart">
      <div className="chart-head">
        <div className="legend">
          <span>
            <i className="sw in" /> At current pace
          </span>
          {extra > 0 && (
            <span>
              <i className="sw out dashed" /> With +{money(extra, { compact: true })}/mo
            </span>
          )}
        </div>
        <div className="chart-readout" aria-live="polite">
          <b>{prettyMonth(focus.m)}</b> {money(focus.cur, { compact: true })}
          {extra > 0 && <> · {money(focus.plus, { compact: true })}</>}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected total savings over the next 12 months" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {lo < 0 && <line x1={L} x2={R} y1={y(0)} y2={y(0)} className="grid zero" />}
        <line x1={L} x2={R} y1={B} y2={B} className="axis" />
        <path d={`${line("cur")}L${x(N)},${B}L${x(0)},${B}Z`} className="area in" />
        <path d={line("cur")} className="ln in" />
        {extra > 0 && <path d={line("plus")} className="ln out dashed" />}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={B} className="crosshair" />}
        <circle cx={x(hover ?? N)} cy={y(focus.cur)} r="4.5" className="dot in" />
        {extra > 0 && <circle cx={x(hover ?? N)} cy={y(focus.plus)} r="4.5" className="dot out" />}
        {[0, 3, 6, 9, 12].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === N ? "end" : "middle"} className="tick">
            {i === 0 ? "Now" : shortMonth(pts[i].m)}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        In 12 months at your current pace: {money(pts[N].cur)}
        {extra > 0 ? `; with the extra amount: ${money(pts[N].plus)}` : ""}.
      </figcaption>
    </figure>
  );
}

export function ForecastCard() {
  const { transactions, goals } = useData();
  const now = today();
  const avg = useMemo(() => monthlyAverages(transactions, now), [transactions, now]);
  const net = avg.income - avg.expense;
  const base = balanceOf(transactions) + goals.reduce((s, g) => s + goalSaved(g, transactions), 0);
  const [extra, setExtra] = useState(0);
  // Slider moves in round amounts (~1% of income): 100, 500, 1000, 2000, 5000…
  const step = [100, 250, 500, 1000, 2000, 5000, 10000].find((s) => s >= Math.max(avg.income, 10000) / 100) ?? 10000;
  const maxExtra = Math.max(step * 20, Math.ceil((avg.income * 0.5) / step) * step);

  if (!transactions.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">Savings forecast</h3>
        <span className="small muted">{avg.extrapolated ? "from this month so far" : `avg of last ${avg.basis} mo`}</span>
      </div>
      <div className="fc-stats">
        <div>
          <span className="small muted">Avg in</span>
          <strong>{money(avg.income, { compact: true })}</strong>
        </div>
        <div>
          <span className="small muted">Avg out</span>
          <strong>{money(avg.expense, { compact: true })}</strong>
        </div>
        <div>
          <span className="small muted">You keep / mo</span>
          <strong className={net >= 0 ? "good-text" : "bad-text"}>{money(net, { compact: true, sign: true })}</strong>
        </div>
      </div>
      <ProjectionChart base={base} perMonth={net} extra={extra} />
      <label className="whatif">
        <span>
          What if I save <b>{money(extra)}</b> more a month?
        </span>
        <input type="range" min={0} max={maxExtra} step={step} value={extra} onChange={(e) => setExtra(Number(e.target.value))} aria-label="Extra savings per month" />
      </label>
      <p className="fc-summary">
        {net + extra > 0 ? (
          <>
            In 12 months you'd have about <b>{money(base + (net + extra) * 12)}</b>
            {extra > 0 && <> — {money(extra * 12)} more than at your current pace</>}.
          </>
        ) : (
          <>
            At this pace your savings <b>shrink by {money(Math.abs(net + extra))}/mo</b>. Try trimming your top category or moving the slider to see what it
            takes.
          </>
        )}
      </p>
    </section>
  );
}

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
