import { useState, type FormEvent } from "react";
import { useData } from "../lib/data";
import { money, today } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  loanOutstanding,
  type Goal,
  type Loan,
  type LoanDirection,
  type Transaction,
  type TxType,
} from "../lib/types";
import { AmountField, Field, Segmented } from "./ui";

const parse = (s: string) => Math.round(parseFloat(s) * 100) / 100;
const valid = (s: string) => parse(s) > 0;

function useSubmit(fn: () => Promise<void>, done: () => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await fn();
      done();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, submit };
}

export function TxForm({ initial, onDone }: { initial?: Transaction; onDone: () => void }) {
  const { store } = useData();
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category ?? "Food");
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const { busy, err, submit } = useSubmit(async () => {
    const data = { type, amount: parse(amount), category, note: note.trim() || undefined, date };
    if (initial) await store.update("transactions", initial.id, data);
    else await store.add("transactions", { ...data, createdAt: Date.now() });
  }, onDone);

  return (
    <form onSubmit={submit} className="form">
      <Segmented
        value={type}
        onChange={(t) => {
          setType(t);
          setCategory(t === "income" ? "Salary" : "Food");
        }}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />
      <AmountField value={amount} onChange={setAmount} autoFocus={!initial} />
      <div className="chips">
        {cats.map((c) => (
          <button type="button" key={c.name} className={`chip ${category === c.name ? "on" : ""}`} onClick={() => setCategory(c.name)}>
            <span>{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>
      <div className="row2">
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={80} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className={`btn primary ${type === "income" ? "good" : ""}`} disabled={!valid(amount) || busy}>
        {initial ? "Save changes" : type === "income" ? "Add income" : "Add expense"}
      </button>
      {initial && (
        <button type="button" className="btn danger-ghost" onClick={() => store.remove("transactions", initial.id).then(onDone)}>
          Delete
        </button>
      )}
    </form>
  );
}

const GOAL_EMOJIS = ["🎯", "🏝️", "🚗", "🏠", "💻", "📱", "🎓", "💍", "🛟", "🎁", "✈️", "🏍️"];

export function GoalForm({ initial, onDone }: { initial?: Goal; onDone: () => void }) {
  const { store } = useData();
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");

  const { busy, err, submit } = useSubmit(async () => {
    const data = { name: name.trim(), emoji, target: parse(target), deadline: deadline || undefined };
    if (initial) await store.update("goals", initial.id, data);
    else await store.add("goals", { ...data, contributions: [], createdAt: Date.now() });
  }, onDone);

  return (
    <form onSubmit={submit} className="form">
      <div className="emoji-row">
        {GOAL_EMOJIS.map((e) => (
          <button type="button" key={e} className={`emoji-pick ${emoji === e ? "on" : ""}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>
      <Field label="Goal name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund, new laptop…" required maxLength={40} autoFocus={!initial} />
      </Field>
      <div className="row2">
        <Field label="Target amount">
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="50000" required />
        </Field>
        <Field label="Target date">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary" disabled={!name.trim() || !valid(target) || busy}>
        {initial ? "Save goal" : "Create goal"}
      </button>
      {initial && (
        <button type="button" className="btn danger-ghost" onClick={() => confirm(`Delete "${initial.name}"?`) && store.remove("goals", initial.id).then(onDone)}>
          Delete goal
        </button>
      )}
    </form>
  );
}

export function ContributeForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const { store } = useData();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const { busy, err, submit } = useSubmit(async () => {
    const amt = parse(amount) * (mode === "withdraw" ? -1 : 1);
    await store.update("goals", goal.id, { contributions: [...goal.contributions, { amount: amt, date: today() }] });
  }, onDone);
  return (
    <form onSubmit={submit} className="form">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "add", label: "Add money" },
          { value: "withdraw", label: "Withdraw" },
        ]}
      />
      <AmountField value={amount} onChange={setAmount} />
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary" disabled={!valid(amount) || busy}>
        {mode === "add" ? `Save to ${goal.name}` : `Withdraw from ${goal.name}`}
      </button>
    </form>
  );
}

export function LoanForm({ initial, onDone }: { initial?: Loan; onDone: () => void }) {
  const { store, loans } = useData();
  const [direction, setDirection] = useState<LoanDirection>(initial?.direction ?? "lent");
  const [person, setPerson] = useState(initial?.person ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const people = [...new Set(loans.map((l) => l.person))];

  const { busy, err, submit } = useSubmit(async () => {
    const data = { direction, person: person.trim(), amount: parse(amount), date, dueDate: dueDate || undefined, note: note.trim() || undefined };
    if (initial) await store.update("loans", initial.id, data);
    else await store.add("loans", { ...data, repayments: [], createdAt: Date.now() });
  }, onDone);

  return (
    <form onSubmit={submit} className="form">
      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { value: "lent", label: "I lent" },
          { value: "borrowed", label: "I borrowed" },
        ]}
      />
      <AmountField value={amount} onChange={setAmount} autoFocus={!initial} />
      <Field label={direction === "lent" ? "Lent to" : "Borrowed from"}>
        <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name" required maxLength={40} list="people" />
        <datalist id="people">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <div className="row2">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Due by">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" maxLength={80} />
      </Field>
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary" disabled={!person.trim() || !valid(amount) || busy}>
        {initial ? "Save changes" : "Add record"}
      </button>
      {initial && (
        <button type="button" className="btn danger-ghost" onClick={() => confirm("Delete this record?") && store.remove("loans", initial.id).then(onDone)}>
          Delete record
        </button>
      )}
    </form>
  );
}

export function RepayForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const { store } = useData();
  const left = loanOutstanding(loan);
  const [amount, setAmount] = useState(String(left));
  const { busy, err, submit } = useSubmit(async () => {
    const amt = Math.min(parse(amount), left);
    await store.update("loans", loan.id, { repayments: [...loan.repayments, { amount: amt, date: today() }] });
  }, onDone);
  return (
    <form onSubmit={submit} className="form">
      <p className="muted center">
        {money(left)} outstanding {loan.direction === "lent" ? "from" : "to"} {loan.person}
      </p>
      <AmountField value={amount} onChange={setAmount} />
      <div className="chips center">
        {[0.25, 0.5, 1].map((f) => (
          <button type="button" key={f} className="chip" onClick={() => setAmount(String(Math.round(left * f * 100) / 100))}>
            {f === 1 ? "Full" : `${f * 100}%`}
          </button>
        ))}
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary good" disabled={!valid(amount) || busy}>
        {loan.direction === "lent" ? "Record money received" : "Record money paid back"}
      </button>
    </form>
  );
}
