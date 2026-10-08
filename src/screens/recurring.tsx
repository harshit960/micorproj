import { useState } from "react";
import { useData } from "../lib/data";
import { addDays, monthlyEquivalent, upcoming } from "../lib/calc";
import { daysUntil, money, prettyDate, today } from "../lib/format";
import { categoryEmoji, type Recurring } from "../lib/types";
import {
  FREQ_LABEL,
  RECURRING_TEMPLATES,
  type RecurringPreset,
} from "../components/forms";
import { Empty, Segmented } from "../components/ui";

const label = (r: Recurring) => r.note || r.category;
const when = (date: string) => {
  const d = daysUntil(date);
  return d === 0
    ? "Today"
    : d === 1
      ? "Tomorrow"
      : d < 7
        ? `In ${d} days`
        : prettyDate(date);
};

function RuleRow({ r, onClick }: { r: Recurring; onClick: () => void }) {
  const perMonth = monthlyEquivalent(r);
  return (
    <button className={`row ${r.active ? "" : "paused"}`} onClick={onClick}>
      <span className={`row-icon ${r.type}`}>
        {categoryEmoji(r.type, r.category)}
      </span>
      <span className="row-main">
        <span className="row-title">{label(r)}</span>
        <span className="row-sub">
          {FREQ_LABEL[r.freq]} ·{" "}
          {r.active ? `next ${prettyDate(r.nextDate)}` : "⏸ paused"}
          {r.freq !== "monthly" && r.active && (
            <> · ≈{money(perMonth, { compact: true })}/mo</>
          )}
        </span>
      </span>
      <span className={`row-amt ${r.type}`}>
        {money(r.type === "income" ? r.amount : -r.amount, { sign: true })}
      </span>
    </button>
  );
}

export function RecurringScreen({
  onEdit,
  onAdd,
}: {
  onEdit: (r: Recurring) => void;
  onAdd: (preset?: RecurringPreset) => void;
}) {
  const { recurring } = useData();
  const [view, setView] = useState<"all" | "expense" | "income">("all");
  const active = recurring.filter((r) => r.active);
  const inMonthly = active
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + monthlyEquivalent(r), 0);
  const outMonthly = active
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + monthlyEquivalent(r), 0);
  const t = today();
  // Through the same date next month, so every monthly item shows up at least once.
  const until = addDays(t, 31);
  const soon = upcoming(recurring, t, until);
  const dueOut = soon
    .filter((u) => u.rule.type === "expense")
    .reduce((s, u) => s + u.rule.amount, 0);
  const dueIn = soon
    .filter((u) => u.rule.type === "income")
    .reduce((s, u) => s + u.rule.amount, 0);
  const list = [...recurring]
    .filter((r) => view === "all" || r.type === view)
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.nextDate.localeCompare(b.nextDate),
    );
  const existing = new Set(recurring.map((r) => (r.note ?? "").toLowerCase()));
  const templates = RECURRING_TEMPLATES.filter(
    (tp) => !existing.has((tp.note ?? "").toLowerCase()),
  );

  return (
    <div className="screen">
      <h1 className="screen-title">Recurring</h1>

      {recurring.length > 0 && (
        <section className="hero small-hero">
          <span className="hero-label">Left each month after fixed costs</span>
          <span className="hero-value">{money(inMonthly - outMonthly)}</span>
          <div className="hero-split">
            <div>
              <span className="dot good" /> Fixed income
              <strong>{money(inMonthly, { compact: true })}/mo</strong>
            </div>
            <div>
              <span className="dot bad" /> Fixed costs
              <strong>{money(outMonthly, { compact: true })}/mo</strong>
            </div>
          </div>
          {inMonthly > 0 && outMonthly > 0 && (
            <span className="hero-foot">
              {Math.round((outMonthly / inMonthly) * 100)}% of your regular
              income is already committed
            </span>
          )}
        </section>
      )}

      {recurring.length === 0 ? (
        <Empty
          emoji="🔁"
          title="Nothing recurring yet"
          text="Add your salary, rent, bills and subscriptions once. Kosh logs them automatically every time they're due."
        />
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h3 className="card-title">
                Coming up{" "}
                <span className="small muted">· till {prettyDate(until)}</span>
              </h3>
              <span className="small muted">
                {dueIn > 0 && (
                  <span className="good-text">
                    +{money(dueIn, { compact: true })}{" "}
                  </span>
                )}
                {dueOut > 0 && (
                  <span className="bad-text">
                    −{money(dueOut, { compact: true })}
                  </span>
                )}
              </span>
            </div>
            {soon.length === 0 ? (
              <p className="hint" style={{ marginBottom: 12 }}>
                Nothing due in the next month.
              </p>
            ) : (
              <ol className="timeline">
                {soon.slice(0, 12).map((u) => (
                  <li key={`${u.rule.id}_${u.date}`}>
                    <button onClick={() => onEdit(u.rule)}>
                      <span
                        className={`tl-when ${daysUntil(u.date) <= 2 ? "soon" : ""}`}
                      >
                        {when(u.date)}
                      </span>
                      <span className="tl-name">
                        {categoryEmoji(u.rule.type, u.rule.category)}{" "}
                        {label(u.rule)}
                      </span>
                      <span className={`row-amt ${u.rule.type}`}>
                        {money(
                          u.rule.type === "income"
                            ? u.rule.amount
                            : -u.rule.amount,
                          { sign: true },
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: `All ${recurring.length}` },
              { value: "expense", label: "Bills & costs" },
              { value: "income", label: "Income" },
            ]}
          />
          <section className="card">
            {list.length ? (
              list.map((r) => (
                <RuleRow key={r.id} r={r} onClick={() => onEdit(r)} />
              ))
            ) : (
              <p className="hint" style={{ marginBottom: 12 }}>
                Nothing here yet.
              </p>
            )}
          </section>
        </>
      )}

      {templates.length > 0 && (
        <section className="card">
          <h3 className="card-title">Quick add</h3>
          <div className="templates">
            {templates.map((tp) => (
              <button
                key={tp.note}
                className="template"
                onClick={() => onAdd(tp)}
              >
                <span>{tp.emoji}</span>
                {tp.note}
              </button>
            ))}
          </div>
          <button
            className="btn ghost"
            style={{ margin: "4px 0 14px" }}
            onClick={() => onAdd()}
          >
            + Something else
          </button>
        </section>
      )}
    </div>
  );
}
