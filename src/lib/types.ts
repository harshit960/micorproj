// "transfer" = money moved between the spendable balance and a savings goal.
// amount > 0 moves money INTO the goal, amount < 0 withdraws it back to the balance.
export type TxType = "income" | "expense" | "transfer";
export type FlowType = Exclude<TxType, "transfer">;

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
  tags?: string[];
  goalId?: string;
  recurringId?: string;
  /** Paid with this credit card. */
  cardId?: string;
  /** Raw merchant text from a statement. */
  merchant?: string;
  /** Statement import this came from (lets an import be undone). */
  importId?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Contribution {
  amount: number;
  date: string;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  deadline?: string;
  /** Savings added without touching the balance (money you already had set aside). */
  contributions: Contribution[];
  createdAt: number;
}

export type LoanDirection = "lent" | "borrowed";

export interface Loan {
  id: string;
  person: string;
  direction: LoanDirection;
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  repayments: Contribution[];
  createdAt: number;
}

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Recurring {
  id: string;
  type: FlowType;
  amount: number;
  category: string;
  note?: string;
  tags?: string[];
  freq: Frequency;
  nextDate: string;
  anchorDay: number; // day-of-month the rule was created on
  active: boolean;
  createdAt: number;
}

export interface Budget {
  id: string;
  category: string;
  amount: number; // monthly limit
  createdAt: number;
}

export interface StatementRecord {
  id: string;
  importedAt: number;
  fileName: string;
  from?: string;
  to?: string;
  statementDate?: string;
  dueDate?: string;
  totalDue?: number;
  minDue?: number;
  count: number;
  spend: number;
  credits: number;
  paid?: boolean;
}

export interface Card {
  id: string;
  name: string;
  issuer?: string;
  last4?: string;
  colorIdx: number; // fixed per card so its colour never shifts when others are filtered
  limit?: number;
  billDay?: number; // statement generation day of month
  dueDay?: number;
  statements: StatementRecord[];
  createdAt: number;
}

/** A category the user picked for a merchant; reused on future imports. Doc id = merchant key. */
export interface MerchantRule {
  id: string;
  category: string;
  createdAt: number;
}

export interface Collections {
  transactions: Transaction;
  goals: Goal;
  loans: Loan;
  recurring: Recurring;
  budgets: Budget;
  cards: Card;
  merchants: MerchantRule;
}

export type CollectionName = keyof Collections;
export const COLLECTIONS: CollectionName[] = ["transactions", "goals", "loans", "recurring", "budgets", "cards", "merchants"];

export const EXPENSE_CATEGORIES = [
  { name: "Food", emoji: "🍜" },
  { name: "Groceries", emoji: "🛒" },
  { name: "Transport", emoji: "🚕" },
  { name: "Shopping", emoji: "🛍️" },
  { name: "Bills", emoji: "💡" },
  { name: "Rent", emoji: "🏠" },
  { name: "Health", emoji: "💊" },
  { name: "Fun", emoji: "🎬" },
  { name: "Travel", emoji: "✈️" },
  { name: "Education", emoji: "📚" },
  { name: "Subscriptions", emoji: "🔁" },
  { name: "EMI", emoji: "🏦" },
  { name: "Insurance", emoji: "🛡️" },
  { name: "Investments", emoji: "📈" },
  { name: "Gifts", emoji: "🎁" },
  { name: "Fees & charges", emoji: "🧾" },
  { name: "Other", emoji: "📦" },
];

export const INCOME_CATEGORIES = [
  { name: "Salary", emoji: "💼" },
  { name: "Freelance", emoji: "💻" },
  { name: "Business", emoji: "🏪" },
  { name: "Investment", emoji: "📈" },
  { name: "Rental", emoji: "🏘️" },
  { name: "Refund", emoji: "↩️" },
  { name: "Gift", emoji: "🎁" },
  { name: "Other", emoji: "💰" },
];

export function categoryEmoji(type: TxType, name: string): string {
  if (type === "transfer") return "🐷";
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.name === name)?.emoji ?? "•";
}

export const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

export const loanRepaid = (l: Loan) => sum(l.repayments);
export const loanOutstanding = (l: Loan) => Math.max(0, l.amount - loanRepaid(l));

export const normalizeTag = (t: string) =>
  t.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-").slice(0, 24);
