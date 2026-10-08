import { useMemo, useRef, useState } from "react";
import { useData } from "../lib/data";
import { shiftMonth } from "../lib/calc";
import {
  billingCycle,
  cardLabel,
  detectIssuer,
  cardStats,
  CARD_SLOTS,
  commitImport,
  cycleSpend,
  latestStatement,
  parseExtracted,
  prepareImport,
  rekey,
  topMerchants,
  undoImport,
  upcomingDues,
  type ImportRow,
  type PreparedImport,
} from "../lib/cards";
import { extractStatement, extractedText, PasswordNeeded } from "../lib/statements/extract";
import type { ParseResult } from "../lib/statements/parse";
import { daysUntil, money, monthKey, prettyDate, prettyMonth, today } from "../lib/format";
import { categoryEmoji, EXPENSE_CATEGORIES, sum, type Card, type Transaction } from "../lib/types";
import { Empty, Field, Icon, MonthPicker, Progress } from "../components/ui";

const swatch = (c?: Pick<Card, "colorIdx">) => `var(--card-${((c?.colorIdx ?? 0) % CARD_SLOTS) + 1})`;

function CardChip({ card }: { card?: Card }) {
  if (!card) return null;
  return (
    <span className="card-chip">
      <i style={{ background: swatch(card) }} />
      {cardLabel(card)}
    </span>
  );
}

function CardTile({ card, onClick }: { card: Card; onClick: () => void }) {
  const { transactions } = useData();
  const cur = today().slice(0, 7);
  const st = cardStats(transactions, cur, card.id);
  const cyc = cycleSpend(transactions, card);
  const last = latestStatement(card);
  const due = last?.dueDate && !last.paid ? daysUntil(last.dueDate) : null;
  return (
    <button className="cc-tile" style={{ ["--cc" as string]: swatch(card) }} onClick={onClick}>
      <div className="cc-top">
        <strong>{card.name}</strong>
        <span className="cc-num">{card.last4 ? `•••• ${card.last4}` : ""}</span>
      </div>
      <div className="cc-amt">
        <span className="small">This month</span>
        <strong>{money(st.net)}</strong>
      </div>
      {card.limit ? (
        <div className="cc-util">
          <div className="cc-bar">
            <i style={{ width: `${Math.min(100, (cyc / card.limit) * 100)}%` }} />
          </div>
          <span className="small">
            {Math.round((cyc / card.limit) * 100)}% of {money(card.limit, { compact: true })} limit this cycle
          </span>
        </div>
      ) : null}
      <div className="cc-foot small">
        {due !== null && last?.totalDue ? (
          <span>
            {money(last.totalDue, { compact: true })} due {due < 0 ? `${-due}d ago` : due === 0 ? "today" : `in ${due}d`}
          </span>
        ) : (
          <span>{st.count} spends</span>
        )}
        <span>{last ? `Statement ${prettyDate(last.statementDate ?? last.to ?? "")}` : "No statement yet"}</span>
      </div>
    </button>
  );
}

function ShareBar({ parts }: { parts: { key: string; label: string; value: number; color: string }[] }) {
  const total = sum(parts.map((p) => ({ amount: Math.max(0, p.value) })));
  if (total <= 0) return null;
  return (
    <div className="share">
      <div className="share-bar" role="img" aria-label="Share of spend by card">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <i key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${money(p.value)}`} />
          ))}
      </div>
      <ul className="share-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i style={{ background: p.color }} />
            <span className="row-main">{p.label}</span>
            <b>{money(p.value, { compact: true })}</b>
            <span className="muted small">{total ? Math.round((Math.max(0, p.value) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({ list }: { list: Transaction[] }) {
  const map = new Map<string, number>();
  list.filter((t) => t.type === "expense").forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const total = sum(rows.map(([, a]) => ({ amount: a })));
  if (!rows.length) return <p className="hint">No card spends this month.</p>;
  return (
    <div className="bars">
      {rows.map(([c, a]) => (
        <div key={c} className="bar-row">
          <span className="bar-label">
            {categoryEmoji("expense", c)} {c}
          </span>
          <Progress value={a / rows[0][1]} />
          <span className="bar-amt">
            {money(a, { compact: true })} <span className="muted">{Math.round((a / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function MerchantList({ list, cards }: { list: Transaction[]; cards: Card[] }) {
  const top = topMerchants(list, 8);
  if (!top.length) return null;
  return (
    <ol className="merchants">
      {top.map((m) => (
        <li key={m.name}>
          <span className="m-rank">{categoryEmoji("expense", m.category)}</span>
          <span className="row-main">
            <span className="row-title">{m.name}</span>
            <span className="row-sub">
              {m.count}× · avg {money(m.total / m.count, { compact: true })}
              {cards.length > 1 &&
                [...m.cards].map((id) => {
                  const c = cards.find((x) => x.id === id);
                  return c ? <i key={id} className="dot-card" style={{ background: swatch(c) }} title={cardLabel(c)} /> : null;
                })}
            </span>
          </span>
          <b>{money(m.total)}</b>
        </li>
      ))}
    </ol>
  );
}

function TrendBars({ txs, cardId, color }: { txs: Transaction[]; cardId?: string; color: string }) {
  const cur = today().slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(cur, i - 5));
  const vals = months.map((m) => cardStats(txs, m, cardId).net);
  const max = Math.max(1, ...vals);
  return (
    <div className="trend" role="img" aria-label="Card spend over the last 6 months">
      {months.map((m, i) => (
        <div key={m} className="trend-col" title={`${prettyMonth(m)}: ${money(vals[i])}`}>
          <span className="small">{vals[i] > 0 ? money(vals[i], { compact: true }) : ""}</span>
          <i style={{ height: `${Math.max(2, (vals[i] / max) * 80)}px`, background: color, opacity: m === cur ? 1 : 0.6 }} />
          <span className="small muted">{prettyMonth(m).slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Cards tab ----------

export function CardsScreen({ onImport, onCard, onAddCard }: { onImport: (cardId?: string) => void; onCard: (c: Card) => void; onAddCard: () => void }) {
  const { cards, transactions } = useData();
  const cur = today().slice(0, 7);
  const [month, setMonth] = useState(cur);
  const all = cardStats(transactions, month);
  const prev = cardStats(transactions, shiftMonth(month, -1));
  const delta = prev.net > 0 ? (all.net - prev.net) / prev.net : null;
  const dues = upcomingDues(cards);
  const sorted = [...cards].sort((a, b) => a.createdAt - b.createdAt);
  const biggest = [...all.list].filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);

  if (!cards.length)
    return (
      <div className="screen">
        <h1 className="screen-title">Cards</h1>
        <Empty
          emoji="💳"
          title="Track your credit cards"
          text="Upload a statement (PDF, CSV or Excel) and Kosh pulls out every spend, refund and fee — then combines all your cards in one view."
        />
        <button className="btn primary" onClick={() => onImport()}>
          <Icon name="upload" size={18} /> Import a statement
        </button>
        <button className="btn ghost" onClick={onAddCard}>
          + Add a card manually
        </button>
        <p className="privacy-note">
          🔒 Statements are read <b>on your phone</b>. The file is never uploaded anywhere; only the transactions you choose are saved. Password-protected PDFs
          are supported.
        </p>
      </div>
    );

  return (
    <div className="screen">
      <div className="screen-head">
        <h1 className="screen-title">Cards</h1>
        <button className="btn tiny" onClick={() => onImport()}>
          <Icon name="upload" size={16} /> Import
        </button>
      </div>
      <MonthPicker value={month} onChange={setMonth} max={cur} />

      <section className="hero small-hero">
        <span className="hero-label">Card spend · {prettyMonth(month)}</span>
        <span className="hero-value">{money(all.net)}</span>
        <div className="hero-split three">
          <div>
            Spends
            <strong>{money(all.spend, { compact: true })}</strong>
          </div>
          <div>
            Refunds
            <strong>{money(all.credits, { compact: true })}</strong>
          </div>
          <div>
            Fees
            <strong>{money(all.fees, { compact: true })}</strong>
          </div>
        </div>
        <span className="hero-foot">
          {all.count} card spends across {cards.length} card{cards.length === 1 ? "" : "s"}
          {delta !== null && ` · ${delta > 0 ? "▲" : "▼"} ${Math.abs(Math.round(delta * 100))}% vs ${prettyMonth(shiftMonth(month, -1)).split(" ")[0]}`}
        </span>
      </section>

      {dues.length > 0 && (
        <section className="card">
          <h3 className="card-title">Bills due</h3>
          {dues.map(({ card, st }) => {
            const d = daysUntil(st!.dueDate!);
            return (
              <button key={card.id} className="row" onClick={() => onCard(card)}>
                <span className="row-icon" style={{ background: swatch(card), color: "#fff" }}>
                  💳
                </span>
                <span className="row-main">
                  <span className="row-title">{cardLabel(card)}</span>
                  <span className={`row-sub ${d < 0 ? "bad-text" : d <= 3 ? "warn-text" : ""}`}>
                    {d < 0 ? `${-d} days overdue` : d === 0 ? "Due today" : `Due ${prettyDate(st!.dueDate!)} · in ${d}d`}
                    {st!.minDue ? ` · min ${money(st!.minDue, { compact: true })}` : ""}
                  </span>
                </span>
                <span className="row-amt">{money(st!.totalDue!)}</span>
              </button>
            );
          })}
        </section>
      )}

      {cards.length > 1 && (
        <section className="card">
          <h3 className="card-title">Spend by card</h3>
          <ShareBar
            parts={sorted.map((c) => ({ key: c.id, label: cardLabel(c), value: cardStats(transactions, month, c.id).net, color: swatch(c) }))}
          />
        </section>
      )}

      <div className="cc-list">
        {sorted.map((c) => (
          <CardTile key={c.id} card={c} onClick={() => onCard(c)} />
        ))}
        <button className="cc-add" onClick={onAddCard}>
          + Add card
        </button>
      </div>

      <section className="card">
        <h3 className="card-title">Last 6 months · all cards</h3>
        <TrendBars txs={transactions} color="var(--accent)" />
      </section>

      <section className="card">
        <h3 className="card-title">Where card money went</h3>
        <CategoryBars list={all.list} />
      </section>

      <section className="card">
        <h3 className="card-title">Top merchants</h3>
        <MerchantList list={all.list} cards={cards} />
        {!all.list.length && <p className="hint">Nothing in {prettyMonth(month)}.</p>}
      </section>

      {biggest.length > 0 && (
        <section className="card">
          <h3 className="card-title">Biggest spends</h3>
          {biggest.map((t) => (
            <div key={t.id} className="row static">
              <span className="row-icon expense">{categoryEmoji("expense", t.category)}</span>
              <span className="row-main">
                <span className="row-title">{t.note || t.category}</span>
                <span className="row-sub">
                  {prettyDate(t.date)} · <CardChip card={cards.find((c) => c.id === t.cardId)} />
                </span>
              </span>
              <span className="row-amt">{money(-t.amount, { sign: true })}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------- Card detail ----------

export function CardDetail({ card, onEdit, onImport, onTx }: { card: Card; onEdit: () => void; onImport: () => void; onTx: (t: Transaction) => void }) {
  const { transactions, store, cards } = useData();
  const live = cards.find((c) => c.id === card.id) ?? card;
  const cur = today().slice(0, 7);
  const [month, setMonth] = useState(cur);
  const [q, setQ] = useState("");
  const st = cardStats(transactions, month, live.id);
  const cyc = billingCycle(live);
  const cycSpend = cycleSpend(transactions, live);
  const list = st.list
    .filter((t) => !q || `${t.note} ${t.merchant} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const statements = [...(live.statements ?? [])].sort((a, b) => (b.to ?? "").localeCompare(a.to ?? ""));

  return (
    <div className="form">
      <div className="cc-tile big" style={{ ["--cc" as string]: swatch(live) }}>
        <div className="cc-top">
          <strong>{live.name}</strong>
          <span className="cc-num">{live.last4 ? `•••• ${live.last4}` : ""}</span>
        </div>
        <div className="cc-amt">
          <span className="small">This billing cycle (since {prettyDate(cyc.from)})</span>
          <strong>{money(cycSpend)}</strong>
        </div>
        {live.limit ? (
          <div className="cc-util">
            <div className="cc-bar">
              <i style={{ width: `${Math.min(100, (cycSpend / live.limit) * 100)}%` }} />
            </div>
            <span className="small">
              {money(Math.max(0, live.limit - cycSpend), { compact: true })} of {money(live.limit, { compact: true })} available (approx.)
            </span>
          </div>
        ) : null}
      </div>
      <div className="row2">
        <button className="btn ghost" onClick={onImport}>
          <Icon name="upload" size={18} /> Import
        </button>
        <button className="btn ghost" onClick={onEdit}>
          Edit card
        </button>
      </div>

      <MonthPicker value={month} onChange={setMonth} max={cur} />
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Spent</span>
          <span className="stat-value">{money(st.spend, { compact: true })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Refunds & cashback</span>
          <span className="stat-value good-text">{money(st.credits, { compact: true })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Spends</span>
          <span className="stat-value">{st.count}</span>
          {st.count > 0 && <span className="small muted">avg {money(st.spend / st.count, { compact: true })}</span>}
        </div>
        <div className="stat">
          <span className="stat-label">Fees & charges</span>
          <span className={`stat-value ${st.fees ? "bad-text" : ""}`}>{money(st.fees, { compact: true })}</span>
        </div>
      </div>

      <h4 className="sub-h">6-month trend</h4>
      <TrendBars txs={transactions} cardId={live.id} color={swatch(live)} />
      <h4 className="sub-h">Categories</h4>
      <CategoryBars list={st.list} />
      <h4 className="sub-h">Top merchants</h4>
      <MerchantList list={st.list} cards={[live]} />

      <h4 className="sub-h">Transactions · {prettyMonth(month)}</h4>
      <input className="search" type="search" placeholder="Search this card" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card flat">
        {list.length ? (
          list.map((t) => (
            <button key={t.id} className="row" onClick={() => onTx(t)}>
              <span className={`row-icon ${t.type}`}>{categoryEmoji(t.type, t.category)}</span>
              <span className="row-main">
                <span className="row-title">{t.note || t.category}</span>
                <span className="row-sub">
                  {t.category} · {prettyDate(t.date)}
                </span>
              </span>
              <span className={`row-amt ${t.type}`}>{money(t.type === "income" ? t.amount : -t.amount, { sign: true })}</span>
            </button>
          ))
        ) : (
          <p className="hint" style={{ margin: "8px 0 12px" }}>
            No transactions.
          </p>
        )}
      </div>

      <h4 className="sub-h">Statements</h4>
      {statements.length ? (
        <div className="card flat">
          {statements.map((s) => (
            <div key={s.id} className="stmt-row">
              <span className="row-main">
                <span className="row-title">
                  {s.from && s.to ? `${prettyDate(s.from)} – ${prettyDate(s.to)}` : s.fileName}
                </span>
                <span className="row-sub">
                  {s.count} rows · spends {money(s.spend, { compact: true })}
                  {s.totalDue ? ` · due ${money(s.totalDue, { compact: true })}` : ""}
                  {s.dueDate ? ` by ${prettyDate(s.dueDate)}` : ""}
                </span>
              </span>
              {s.dueDate && s.totalDue ? (
                <button
                  className={`btn tiny ${s.paid ? "ghosty" : ""}`}
                  onClick={() => store.update("cards", live.id, { statements: live.statements.map((x) => (x.id === s.id ? { ...x, paid: !x.paid } : x)) })}
                >
                  {s.paid ? "✓ Paid" : "Mark paid"}
                </button>
              ) : null}
              <button
                className="icon-btn small"
                aria-label="Undo this import"
                title="Undo this import"
                onClick={() => confirm(`Remove the ${s.count} transactions imported from ${s.fileName}?`) && undoImport(store, live, transactions, s.id)}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">No statements imported yet.</p>
      )}
    </div>
  );
}

// ---------- Card form ----------

export function CardForm({ initial, onDone }: { initial?: Card; onDone: (c?: Card) => void }) {
  const { store, cards, transactions } = useData();
  const [name, setName] = useState(initial?.name ?? "");
  const [last4, setLast4] = useState(initial?.last4 ?? "");
  const [limit, setLimit] = useState(initial?.limit ? String(initial.limit) : "");
  const [billDay, setBillDay] = useState(initial?.billDay ? String(initial.billDay) : "");
  const [dueDay, setDueDay] = useState(initial?.dueDay ? String(initial.dueDay) : "");
  const used = new Set(cards.map((c) => c.colorIdx));
  const [colorIdx, setColorIdx] = useState(initial?.colorIdx ?? (Array.from({ length: CARD_SLOTS }, (_, i) => i).find((i) => !used.has(i)) ?? cards.length % CARD_SLOTS));
  const day = (s: string) => (s ? Math.min(31, Math.max(1, parseInt(s))) : undefined);
  const save = async () => {
    const data = { name: name.trim(), last4: last4 || undefined, limit: parseFloat(limit) || undefined, billDay: day(billDay), dueDay: day(dueDay), colorIdx };
    if (initial) {
      await store.update("cards", initial.id, data);
      onDone({ ...initial, ...data });
    } else {
      await store.add("cards", { ...data, statements: [], createdAt: Date.now() });
      onDone();
    }
  };
  return (
    <div className="form">
      <Field label="Card name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Regalia, Amazon Pay ICICI…" maxLength={30} autoFocus={!initial} />
      </Field>
      <div className="row2">
        <Field label="Last 4 digits">
          <input inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
        </Field>
        <Field label="Credit limit">
          <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="2,00,000" />
        </Field>
      </div>
      <div className="row2">
        <Field label="Statement day">
          <input inputMode="numeric" value={billDay} onChange={(e) => setBillDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 15" />
        </Field>
        <Field label="Due day">
          <input inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 5" />
        </Field>
      </div>
      <div className="field">
        <span>Colour</span>
        <div className="color-pick">
          {Array.from({ length: CARD_SLOTS }, (_, i) => (
            <button key={i} type="button" className={colorIdx === i ? "on" : ""} style={{ background: `var(--card-${i + 1})` }} onClick={() => setColorIdx(i)} aria-label={`Colour ${i + 1}`} />
          ))}
        </div>
      </div>
      <button className="btn primary" disabled={!name.trim()} onClick={save}>
        {initial ? "Save card" : "Add card"}
      </button>
      {initial && (
        <button
          className="btn danger-ghost"
          onClick={async () => {
            const n = transactions.filter((t) => t.cardId === initial.id).length;
            if (!confirm(`Delete ${initial.name}${n ? ` and its ${n} transactions` : ""}?`)) return;
            for (const t of transactions.filter((t) => t.cardId === initial.id)) await store.remove("transactions", t.id);
            await store.remove("cards", initial.id);
            onDone();
          }}
        >
          Delete card
        </button>
      )}
    </div>
  );
}

// ---------- Import flow ----------

type Step = "pick" | "reading" | "review" | "done";
const SPEND_CATS = EXPENSE_CATEGORIES.map((c) => c.name);

export function ImportFlow({ defaultCardId, onDone, onOpenCard }: { defaultCardId?: string; onDone: () => void; onOpenCard: (c: Card) => void }) {
  const data = useData();
  const { cards, store, transactions, merchants, user } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needPw, setNeedPw] = useState<null | "need" | "wrong">(null);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [prep, setPrep] = useState<PreparedImport | null>(null);
  const [cardId, setCardId] = useState<string>(defaultCardId ?? cards[0]?.id ?? "new");
  const [newName, setNewName] = useState("");
  const [orig, setOrig] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ card: Card; count: number; spend: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const ctx = { transactions, merchants, cards };

  const read = async (f: File, pw?: string) => {
    setErr(null);
    setStep("reading");
    try {
      const x = await extractStatement(f, pw);
      const text = extractedText(x);
      const p = parseExtracted(x);
      setParsed(p);
      const auto = p.meta.last4 ? cards.find((c) => c.last4 === p.meta.last4) : undefined;
      // Pick the card only when we're sure: opened from that card, matching last 4 digits, or
      // the only card from the detected bank. Unknown last 4 → a new card. Otherwise ask.
      const issuer = detectIssuer(text);
      const byIssuer = issuer ? cards.filter((c) => c.issuer === issuer || c.name.toLowerCase().includes(issuer.toLowerCase())) : [];
      const target =
        defaultCardId ?? auto?.id ?? (p.meta.last4 ? "new" : byIssuer.length === 1 ? byIssuer[0].id : cards.length ? "" : "new");
      setCardId(target);
      const pr = prepareImport(p, text, target || "pending", ctx);
      setPrep(pr);
      setOrig(new Map(pr.rows.map((r) => [r.id, r.category])));
      if (!newName) setNewName(pr.issuer ? `${pr.issuer} card` : "");
      setNeedPw(null);
      setStep("review");
    } catch (e) {
      if (e instanceof PasswordNeeded) {
        setNeedPw(e.incorrect ? "wrong" : "need");
        setStep("pick");
      } else {
        setErr((e as Error).message);
        setStep("pick");
      }
    }
  };

  const tryAi = async () => {
    if (!prep) return;
    setAiBusy(true);
    setErr(null);
    try {
      const { aiReadStatement } = await import("../lib/ai");
      const txs = await aiReadStatement(prep.text);
      const p: ParseResult = { txs, meta: parsed?.meta ?? {} };
      setParsed(p);
      const pr = prepareImport(p, prep.text, cardId, ctx);
      setPrep(pr);
      setOrig(new Map(pr.rows.map((r) => [r.id, r.category])));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const switchCard = (id: string) => {
    setCardId(id);
    if (prep && parsed) setPrep(rekey(prep, parsed, id, ctx));
  };

  const setRow = (id: string, patch: Partial<ImportRow>) => setPrep((p) => (p ? { ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : p));

  const doImport = async () => {
    if (!prep || !parsed || !file) return;
    setBusy(true);
    setErr(null);
    try {
      let card = cards.find((c) => c.id === cardId);
      let rows = prep;
      if (!card) {
        // Create the card first so imported rows carry its id.
        const used = new Set(cards.map((c) => c.colorIdx));
        const colorIdx = Array.from({ length: CARD_SLOTS }, (_, i) => i).find((i) => !used.has(i)) ?? cards.length % CARD_SLOTS;
        const id = `card_${Date.now().toString(36)}`;
        const fields = { name: newName.trim() || prep.issuer || "My card", issuer: prep.issuer, last4: prep.meta.last4, colorIdx, statements: [], createdAt: Date.now() };
        await store.set("cards", id, fields);
        card = { id, ...fields };
        rows = rekey(prep, parsed, id, ctx);
      }
      const rec = await commitImport(store, card, rows, file.name, orig);
      setResult({ card, count: rec.count, spend: rec.spend - rec.credits });
      setStep("done");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const rows = prep?.rows ?? [];
    return {
      main: rows.filter((r) => r.flag !== "payment" && r.flag !== "imported"),
      skipped: rows.filter((r) => r.flag === "payment" || r.flag === "imported"),
    };
  }, [prep]);
  const chosen = prep?.rows.filter((r) => r.include) ?? [];
  const chosenSpend = sum(chosen.filter((r) => r.kind !== "refund"));
  const chosenCredit = sum(chosen.filter((r) => r.kind === "refund"));

  if (step === "done" && result)
    return (
      <div className="form center">
        <div className="done-emoji">✅</div>
        <h3>
          Imported {result.count} transaction{result.count === 1 ? "" : "s"}
        </h3>
        <p className="muted">
          {money(result.spend)} net on {cardLabel(result.card)}. Categories you changed will be remembered next time.
        </p>
        <button className="btn primary" onClick={() => onOpenCard(result.card)}>
          View card
        </button>
        <button className="btn ghost" onClick={onDone}>
          Done
        </button>
      </div>
    );

  if (step === "review" && prep) {
    const card = cards.find((c) => c.id === cardId);
    return (
      <div className="form">
        <div className="import-summary">
          <div>
            <span className="small muted">Found</span>
            <strong>{prep.rows.length} rows</strong>
          </div>
          <div>
            <span className="small muted">Period</span>
            <strong>{prep.meta.periodFrom && prep.meta.periodTo ? `${prettyDate(prep.meta.periodFrom)} – ${prettyDate(prep.meta.periodTo)}` : prep.rows.length ? `${prettyDate([...prep.rows].sort((a, b) => a.date.localeCompare(b.date))[0].date)} →` : "—"}</strong>
          </div>
          {prep.meta.totalDue !== undefined && (
            <div>
              <span className="small muted">Total due</span>
              <strong>{money(prep.meta.totalDue)}</strong>
              {prep.meta.dueDate && <span className="small muted">by {prettyDate(prep.meta.dueDate)}</span>}
            </div>
          )}
          {prep.meta.last4 && (
            <div>
              <span className="small muted">Card</span>
              <strong>
                {prep.issuer ?? ""} ··{prep.meta.last4}
              </strong>
            </div>
          )}
        </div>

        <Field label="Import into">
          <select value={cardId} onChange={(e) => switchCard(e.target.value)} className={cardId ? "" : "needs-choice"}>
            {!cardId && (
              <option value="" disabled>
                Choose which card this is…
              </option>
            )}
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {cardLabel(c)}
              </option>
            ))}
            <option value="new">+ New card{prep.meta.last4 ? ` ··${prep.meta.last4}` : ""}</option>
          </select>
        </Field>
        {cardId === "new" && (
          <Field label="New card name">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="HDFC Regalia" maxLength={30} />
          </Field>
        )}
        {card && prep.meta.last4 && card.last4 && card.last4 !== prep.meta.last4 && (
          <p className="form-error">This statement is for ··{prep.meta.last4} but you picked ··{card.last4}.</p>
        )}

        {prep.rows.length === 0 ? (
          <div className="hint">
            <b>Couldn't find transactions in this file.</b> Some banks use layouts that are hard to read automatically.
            {user ? (
              <>
                {" "}
                You can let the AI read it: the statement's text (with long numbers masked) is sent to Gemini once and not stored.
                <button className="btn ghost" style={{ marginTop: 10 }} disabled={aiBusy} onClick={tryAi}>
                  {aiBusy ? <span className="spinner small dark" /> : "✨"} Read it with AI
                </button>
              </>
            ) : (
              " Try the CSV/Excel export from your bank's website, or sign in to use the AI reader."
            )}
          </div>
        ) : (
          <>
            <div className="import-totals">
              <span>
                <b>{chosen.length}</b> selected
              </span>
              <span className="bad-text">−{money(chosenSpend, { compact: true })}</span>
              {chosenCredit > 0 && <span className="good-text">+{money(chosenCredit, { compact: true })}</span>}
              <button
                className="link"
                onClick={() =>
                  setPrep((p) => p && { ...p, rows: p.rows.map((r) => (r.flag === "payment" || r.flag === "imported" ? r : { ...r, include: !groups.main.every((x) => x.include) })) })
                }
              >
                {groups.main.every((r) => r.include) ? "Select none" : "Select all"}
              </button>
            </div>
            <ul className="import-rows">
              {groups.main.map((r) => (
                <li key={r.id} className={r.include ? "" : "off"}>
                  <input type="checkbox" checked={r.include} onChange={(e) => setRow(r.id, { include: e.target.checked })} aria-label={`Include ${r.merchant}`} />
                  <div className="row-main">
                    <span className="row-title">{r.merchant}</span>
                    <span className="row-sub" title={r.description}>
                      {prettyDate(r.date)} · {r.description}
                    </span>
                    {r.flag === "manual-dup" && <span className="small warn-text">Looks like “{r.dupOf}” you already logged</span>}
                    {r.kind === "spend" ? (
                      <select className="cat-select" value={r.category} onChange={(e) => setRow(r.id, { category: e.target.value })}>
                        {SPEND_CATS.map((c) => (
                          <option key={c} value={c}>
                            {categoryEmoji("expense", c)} {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`kind-badge ${r.kind}`}>{r.kind === "refund" ? "↩︎ Refund / cashback" : "🧾 Fee / tax"}</span>
                    )}
                  </div>
                  <span className={`row-amt ${r.kind === "refund" ? "income" : ""}`}>{money(r.kind === "refund" ? r.amount : -r.amount, { sign: true })}</span>
                </li>
              ))}
            </ul>
            {groups.skipped.length > 0 && (
              <button className="link" onClick={() => setShowSkipped(!showSkipped)} style={{ alignSelf: "flex-start" }}>
                {showSkipped ? "Hide" : "Show"} {groups.skipped.length} skipped (card bill payments{groups.skipped.some((r) => r.flag === "imported") ? ", already imported" : ""})
              </button>
            )}
            {showSkipped && (
              <ul className="import-rows skipped">
                {groups.skipped.map((r) => (
                  <li key={r.id} className="off">
                    <span className="kind-badge">{r.flag === "payment" ? "Bill payment" : "Imported"}</span>
                    <div className="row-main">
                      <span className="row-title">{r.description}</span>
                      <span className="row-sub">{prettyDate(r.date)}</span>
                    </div>
                    <span className="row-amt">{money(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted">Card bill payments are skipped: the purchases they pay for are already counted, so importing them would count your money twice.</p>
          </>
        )}
        {err && <p className="form-error">{err}</p>}
        <button className="btn primary" disabled={busy || !cardId || !chosen.length || (cardId === "new" && !newName.trim())} onClick={doImport}>
          {busy ? "Importing…" : `Import ${chosen.length} transaction${chosen.length === 1 ? "" : "s"}`}
        </button>
        <button className="btn ghost" onClick={() => setStep("pick")}>
          Choose a different file
        </button>
      </div>
    );
  }

  return (
    <div className="form">
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".pdf,.csv,.xlsx,.xls,.txt,.html,.htm,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setFile(f);
          setPassword("");
          setNeedPw(null);
          read(f);
        }}
      />
      <button className="drop" onClick={() => fileRef.current?.click()} disabled={step === "reading"}>
        {step === "reading" ? (
          <>
            <span className="spinner" />
            <span>Reading {file?.name}…</span>
          </>
        ) : (
          <>
            <span className="drop-icon">📄</span>
            <strong>{file ? file.name : "Choose statement file"}</strong>
            <span className="small muted">PDF (incl. password-protected), CSV or Excel (.xlsx)</span>
          </>
        )}
      </button>
      {needPw && file && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            read(file, password);
          }}
        >
          <Field label={needPw === "wrong" ? "Wrong password — try again" : "This PDF is password-protected"}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="off" placeholder="Statement password" />
          </Field>
          <p className="small muted">
            Usually something like the first 4 letters of your name + date of birth (DDMM), or your customer ID — check the email your bank sent with the
            statement. The password is only used on this device to open the file and is never saved.
          </p>
          <button className="btn primary" disabled={!password}>
            Unlock
          </button>
        </form>
      )}
      {err && <p className="form-error">{err}</p>}
      <p className="privacy-note">
        🔒 Your statement is read <b>on this device</b> — the file never leaves your phone. You review every transaction before anything is saved.
      </p>
      <details className="howto">
        <summary>Where do I get my statement?</summary>
        <p>
          Open the statement email from your bank (or the bank app → Credit card → Statements) and download the PDF. Many banks also offer “Download as
          Excel/CSV” in net banking, which imports even more reliably.
        </p>
      </details>
    </div>
  );
}

export { CardChip, swatch };
export const isCardTx = (t: Transaction, month?: string) => !!t.cardId && (!month || monthKey(t.date) === month);
