import { addDays, shiftMonth } from "./calc";
import { monthKey, today } from "./format";
import { categorize, importIds, merchantKey, type TxKind } from "./statements/classify";
import type { ParseResult, StatementMeta } from "./statements/parse";
import { parseLines, parseRows } from "./statements/parse";
import type { Extracted } from "./statements/extract";
import type { Store } from "./store";
import { sum, type Card, type MerchantRule, type StatementRecord, type Transaction } from "./types";

export const CARD_SLOTS = 8;

const ISSUERS: [string, RegExp][] = [
  ["HDFC", /\bhdfc\b/i],
  ["ICICI", /\bicici\b/i],
  ["SBI Card", /\bsbi\s*card|state bank\b/i],
  ["Axis", /\baxis\b/i],
  ["Amex", /american express|\bamex\b/i],
  ["Kotak", /\bkotak\b/i],
  ["IDFC First", /\bidfc\b/i],
  ["HSBC", /\bhsbc\b/i],
  ["Citi", /\bciti(bank)?\b/i],
  ["Standard Chartered", /standard chartered/i],
  ["AU", /\bau small finance|\bau bank\b/i],
  ["RBL", /\brbl\b/i],
  ["Yes Bank", /\byes bank\b/i],
  ["IndusInd", /\bindusind\b/i],
  ["OneCard", /\bonecard\b/i],
  ["Scapia", /\bscapia\b/i],
  ["Federal", /\bfederal bank\b/i],
  ["BOB", /\bbob(card)?\b|bank of baroda/i],
];

export function detectIssuer(text: string) {
  const head = text.slice(0, 6000);
  return ISSUERS.find(([, re]) => re.test(head))?.[0];
}

export const cardLabel = (c?: Pick<Card, "name" | "last4">) => (c ? `${c.name}${c.last4 ? ` ··${c.last4}` : ""}` : "");

export function cardStats(txs: Transaction[], month: string, cardId?: string) {
  const list = txs.filter((t) => t.cardId && (!cardId || t.cardId === cardId) && monthKey(t.date) === month);
  const spends = list.filter((t) => t.type === "expense");
  const credits = list.filter((t) => t.type === "income");
  const fees = spends.filter((t) => t.category === "Fees & charges");
  const spend = sum(spends);
  return { list, spend, credits: sum(credits), fees: sum(fees), net: spend - sum(credits), count: spends.length };
}

/** Current billing cycle from the statement day (e.g. bill on the 15th → 16th..15th). */
export function billingCycle(card: Card, now = today()) {
  if (!card.billDay) {
    const m = now.slice(0, 7);
    return { from: `${m}-01`, to: now };
  }
  const [y, mo, d] = now.split("-").map(Number);
  const dayIn = (yy: number, mm: number) => Math.min(card.billDay!, new Date(yy, mm, 0).getDate());
  let startY = y,
    startM = mo;
  if (d <= dayIn(y, mo)) {
    const prev = shiftMonth(now.slice(0, 7), -1).split("-").map(Number);
    [startY, startM] = prev;
  }
  const from = addDays(`${startY}-${String(startM).padStart(2, "0")}-${String(dayIn(startY, startM)).padStart(2, "0")}`, 1);
  return { from, to: now };
}

export function cycleSpend(txs: Transaction[], card: Card, now = today()) {
  const { from, to } = billingCycle(card, now);
  const list = txs.filter((t) => t.cardId === card.id && t.date >= from && t.date <= to);
  return sum(list.filter((t) => t.type === "expense")) - sum(list.filter((t) => t.type === "income"));
}

export function latestStatement(card: Card) {
  return [...(card.statements ?? [])].sort((a, b) => (b.statementDate ?? b.to ?? "").localeCompare(a.statementDate ?? a.to ?? "") || b.importedAt - a.importedAt)[0];
}

/** Statements with a due date coming up (or just passed) that aren't marked paid. */
export function upcomingDues(cards: Card[], now = today()) {
  return cards
    .map((c) => ({ card: c, st: latestStatement(c) }))
    .filter(({ st }) => st?.dueDate && !st.paid && st.dueDate >= addDays(now, -7) && (st.totalDue ?? 0) > 0)
    .sort((a, b) => a.st!.dueDate!.localeCompare(b.st!.dueDate!));
}

export function topMerchants(list: Transaction[], n = 6) {
  const map = new Map<string, { name: string; total: number; count: number; cards: Set<string>; category: string }>();
  for (const t of list) {
    if (t.type !== "expense") continue;
    const name = t.note || t.category;
    const k = name.toLowerCase();
    const e = map.get(k) ?? { name, total: 0, count: 0, cards: new Set<string>(), category: t.category };
    e.total += t.amount;
    e.count++;
    if (t.cardId) e.cards.add(t.cardId);
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

// ---------- import pipeline ----------

export interface ImportRow {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  kind: TxKind;
  category: string;
  include: boolean;
  /** Why a row is excluded by default. */
  flag?: "payment" | "imported" | "manual-dup";
  dupOf?: string;
}

export interface PreparedImport {
  rows: ImportRow[];
  meta: StatementMeta;
  issuer?: string;
  matchedCardId?: string;
  text: string;
}

export function parseExtracted(x: Extracted): ParseResult {
  return x.kind === "lines" ? parseLines(x.lines) : parseRows(x.rows);
}

export function prepareImport(
  parsed: ParseResult,
  text: string,
  cardId: string,
  ctx: { transactions: Transaction[]; merchants: MerchantRule[]; cards: Card[] },
): PreparedImport {
  const learned = new Map(ctx.merchants.map((m) => [m.id, m.category]));
  const ids = importIds(cardId, parsed.txs);
  const existing = new Map(ctx.transactions.map((t) => [t.id, t]));
  const manual = ctx.transactions.filter((t) => !t.cardId && !t.importId && t.type === "expense");
  const rows: ImportRow[] = parsed.txs.map((t, i) => {
    const c = categorize(t, learned);
    const row: ImportRow = {
      id: ids[i],
      date: t.date,
      description: t.description,
      merchant: c.merchant,
      amount: t.amount,
      kind: c.kind,
      category: c.category,
      include: true,
    };
    if (c.kind === "payment") return { ...row, include: false, flag: "payment" };
    if (existing.has(ids[i])) return { ...row, include: false, flag: "imported", category: existing.get(ids[i])!.category };
    if (c.kind !== "refund") {
      const twin = manual.find((m) => Math.abs(m.amount - t.amount) < 0.01 && Math.abs(Date.parse(m.date) - Date.parse(t.date)) <= 2 * 864e5);
      if (twin) return { ...row, include: false, flag: "manual-dup", dupOf: twin.note || twin.category };
    }
    return row;
  });
  const matched = parsed.meta.last4 ? ctx.cards.find((c) => c.last4 === parsed.meta.last4) : undefined;
  return { rows, meta: parsed.meta, issuer: detectIssuer(text), matchedCardId: matched?.id, text };
}

/** Re-key rows for a different card (ids embed the card id). */
export function rekey(prep: PreparedImport, parsed: ParseResult, cardId: string, ctx: Parameters<typeof prepareImport>[3]) {
  const fresh = prepareImport(parsed, prep.text, cardId, ctx);
  // keep the user's include/category edits
  return {
    ...fresh,
    rows: fresh.rows.map((r, i) => ({ ...r, include: r.flag === "imported" ? false : prep.rows[i]?.include ?? r.include, category: prep.rows[i]?.category ?? r.category })),
  };
}

export async function commitImport(
  store: Store,
  card: Card,
  prep: PreparedImport,
  fileName: string,
  originalCategories: Map<string, string>,
): Promise<StatementRecord> {
  const importId = `imp_${Date.now().toString(36)}`;
  const chosen = prep.rows.filter((r) => r.include);
  for (const r of chosen) {
    await store.set("transactions", r.id, {
      type: r.kind === "refund" ? "income" : "expense",
      amount: r.amount,
      category: r.kind === "refund" ? "Refund" : r.category,
      note: r.merchant,
      merchant: r.description,
      cardId: card.id,
      importId,
      date: r.date,
      createdAt: Date.now(),
    });
  }
  // Remember categories the user changed, for this merchant on future imports.
  const taught = new Map<string, string>();
  for (const r of prep.rows) if (r.kind === "spend" && originalCategories.get(r.id) !== r.category) taught.set(merchantKey(r.merchant), r.category);
  for (const [key, category] of taught) if (key) await store.set("merchants", key, { category, createdAt: Date.now() });

  const spend = sum(chosen.filter((r) => r.kind !== "refund"));
  const credits = sum(chosen.filter((r) => r.kind === "refund"));
  const dates = prep.rows.map((r) => r.date).sort();
  const record: StatementRecord = {
    id: importId,
    importedAt: Date.now(),
    fileName,
    from: prep.meta.periodFrom ?? dates[0],
    to: prep.meta.periodTo ?? dates[dates.length - 1],
    statementDate: prep.meta.statementDate,
    dueDate: prep.meta.dueDate,
    totalDue: prep.meta.totalDue,
    minDue: prep.meta.minDue,
    count: chosen.length,
    spend,
    credits,
  };
  // Same statement imported again replaces its old record.
  const others = (card.statements ?? []).filter((s) => !(record.statementDate && s.statementDate === record.statementDate) && !(s.from === record.from && s.to === record.to));
  const patch: Partial<Card> = { statements: [...others, clean(record)].slice(-36) };
  if (!card.limit && prep.meta.creditLimit) patch.limit = prep.meta.creditLimit;
  if (!card.billDay && prep.meta.statementDate) patch.billDay = Number(prep.meta.statementDate.slice(8, 10));
  if (!card.dueDay && prep.meta.dueDate) patch.dueDay = Number(prep.meta.dueDate.slice(8, 10));
  if (!card.last4 && prep.meta.last4) patch.last4 = prep.meta.last4;
  await store.update("cards", card.id, patch);
  return record;
}

const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Undo one statement import: delete its transactions and its record. */
export async function undoImport(store: Store, card: Card, txs: Transaction[], importId: string) {
  for (const t of txs.filter((t) => t.importId === importId)) await store.remove("transactions", t.id);
  await store.update("cards", card.id, { statements: (card.statements ?? []).filter((s) => s.id !== importId) });
}
