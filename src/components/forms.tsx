import { useMemo, useState, type FormEvent } from "react";
import { useData } from "../lib/data";
import { addPeriod, allTags, balanceOf, goalSaved } from "../lib/calc";
import { money, today } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  loanOutstanding,
  type Budget,
  type Frequency,
  type Goal,
  type Loan,
  type LoanDirection,
  type Transaction,
  type TxType,
} from "../lib/types";
import { AmountField, Field, Segmented, TagInput } from "./ui";

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

function GoalPicker({ goals, value, onChange, txs }: { goals: Goal[]; value: string; onChange: (id: string) => void; txs: Transaction[] }) {
  return (
    <div className="goal-pick">
      {goals.map((g) => (
        <button type="button" key={g.id} className={`goal-chip ${value === g.id ? "on" : ""}`} onClick={() => onChange(g.id)}>
          <span className="goal-chip-emoji">{g.emoji}</span>
          <span className="row-main">
            <span className="row-title">{g.name}</span>
            <span className="row-sub">
              {money(goalSaved(g, txs), { compact: true })} / {money(g.target, { compact: true })}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function TxForm({
  initial,
  defaultType,
  defaultGoalId,
  onDone,
}: {
  initial?: Transaction;
  defaultType?: TxType;
  defaultGoalId?: string;
  onDone: () => void;
}) {
  const { store, transactions, goals } = useData();
  const [type, setType] = useState<TxType>(initial?.type ?? defaultType ?? "expense");
  const [withdraw, setWithdraw] = useState(initial?.type === "transfer" && initial.amount < 0);
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [category, setCategory] = useState(initial?.category ?? (type === "income" ? "Salary" : "Food"));
  const [goalId, setGoalId] = useState(initial?.goalId ?? defaultGoalId ?? goals[0]?.id ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [repeat, setRepeat] = useState<"never" | Frequency>("never");
  const tagSuggestions = useMemo(() => allTags(transactions), [transactions]);
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const goal = goals.find((g) => g.id === goalId);
  const balance = balanceOf(transactions.filter((t) => t.id !== initial?.id));

  const { busy, err, submit } = useSubmit(async () => {
    const amt = parse(amount);
    if (type === "transfer") {
      if (!goal) throw new Error("Pick a savings goal");
      const data = {
        type,
        amount: withdraw ? -amt : amt,
        category: "Savings",
        goalId,
        note: note.trim() || undefined,
        tags: undefined,
        date,
      };
      if (initial) await store.update("transactions", initial.id, data);
      else await store.add("transactions", { ...data, createdAt: Date.now() });
      return;
    }
    const data = { type, amount: amt, category, note: note.trim() || undefined, tags: tags.length ? tags : undefined, goalId: undefined, date };
    if (initial) {
      await store.update("transactions", initial.id, data);
      return;
    }
    await store.add("transactions", { ...data, createdAt: Date.now() });
    if (repeat !== "never") {
      const anchorDay = Number(date.slice(8, 10));
      await store.add("recurring", {
        type,
        amount: amt,
        category,
        note: data.note,
        tags: data.tags,
        freq: repeat,
        anchorDay,
        nextDate: addPeriod(date, repeat, anchorDay),
        active: true,
        createdAt: Date.now(),
      });
    }
  }, onDone);

  const label =
    type === "transfer"
      ? withdraw
        ? `Withdraw to balance`
        : `Move to ${goal?.name ?? "savings"}`
      : initial
        ? "Save changes"
        : type === "income"
          ? "Add income"
          : "Add expense";

  return (
    <form onSubmit={submit} className="form">
      <Segmented
        value={type}
        onChange={(t) => {
          setType(t);
          if (t !== "transfer") setCategory(t === "income" ? "Salary" : "Food");
        }}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Savings" },
        ]}
      />
      <AmountField value={amount} onChange={setAmount} autoFocus={!initial} />

      {type === "transfer" ? (
        goals.length === 0 ? (
          <p className="hint">Create a savings goal first (Savings tab → +), then move money into it.</p>
        ) : (
          <>
            <div className="seg-small">
              <button type="button" className={!withdraw ? "on" : ""} onClick={() => setWithdraw(false)}>
                Balance → Goal
              </button>
              <button type="button" className={withdraw ? "on" : ""} onClick={() => setWithdraw(true)}>
                Goal → Balance
              </button>
            </div>
            <GoalPicker goals={goals} value={goalId} onChange={setGoalId} txs={transactions} />
            <p className="small muted center">
              {withdraw
                ? `${money(goal ? goalSaved(goal, transactions) : 0)} in ${goal?.name ?? "goal"}`
                : `Available balance ${money(balance)}`}
            </p>
          </>
        )
      ) : (
        <>
          <div className="chips">
            {cats.map((c) => (
              <button type="button" key={c.name} className={`chip ${category === c.name ? "on" : ""}`} onClick={() => setCategory(c.name)}>
                <span>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </Field>
        </>
      )}

      <div className="row2">
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={80} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>

      {!initial && type !== "transfer" && (
        <Field label="Repeat">
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
            <option value="never">Doesn't repeat</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </select>
        </Field>
      )}
      {initial?.recurringId && <p className="small muted">🔁 Added automatically by a recurring rule. Edits here only change this one.</p>}

      {err && <p className="form-error">{err}</p>}
      <button
        className={`btn primary ${type === "income" ? "good" : ""}`}
        disabled={!valid(amount) || busy || (type === "transfer" && !goal)}
      >
        {label}
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
  const { store, transactions } = useData();
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");

  const { busy, err, submit } = useSubmit(async () => {
    const data = { name: name.trim(), emoji, target: parse(target), deadline: deadline || undefined };
    if (initial) await store.update("goals", initial.id, data);
    else await store.add("goals", { ...data, contributions: [], createdAt: Date.now() });
  }, onDone);

  const remove = async () => {
    if (!initial) return;
    const moves = transactions.filter((t) => t.type === "transfer" && t.goalId === initial.id);
    const fromBalance = moves.reduce((s, t) => s + t.amount, 0);
    const msg =
      `Delete "${initial.name}"?` + (fromBalance > 0 ? `\n\n${money(fromBalance)} you moved in from your balance will go back to your balance.` : "");
    if (!confirm(msg)) return;
    await Promise.all(moves.map((t) => store.remove("transactions", t.id)));
    await store.remove("goals", initial.id);
    onDone();
  };

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
        <button type="button" className="btn danger-ghost" onClick={remove}>
          Delete goal
        </button>
      )}
    </form>
  );
}

type SaveMode = "move" | "existing" | "withdraw";

export function ContributeForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const { store, transactions } = useData();
  const [mode, setMode] = useState<SaveMode>("move");
  const [amount, setAmount] = useState("");
  const saved = goalSaved(goal, transactions);
  const balance = balanceOf(transactions);
  const { busy, err, submit } = useSubmit(async () => {
    const amt = parse(amount);
    if (mode === "existing") {
      await store.update("goals", goal.id, { contributions: [...goal.contributions, { amount: amt, date: today() }] });
      return;
    }
    if (mode === "withdraw" && amt > saved) throw new Error(`Only ${money(saved)} in this goal`);
    await store.add("transactions", {
      type: "transfer",
      amount: mode === "withdraw" ? -amt : amt,
      category: "Savings",
      goalId: goal.id,
      date: today(),
      createdAt: Date.now(),
    });
  }, onDone);
  return (
    <form onSubmit={submit} className="form">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "move", label: "Move in" },
          { value: "existing", label: "Add saved" },
          { value: "withdraw", label: "Withdraw" },
        ]}
      />
      <p className="hint">
        {mode === "move" && (
          <>
            Moves money <b>from your balance</b> ({money(balance)}) into this goal. Shows in Activity as a transfer.
          </>
        )}
        {mode === "existing" && <>Records money you'd <b>already set aside</b> elsewhere. Your balance won't change.</>}
        {mode === "withdraw" && (
          <>
            Takes money out of this goal ({money(saved)}) and <b>back into your balance</b>.
          </>
        )}
      </p>
      <AmountField value={amount} onChange={setAmount} />
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary" disabled={!valid(amount) || busy}>
        {mode === "move" ? `Move to ${goal.name}` : mode === "existing" ? `Add to ${goal.name}` : `Withdraw from ${goal.name}`}
      </button>
    </form>
  );
}

export function BudgetForm({ initial, onDone }: { initial?: Budget; onDone: () => void }) {
  const { store, budgets } = useData();
  const taken = new Set(budgets.filter((b) => b.id !== initial?.id).map((b) => b.category));
  const options = EXPENSE_CATEGORIES.filter((c) => !taken.has(c.name));
  const [category, setCategory] = useState(initial?.category ?? options[0]?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const { busy, err, submit } = useSubmit(async () => {
    if (initial) await store.update("budgets", initial.id, { category, amount: parse(amount) });
    else await store.add("budgets", { category, amount: parse(amount), createdAt: Date.now() });
  }, onDone);
  if (!options.length && !initial) return <p className="hint">Every category already has a budget.</p>;
  return (
    <form onSubmit={submit} className="form">
      <p className="small muted center">Monthly limit</p>
      <AmountField value={amount} onChange={setAmount} autoFocus={!initial} />
      <div className="chips">
        {options.map((c) => (
          <button type="button" key={c.name} className={`chip ${category === c.name ? "on" : ""}`} onClick={() => setCategory(c.name)}>
            <span>{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className="btn primary" disabled={!valid(amount) || !category || busy}>
        {initial ? "Save budget" : `Set ${category} budget`}
      </button>
      {initial && (
        <button type="button" className="btn danger-ghost" onClick={() => store.remove("budgets", initial.id).then(onDone)}>
          Remove budget
        </button>
      )}
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
