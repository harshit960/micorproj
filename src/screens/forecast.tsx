import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/data";
import { balanceOf, goalMonthlyRate, goalSaved, monthlyAverages, monthTotals, shiftMonth, spendByCategory } from "../lib/calc";
import { monthsBetween, monthsToReach, nextMilestones, project, requiredMonthly, stdDev } from "../lib/forecast";
import { getCurrency, money, prettyMonth, today } from "../lib/format";
import { EXPENSE_CATEGORIES, type Goal } from "../lib/types";
import { Progress, Segmented } from "../components/ui";
import type { Open } from "./screens";

// ---------- shared scenario settings (per device) ----------

interface FcSettings {
  horizon: 6 | 12 | 36 | 60;
  annualReturn: number;
  real: boolean;
  extra: number;
  cutCategory: string;
  cutPct: number;
}
const DEFAULTS: FcSettings = { horizon: 12, annualReturn: 0, real: false, extra: 0, cutCategory: "", cutPct: 0 };
const INFLATION = 6;
const RETURNS = [
  { pct: 0, label: "0%", hint: "Cash" },
  { pct: 3.5, label: "3.5%", hint: "Savings a/c" },
  { pct: 7, label: "7%", hint: "FD / RD" },
  { pct: 12, label: "12%", hint: "Equity SIP" },
];

let settings: FcSettings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("kosh:fc") ?? "{}") };
  } catch {
    return DEFAULTS;
  }
})();
const subs = new Set<() => void>();
function useFc() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    subs.add(l);
    return () => void subs.delete(l);
  }, []);
  const set = (patch: Partial<FcSettings>) => {
    settings = { ...settings, ...patch };
    try {
      localStorage.setItem("kosh:fc", JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    subs.forEach((l) => l());
  };
  return [settings, set] as const;
}

/** Everything the forecast cards share, computed once from the data. */
function useBasis() {
  const { transactions, goals } = useData();
  return useMemo(() => {
    const now = today();
    const cur = now.slice(0, 7);
    const avg = monthlyAverages(transactions, now);
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(cur, -(i + 1))).filter((m) => transactions.some((t) => t.date.startsWith(m)));
    const nets = months.map((m) => {
      const t = monthTotals(transactions, m);
      return t.income - t.expense;
    });
    const catAvg = new Map<string, number>();
    for (const m of months.length ? months : [cur]) spendByCategory(transactions, m).forEach(([c, a]) => catAvg.set(c, (catAvg.get(c) ?? 0) + a / Math.max(1, months.length)));
    const balance = balanceOf(transactions);
    const inGoals = goals.reduce((s, g) => s + goalSaved(g, transactions), 0);
    return {
      now,
      cur,
      avg,
      net: avg.income - avg.expense,
      sd: stdDev(nets),
      balance,
      inGoals,
      base: balance + inGoals,
      topCats: [...catAvg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [transactions, goals]);
}

const horizonLabel = (h: number) => (h < 12 ? `${h} months` : h === 12 ? "1 year" : `${h / 12} years`);
const catEmoji = (c: string) => EXPENSE_CATEGORIES.find((x) => x.name === c)?.emoji ?? "•";

// ---------- chart ----------

function ProjectionChart({
  months,
  main,
  scenario,
  showRange,
}: {
  months: number;
  main: { value: number; low: number; high: number }[];
  scenario: number[] | null;
  showRange: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cur = today().slice(0, 7);
  const vals = [...main.flatMap((p) => (showRange ? [p.low, p.high] : [p.value])), ...(scenario ?? [])];
  const lo = Math.min(0, ...vals),
    hi = Math.max(1, ...vals);
  const W = 320,
    H = 156,
    L = 4,
    R = 316,
    T = 10,
    B = 126;
  const x = (i: number) => L + ((R - L) * i) / months;
  const y = (v: number) => B - ((B - T) * (v - lo)) / (hi - lo || 1);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const band =
    path(main.map((p) => p.high)) +
    main
      .map((p, i) => ({ p, i }))
      .reverse()
      .map(({ p, i }) => `L${x(i).toFixed(1)},${y(p.low).toFixed(1)}`)
      .join("") +
    "Z";
  const i = hover ?? months;
  const step = months <= 6 ? 1 : months <= 12 ? 3 : 12;
  const ticks = Array.from({ length: Math.floor(months / step) + 1 }, (_, k) => k * step);
  const tickLabel = (k: number) => (k === 0 ? "Now" : months > 12 ? `${k / 12}y` : prettyMonth(shiftMonth(cur, k)).slice(0, 3));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(months, Math.round(((e.clientX - r.left) / r.width) * months))));
  };
  return (
    <figure className="chart">
      <div className="chart-head">
        <div className="legend">
          <span>
            <i className="sw in" /> Current pace
          </span>
          {showRange && (
            <span>
              <i className="sw band" /> Likely range
            </span>
          )}
          {scenario && (
            <span>
              <i className="sw out dashed" /> With changes
            </span>
          )}
        </div>
      </div>
      <div className="chart-readout big" aria-live="polite">
        <b>{i === 0 ? "Now" : prettyMonth(shiftMonth(cur, i))}</b> {money(main[i].value, { compact: true })}
        {showRange && i > 0 && (
          <span className="muted">
            {" "}
            ({money(main[i].low, { compact: true })}–{money(main[i].high, { compact: true })})
          </span>
        )}
        {scenario && <span className="out-text"> · {money(scenario[i], { compact: true })}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected savings" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {lo < 0 && <line x1={L} x2={R} y1={y(0)} y2={y(0)} className="grid zero" />}
        <line x1={L} x2={R} y1={B} y2={B} className="axis" />
        {showRange && <path d={band} className="band" />}
        <path d={path(main.map((p) => p.value))} className="ln in" />
        {scenario && <path d={path(scenario)} className="ln out dashed" />}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={B} className="crosshair" />}
        <circle cx={x(i)} cy={y(main[i].value)} r="4.5" className="dot in" />
        {scenario && <circle cx={x(i)} cy={y(scenario[i])} r="4.5" className="dot out" />}
        {ticks.map((k) => (
          <text key={k} x={x(k)} y={H - 6} textAnchor={k === 0 ? "start" : k === months ? "end" : "middle"} className="tick">
            {tickLabel(k)}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        Projected savings in {horizonLabel(months)}: {money(main[months].value)}
        {scenario ? `; with your changes ${money(scenario[months])}` : ""}.
      </figcaption>
    </figure>
  );
}

// ---------- cards ----------

export function ForecastCard() {
  const { transactions } = useData();
  const b = useBasis();
  const [s, set] = useFc();
  const [open, setOpen] = useState(false);
  if (!transactions.length) return null;

  const cutBase = b.topCats.find(([c]) => c === s.cutCategory)?.[1] ?? 0;
  const cut = (cutBase * s.cutPct) / 100;
  const boost = s.extra + cut;
  const inf = s.real ? INFLATION : 0;
  const main = project({ base: b.base, monthly: b.net, months: s.horizon, annualReturn: s.annualReturn, inflation: inf, sd: b.sd });
  const show = (p: (typeof main)[number]) => (s.real ? p.real : p.value);
  const deflate = (p: (typeof main)[number]) => (s.real ? p.real / p.value || 1 : 1);
  const mainShown = main.map((p) => ({ value: show(p), low: p.low * deflate(p), high: p.high * deflate(p) }));
  const scen = boost > 0 ? project({ base: b.base, monthly: b.net + boost, months: s.horizon, annualReturn: s.annualReturn, inflation: inf }) : null;
  const end = main[s.horizon];
  // Shown in the same units as the total (today's money when that toggle is on).
  const growth = (end.value - end.contributed) * (s.real ? end.real / (end.value || 1) : 1);
  const step = [100, 250, 500, 1000, 2000, 5000, 10000].find((x) => x >= Math.max(b.avg.income, 10000) / 100) ?? 10000;
  const maxExtra = Math.max(step * 20, Math.ceil((b.avg.income * 0.5) / step) * step);

  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">Savings forecast</h3>
        <span className="small muted">{b.avg.extrapolated ? "from this month so far" : `avg of last ${b.avg.basis} mo`}</span>
      </div>
      <div className="fc-stats">
        <div>
          <span className="small muted">Avg in</span>
          <strong>{money(b.avg.income, { compact: true })}</strong>
        </div>
        <div>
          <span className="small muted">Avg out</span>
          <strong>{money(b.avg.expense, { compact: true })}</strong>
        </div>
        <div>
          <span className="small muted">Kept / mo</span>
          <strong className={b.net >= 0 ? "good-text" : "bad-text"}>{money(b.net, { compact: true, sign: true })}</strong>
        </div>
      </div>

      <Segmented
        value={String(s.horizon) as "6" | "12" | "36" | "60"}
        onChange={(v) => set({ horizon: Number(v) as FcSettings["horizon"] })}
        options={[
          { value: "6", label: "6M" },
          { value: "12", label: "1Y" },
          { value: "36", label: "3Y" },
          { value: "60", label: "5Y" },
        ]}
      />
      <ProjectionChart months={s.horizon} main={mainShown} scenario={scen ? scen.map((p) => (s.real ? p.real : p.value)) : null} showRange={b.sd > 0} />

      <p className="fc-summary">
        {b.net + boost > 0 || s.annualReturn > 0 ? (
          <>
            In {horizonLabel(s.horizon)} you'd have about <b>{money(show(end))}</b>
            {s.real && <span className="muted"> in today's money</span>}
            {s.annualReturn > 0 && growth > 0 && (
              <>
                {" "}
                — including <b className="good-text">{money(growth, { compact: true })}</b> from {s.annualReturn}% returns
              </>
            )}
            .
            {scen && (
              <>
                {" "}
                Your changes add <b className="out-text">{money((s.real ? scen[s.horizon].real : scen[s.horizon].value) - show(end), { compact: true })}</b>.
              </>
            )}
            {b.sd > 0 && (
              <span className="muted">
                {" "}
                Your monthly savings vary by about ±{money(b.sd, { compact: true })}, hence the range.
              </span>
            )}
          </>
        ) : (
          <>
            At this pace your savings <b className="bad-text">shrink by {money(Math.abs(b.net + boost))}/mo</b>. Open “Try changes” to see what it takes to turn it
            around.
          </>
        )}
      </p>

      <button className={`fc-toggle ${open ? "on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>⚙️ Try changes & assumptions</span>
        <span className="small muted">{boost > 0 || s.annualReturn || s.real ? "customised" : ""}</span>
        <span className="chev">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="fc-panel">
          <label className="whatif">
            <span>
              Save <b>{money(s.extra)}</b> more a month
            </span>
            <input type="range" min={0} max={maxExtra} step={step} value={s.extra} onChange={(e) => set({ extra: Number(e.target.value) })} aria-label="Extra savings per month" />
          </label>

          {b.topCats.length > 0 && (
            <div className="whatif">
              <span>
                Cut{" "}
                <select className="inline-select" value={s.cutCategory} onChange={(e) => set({ cutCategory: e.target.value, cutPct: e.target.value ? s.cutPct || 20 : 0 })}>
                  <option value="">a category…</option>
                  {b.topCats.map(([c, a]) => (
                    <option key={c} value={c}>
                      {catEmoji(c)} {c} (~{money(a, { compact: true })}/mo)
                    </option>
                  ))}
                </select>{" "}
                by <b>{s.cutPct}%</b>
                {cut > 0 && <span className="muted"> = {money(cut)}/mo</span>}
              </span>
              <input type="range" min={0} max={50} step={5} value={s.cutPct} disabled={!s.cutCategory} onChange={(e) => set({ cutPct: Number(e.target.value) })} aria-label="Cut percentage" />
            </div>
          )}

          <div className="whatif">
            <span>Expected return on savings</span>
            <div className="ret-chips">
              {RETURNS.map((r) => (
                <button key={r.pct} className={`ret-chip ${s.annualReturn === r.pct ? "on" : ""}`} onClick={() => set({ annualReturn: r.pct })}>
                  <b>{r.label}</b>
                  <span>{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="switch-row">
            <span>
              <strong>Show in today's money</strong>
              <span className="small muted">Adjust for ~{INFLATION}% yearly inflation</span>
            </span>
            <input type="checkbox" className="switch" checked={s.real} onChange={(e) => set({ real: e.target.checked })} />
          </label>
          {(boost > 0 || s.annualReturn || s.real) && (
            <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => set({ ...DEFAULTS, horizon: s.horizon })}>
              Reset
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function SafetyCard() {
  const { transactions } = useData();
  const b = useBasis();
  const [s] = useFc();
  if (!transactions.length || b.avg.expense <= 0) return null;
  const runway = b.base / b.avg.expense;
  const target = b.avg.expense * 6;
  const gap = Math.max(0, target - b.base);
  const gapMonths = gap > 0 ? monthsToReach(target, b.base, b.net, s.annualReturn) : 0;
  const milestones = nextMilestones(b.base, 3, getCurrency()).map((v) => ({ v, m: monthsToReach(v, b.base, b.net, s.annualReturn) }));
  return (
    <section className="card">
      <h3 className="card-title">Safety net</h3>
      <div className="runway">
        <div className="runway-num">
          <strong className={runway >= 6 ? "good-text" : runway < 3 ? "bad-text" : ""}>{runway.toFixed(1)}</strong>
          <span className="small muted">months</span>
        </div>
        <div className="row-main">
          <span>
            Your savings ({money(b.base, { compact: true })}) would cover <b>{runway.toFixed(1)} months</b> of spending if income stopped.
          </span>
          <Progress value={runway / 6} tone={runway >= 6 ? "good" : runway < 3 ? "bad" : "warn"} />
          <span className="small muted">
            {gap > 0
              ? `${money(gap, { compact: true })} more for a 6-month emergency fund${gapMonths ? ` · ${prettyMonth(shiftMonth(b.cur, gapMonths))} at your pace` : ""}`
              : "✓ You have a 6-month emergency fund"}
          </span>
        </div>
      </div>
      <h4 className="sub-h">Next milestones</h4>
      <div className="milestones">
        {milestones.map(({ v, m }) => (
          <div key={v} className={`milestone ${m == null ? "never" : ""}`}>
            <strong>{money(v, { compact: true })}</strong>
            <span className="small muted">{m == null ? "not at this pace" : m === 0 ? "reached" : prettyMonth(shiftMonth(b.cur, m))}</span>
            {m != null && m > 0 && <span className="small">{m < 12 ? `${m} mo` : `${(m / 12).toFixed(1)} yrs`}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GoalPlanCard({ open }: { open: (o: Open) => void }) {
  const { goals, transactions } = useData();
  const b = useBasis();
  const rows = goals
    .map((g) => {
      const saved = goalSaved(g, transactions);
      const left = Math.max(0, g.target - saved);
      const rate = goalMonthlyRate(g, transactions, b.now);
      const monthsLeft = g.deadline ? Math.max(1, monthsBetween(b.cur, g.deadline.slice(0, 7))) : null;
      const need = monthsLeft ? requiredMonthly(g.target, saved, monthsLeft) : null;
      return { g, saved, left, rate, need, monthsLeft, overdue: !!g.deadline && g.deadline < b.now };
    })
    .filter((r) => r.left > 0);
  if (!rows.length) return null;
  const totalNeed = rows.reduce((s, r) => s + (r.need ?? 0), 0);
  const totalRate = rows.reduce((s, r) => s + r.rate, 0);
  const share = b.net > 0 ? totalNeed / b.net : null;
  return (
    <section className="card">
      <h3 className="card-title">Goal plan</h3>
      {totalNeed > 0 && (
        <p className="fc-summary" style={{ marginTop: 0 }}>
          Hitting every goal on time needs <b>{money(totalNeed)}/mo</b>
          {share !== null ? (
            <>
              {" "}
              — <b className={share > 1 ? "bad-text" : ""}>{Math.round(share * 100)}%</b> of what you keep each month
            </>
          ) : (
            " — but you're not saving anything right now"
          )}
          . You've been putting in <b>{money(totalRate)}/mo</b>.
        </p>
      )}
      <div className="goal-plan">
        {rows.map(({ g, saved, rate, need, monthsLeft, overdue }) => {
          const short = need !== null ? need - rate : 0;
          const status = overdue ? "overdue" : need === null ? "open" : short <= 0.5 ? "ok" : "short";
          return (
            <button key={g.id} className="gp-row" onClick={() => open({ kind: "contribute", item: g as Goal })}>
              <span className="goal-chip-emoji">{g.emoji}</span>
              <span className="row-main">
                <span className="row-title">{g.name}</span>
                <span className="row-sub">
                  {money(saved, { compact: true })} / {money(g.target, { compact: true })}
                  {monthsLeft && !overdue ? ` · ${monthsLeft} mo left` : ""}
                </span>
                <span className="small">
                  {need !== null && !overdue ? (
                    <>
                      Needs {money(need, { compact: true })}/mo · putting {money(rate, { compact: true })}/mo
                    </>
                  ) : overdue ? (
                    "Target date has passed — edit the goal to set a new one"
                  ) : (
                    <>Putting {money(rate, { compact: true })}/mo · no target date</>
                  )}
                </span>
              </span>
              <span className={`gp-pill ${status}`}>
                {status === "ok" ? "On track" : status === "short" ? `+${money(short, { compact: true })}/mo` : status === "overdue" ? "Overdue" : "Flexible"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function TargetCard() {
  const { store, transactions } = useData();
  const b = useBasis();
  const [s] = useFc();
  const [amount, setAmount] = useState("");
  const [by, setBy] = useState(shiftMonth(today().slice(0, 7), 12));
  const [useCurrent, setUseCurrent] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  if (!transactions.length) return null;
  const target = parseFloat(amount) || 0;
  const months = Math.max(1, monthsBetween(b.cur, by));
  const start = useCurrent ? b.base : 0;
  const need = target > 0 ? requiredMonthly(target, start, months, s.annualReturn) : 0;
  const ok = need <= b.net;
  const atPace = target > 0 ? monthsToReach(target, start, b.net, s.annualReturn) : null;
  return (
    <section className="card">
      <h3 className="card-title">Plan a target</h3>
      <div className="row2">
        <label className="field">
          <span>I want</span>
          <input inputMode="decimal" placeholder="5,00,000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <label className="field">
          <span>By</span>
          <input type="month" value={by} min={shiftMonth(b.cur, 1)} onChange={(e) => e.target.value && setBy(e.target.value)} />
        </label>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={useCurrent} onChange={(e) => setUseCurrent(e.target.checked)} /> Count my current savings ({money(b.base, { compact: true })})
      </label>
      {target > 0 && (
        <div className={`target-result ${ok ? "ok" : "short"}`}>
          <p>
            Save <b>{money(need)}/mo</b> for {months} months{s.annualReturn ? ` (assuming ${s.annualReturn}% returns)` : ""}.
          </p>
          <p className="small">
            {need === 0
              ? "✓ You already have this."
              : ok
                ? `✓ Doable — you keep ${money(b.net, { compact: true })}/mo, leaving ${money(b.net - need, { compact: true })}/mo spare.`
                : b.net > 0
                  ? `⚠ That's ${money(need - b.net, { compact: true })}/mo more than you keep now.${atPace ? ` At your current pace you'd get there by ${prettyMonth(shiftMonth(b.cur, atPace))}.` : ""}`
                  : "⚠ You're not saving each month yet — try the forecast's “Try changes” to find room."}
          </p>
          {made === `${target}|${by}` ? (
            <p className="small good-text">✓ Added to your goals below — use “Add” on it to start saving.</p>
          ) : (
            <button
              className="btn ghost"
              onClick={async () => {
                const [y, m] = by.split("-").map(Number);
                const lastDay = new Date(y, m, 0).getDate();
                await store.add("goals", {
                  name: `Target ${money(target, { compact: true })}`,
                  emoji: "🎯",
                  target,
                  deadline: `${by}-${String(lastDay).padStart(2, "0")}`,
                  contributions: [],
                  createdAt: Date.now(),
                });
                setMade(`${target}|${by}`);
              }}
            >
              🎯 Make this a savings goal
            </button>
          )}
        </div>
      )}
    </section>
  );
}
