// Credit card statement parsing. Pure functions only (no DOM, no app imports) so it runs
// in the browser and in unit tests. Works on either text lines (PDF/TXT) or table rows
// (CSV/XLSX/HTML), using bank-agnostic heuristics rather than per-bank templates.

export type Direction = "debit" | "credit";

export interface ParsedTx {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive
  direction: Direction;
  raw: string;
}

export interface StatementMeta {
  last4?: string;
  statementDate?: string;
  periodFrom?: string;
  periodTo?: string;
  dueDate?: string;
  totalDue?: number;
  minDue?: number;
  creditLimit?: number;
}

export interface ParseResult {
  txs: ParsedTx[];
  meta: StatementMeta;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const validDate = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate() && y >= 2000 && y <= 2100;

interface DateHit {
  index: number;
  end: number;
  y?: number;
  m: number;
  d: number;
  numeric?: [number, number]; // raw a/b for dd/mm vs mm/dd resolution
}

const DATE_PATTERNS: { re: RegExp; read: (m: RegExpExecArray) => Omit<DateHit, "index" | "end"> | null }[] = [
  // 2025-09-14
  { re: /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, read: (m) => ({ y: +m[1], m: +m[2], d: +m[3] }) },
  // 14/09/2025, 14-09-25, 14.09.2025 (or US 09/14/2025)
  { re: /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g, read: (m) => ({ y: fullYear(+m[3]), m: +m[2], d: +m[1], numeric: [+m[1], +m[2]] }) },
  // 14 Sep 2025, 14-Sep-25, 14Sep25, 14 September, 2025, 14 Sep (no year)
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-]?${MON}(?:[\\s\\-,']*(\\d{4}|\\d{2})(?!\\d))?`, "gi"),
    read: (m) => ({ d: +m[1], m: MONTHS[m[2].toLowerCase().slice(0, 3)], y: m[3] ? fullYear(+m[3]) : undefined }),
  },
  // Sep 14, 2025 / September 14 2025 / September 14 (Amex prints no year)
  {
    re: new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`, "gi"),
    read: (m) => ({ m: MONTHS[m[1].toLowerCase().slice(0, 3)], d: +m[2], y: m[3] ? +m[3] : undefined }),
  },
];

function findDates(text: string): DateHit[] {
  const hits: DateHit[] = [];
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text))) {
      const r = p.read(m);
      if (!r || !r.m) continue;
      // Ignore overlaps with an earlier, more specific pattern.
      if (hits.some((h) => m!.index < h.end && m!.index + m![0].length > h.index)) continue;
      hits.push({ ...r, index: m.index, end: m.index + m[0].length });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Decide dd/mm vs mm/dd for the whole document from unambiguous dates. */
function detectOrder(texts: string[]): "dmy" | "mdy" {
  let dmy = 0,
    mdy = 0;
  for (const t of texts)
    for (const h of findDates(t))
      if (h.numeric) {
        const [a, b] = h.numeric;
        if (a > 12 && b <= 12) dmy++;
        else if (b > 12 && a <= 12) mdy++;
      }
  return mdy > dmy ? "mdy" : "dmy";
}

function resolve(h: DateHit, order: "dmy" | "mdy", fallbackYear: number, refMonth?: string): string | null {
  let d = h.d,
    m = h.m;
  if (h.numeric && order === "mdy") [m, d] = [h.numeric[0], h.numeric[1]];
  let y = h.y;
  if (y === undefined) {
    // No year printed: use the statement's year, stepping back a year for months after it
    // (a January statement listing December spends).
    y = fallbackYear;
    if (refMonth) {
      const [ry, rm] = refMonth.split("-").map(Number);
      y = m > rm ? ry - 1 : ry;
    }
  }
  return validDate(y, m, d) ? iso(y, m, d) : null;
}

// Amounts: 1,234.56 / 1,23,456.00 / ₹ 450.00 / Rs.450.00 / (1,234.00) / -450.00 / 450.00 Cr
const AMOUNT_RE = /(^|[^\d.,\w])([+\-−]?)\s*(?:₹|rs\.?|inr)?\s*(\()?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})\s*(\))?\s*(cr|dr|c|d)?(?![\w.]|,\d)/gi;

interface AmountHit {
  index: number;
  end: number;
  value: number;
  credit: boolean | null; // null = unmarked
}

// Foreign-currency amounts on international spends ("USD 12.00 … 1,020.45"): skip them,
// the INR amount is the one billed.
const FOREIGN = /\b(usd|eur|gbp|aed|sgd|aud|cad|jpy|chf|thb|myr|hkd|nzd|sar|qar|cny|lkr|npr)\b/i;

function findAmounts(text: string): AmountHit[] {
  const out: AmountHit[] = [];
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text))) {
    const value = parseFloat(m[4].replace(/,/g, ""));
    if (!isFinite(value)) continue;
    const marker = (m[6] ?? "").toLowerCase();
    const neg = m[2] === "-" || m[2] === "−" || (!!m[3] && !!m[5]);
    const credit = marker === "cr" || marker === "c" || neg || m[2] === "+" ? true : marker === "dr" || marker === "d" ? false : null;
    out.push({ index: m.index + m[1].length, end: m.index + m[0].length, value, credit });
  }
  return out;
}

const AMOUNT_ONLY = /^[+\-−]?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})\s*(cr|dr|c|d)?$/i;
const HEADERISH = /\b(date|description|transaction details|particulars|amount|reward|points|ser\.?\s*no|ref(erence)?\s*no|merchant category)\b|^\(?in\b|₹\)$/i;

const SUMMARY_WORDS =
  /\b(total|amount due|minimum|min\.? amt|opening balance|closing balance|previous balance|credit limit|available|statement (date|period)|payment due|due date|reward points? (summary|balance)|cash limit|past dues|outstanding)\b/i;


/** Pull the statement summary (dues, dates, limit, card digits) from free text. */
export function extractMeta(lines: string[], order: "dmy" | "mdy" = detectOrder(lines)): StatementMeta {
  const meta: StatementMeta = {};
  const text = lines.join("\n");
  const card =
    text.match(/(?:x{2,}|\*{2,}|•{2,}|X{2,})[\s\-x*•X]*(\d{4})\b/) ??
    text.match(/card\s*(?:no\.?|number|ending(?: in| with)?)\s*[:\-]?\s*(?:[\dx*•X]{4}[\s\-]?){0,3}(\d{4})\b/i);
  if (card) meta.last4 = card[1];
  const firstAmount = (s: string) => {
    const a = findAmounts(s);
    return a.length ? a[0].value : undefined;
  };
  const firstDate = (s: string) => {
    const h = findDates(s)[0];
    return h && h.y !== undefined ? resolve(h, order, h.y) ?? undefined : undefined;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1] ?? "";
    const valueAfter = (re: RegExp, pick: (s: string) => any) => {
      const m = l.match(re);
      if (!m) return undefined;
      return pick(l.slice(m.index! + m[0].length)) ?? pick(next);
    };
    meta.totalDue ??= valueAfter(/total\s*(amount\s*)?(due|dues|payable)|total\s*outstanding|new balance|closing balance/i, firstAmount);
    meta.minDue ??= valueAfter(/min(imum)?\.?\s*(amount\s*|amt\.?\s*)?(due|payable)/i, firstAmount);
    meta.creditLimit ??= valueAfter(/(total\s*)?credit\s*limit/i, firstAmount);
    meta.dueDate ??= valueAfter(/(payment\s*)?due\s*date|pay(ment)?\s*by/i, firstDate);
    meta.statementDate ??= valueAfter(/statement\s*date|bill(ing)?\s*date/i, firstDate);
    const period = l.match(/statement\s*period|billing\s*(period|cycle)|from\b/i);
    if (period && !meta.periodFrom) {
      const ds = findDates(l.slice(period.index!)).filter((h) => h.y !== undefined);
      if (ds.length >= 2) {
        meta.periodFrom = resolve(ds[0], order, ds[0].y!) ?? undefined;
        meta.periodTo = resolve(ds[1], order, ds[1].y!) ?? undefined;
      }
    }
  }
  return meta;
}

/** Remove reference numbers, times, reward-point columns and stray separators. */
export function cleanDescription(s: string) {
  return s
    .replace(/\|/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(am|pm)?\b/gi, " ") // times
    .replace(/\b(ref(erence)?\s*(no\.?|#)?|txn\s*id|auth\s*code)\s*[:#]?\s*\w+/gi, " ")
    .replace(/\b\d{8,}\b/g, " ") // long reference / serial numbers
    .replace(/^\s*\d{1,4}\s+/, " ") // leading serial number
    .replace(/(\s+[+-]?\s?\d{1,6}){1,2}\s*$/, " ") // trailing reward points ("+ 12")
    .replace(/\s+[+\-−]\s*$/, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–:]+|[\s\-–:]+$/g, "")
    .trim();
}

/** Parse transactions from text lines (PDF / plain text statements). */
export function parseLines(lines: string[], refYear = new Date().getFullYear()): ParseResult {
  const order = detectOrder(lines);
  const meta = extractMeta(lines, order);
  const refMonth = (meta.periodTo ?? meta.statementDate)?.slice(0, 7);
  const year = refMonth ? +refMonth.slice(0, 4) : refYear;
  const txs: ParsedTx[] = [];
  const norm = lines.map((l) => l.replace(/\s+/g, " ").trim());
  const leadingDate = (line: string) => {
    const d = findDates(line)[0];
    return d && d.index <= Math.max(14, line.length * 0.25) ? d : undefined;
  };
  // Lines next to a transaction that may hold the rest of a wrapped table cell.
  const orphan = (i: number) => {
    const l = norm[i];
    if (!l || leadingDate(l) || SUMMARY_WORDS.test(l) || HEADERISH.test(l)) return undefined;
    return l;
  };
  for (let i = 0; i < norm.length; i++) {
    const line = norm[i];
    if (line.length < 8) continue;
    const dates = findDates(line);
    const d0 = dates[0];
    // The transaction date should lead the line (allowing a serial number before it).
    if (!d0 || d0.index > Math.max(14, line.length * 0.25)) continue;
    // Some banks print transaction + posting dates side by side: skip past both.
    let descStart = d0.end;
    if (dates[1] && dates[1].index - d0.end <= 3) descStart = dates[1].end;
    let all = findAmounts(line).filter((a) => a.index >= descStart);
    const prev = orphan(i - 1),
      next = orphan(i + 1);
    let extraCredit: boolean | null = null;
    if (!all.length) {
      // Amount wrapped onto its own line ("15,000.00" above/below, maybe "CR" on another).
      const amtLine = [prev, next].find((l) => l && AMOUNT_ONLY.test(l));
      if (!amtLine) continue;
      all = findAmounts(` ${amtLine} `).map((a) => ({ ...a, index: line.length, end: line.length }));
      if ([prev, next, orphan(i + 2)].some((l) => l && /^(cr|c)$/i.test(l))) extraCredit = true;
    }
    const amounts = all.filter((a) => !FOREIGN.test(line.slice(Math.max(0, a.index - 5), a.index)) && !FOREIGN.test(line.slice(a.end, a.end + 5)));
    if (!amounts.length) continue;
    // The billed amount comes first; later decimals are cashback / reward columns.
    const marked = amounts.filter((a) => a.credit !== null);
    const pick = marked.length ? marked[0] : amounts[0];
    if (pick.value <= 0) continue;
    if (extraCredit !== null && pick.credit === null) pick.credit = extraCredit;
    const descEnd = Math.min(all[0].index, line.length);
    let description = cleanDescription(line.slice(descStart, descEnd));
    if (!/[a-z]{2,}/i.test(description)) {
      // Description wrapped above/below the date line.
      description = cleanDescription([prev, description, next].filter((l) => l && /[a-z]{2,}/i.test(l) && !AMOUNT_ONLY.test(l)).join(" "));
    }
    if (!/[a-z]{2,}/i.test(description)) continue;
    if (SUMMARY_WORDS.test(description) && !/payment|refund|reversal|cashback/i.test(description)) continue;
    const date = resolve(d0, order, year, refMonth);
    if (!date) continue;
    txs.push({ date, description, amount: Math.round(pick.value * 100) / 100, direction: pick.credit ? "credit" : "debit", raw: lines[i] });
  }
  return { txs, meta };
}

// ---------- tables (CSV / XLSX / HTML) ----------

const HEADER = {
  date: /^(txn|transaction|trans\.?|tran|posting|value)?\s*date$|^date$/i,
  dateLoose: /date/i,
  desc: /description|narration|details|particulars|merchant|remarks|transaction$/i,
  amount: /amount|amt|inr|value \(?rs/i,
  debit: /debit|withdrawal|\bdr\b|spent|charges?$/i,
  credit: /credit|deposit|\bcr\b|refund|payments?$/i,
  type: /^(type|dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|txn type|transaction type)$/i,
};

/** Parse transactions from table rows; falls back to the line parser when no header is found. */
export function parseRows(rows: string[][], refYear = new Date().getFullYear()): ParseResult {
  const clean = rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()));
  const hi = clean.slice(0, 40).findIndex((r) => r.some((c) => HEADER.dateLoose.test(c)) && r.some((c) => HEADER.amount.test(c) || HEADER.debit.test(c) || HEADER.credit.test(c)));
  const lines = clean.map((r) => r.filter(Boolean).join("  "));
  if (hi < 0) return parseLines(lines, refYear);

  const head = clean[hi];
  const find = (re: RegExp, except?: number[]) => head.findIndex((c, i) => re.test(c) && !except?.includes(i));
  let dateCol = find(HEADER.date);
  if (dateCol < 0) dateCol = find(HEADER.dateLoose);
  const typeCol = find(HEADER.type);
  const debitCol = find(HEADER.debit, [typeCol]);
  const creditCol = find(HEADER.credit, [typeCol, debitCol]);
  const amountCol = find(HEADER.amount, [debitCol, creditCol, typeCol].filter((x) => x >= 0));
  let descCol = find(HEADER.desc, [dateCol, amountCol, debitCol, creditCol, typeCol]);
  const order = detectOrder(clean.slice(hi + 1).map((r) => r[dateCol] ?? ""));
  const meta = extractMeta(lines, order);
  const refMonth = (meta.periodTo ?? meta.statementDate)?.slice(0, 7);
  const year = refMonth ? +refMonth.slice(0, 4) : refYear;

  const txs: ParsedTx[] = [];
  for (const r of clean.slice(hi + 1)) {
    const dh = findDates(r[dateCol] ?? "")[0];
    if (!dh) continue;
    const date = resolve(dh, order, year, refMonth);
    if (!date) continue;
    if (descCol < 0) descCol = r.findIndex((c, i) => i !== dateCol && /[a-z]{3,}/i.test(c));
    const description = cleanDescription(r[descCol] ?? "");
    let value = 0,
      credit: boolean | null = null;
    const num = (s?: string) => {
      const a = findAmounts(` ${s ?? ""} `)[0] ?? (/^\s*[+-]?\d+(\.\d+)?\s*$/.test(s ?? "") ? { value: Math.abs(parseFloat(s!)), credit: parseFloat(s!) < 0 ? true : null } : undefined);
      return a;
    };
    const deb = debitCol >= 0 ? num(r[debitCol]) : undefined;
    const cre = creditCol >= 0 ? num(r[creditCol]) : undefined;
    if (deb && deb.value > 0) value = deb.value;
    else if (cre && cre.value > 0) {
      value = cre.value;
      credit = true;
    } else if (amountCol >= 0) {
      const a = num(r[amountCol]);
      if (a) {
        value = a.value;
        credit = a.credit;
      }
    }
    if (typeCol >= 0 && credit === null) credit = /^c/i.test(r[typeCol]) || /credit/i.test(r[typeCol]);
    if (!value || !description) continue;
    if (SUMMARY_WORDS.test(description) && !/payment|refund|reversal|cashback/i.test(description)) continue;
    txs.push({ date, description, amount: Math.round(value * 100) / 100, direction: credit ? "credit" : "debit", raw: r.join(" | ") });
  }
  return { txs, meta };
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    q = false;
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep || c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}
