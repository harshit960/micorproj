export type TxType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
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

export interface Collections {
  transactions: Transaction;
  goals: Goal;
  loans: Loan;
}

export type CollectionName = keyof Collections;

export const EXPENSE_CATEGORIES = [
  { name: "Food", emoji: "🍜" },
  { name: "Transport", emoji: "🚕" },
  { name: "Shopping", emoji: "🛍️" },
  { name: "Bills", emoji: "💡" },
  { name: "Rent", emoji: "🏠" },
  { name: "Health", emoji: "💊" },
  { name: "Fun", emoji: "🎬" },
  { name: "Travel", emoji: "✈️" },
  { name: "Education", emoji: "📚" },
  { name: "Other", emoji: "📦" },
];

export const INCOME_CATEGORIES = [
  { name: "Salary", emoji: "💼" },
  { name: "Freelance", emoji: "💻" },
  { name: "Business", emoji: "🏪" },
  { name: "Investment", emoji: "📈" },
  { name: "Gift", emoji: "🎁" },
  { name: "Other", emoji: "💰" },
];

export function categoryEmoji(type: TxType, name: string): string {
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.name === name)?.emoji ?? "•";
}

export const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

export const goalSaved = (g: Goal) => sum(g.contributions);
export const loanRepaid = (l: Loan) => sum(l.repayments);
export const loanOutstanding = (l: Loan) => Math.max(0, l.amount - loanRepaid(l));
