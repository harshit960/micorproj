import { amountsHidden } from "./prefs";

export const CURRENCIES = [
  { code: "INR", locale: "en-IN" },
  { code: "USD", locale: "en-US" },
  { code: "EUR", locale: "de-DE" },
  { code: "GBP", locale: "en-GB" },
  { code: "AED", locale: "en-AE" },
];

let currency = "INR";
try {
  currency = localStorage.getItem("kosh:currency") ?? "INR";
} catch {
  /* ignore */
}

export const getCurrency = () => currency;
export function setCurrency(code: string) {
  currency = code;
  try {
    localStorage.setItem("kosh:currency", code);
  } catch {
    /* ignore */
  }
}

export function currencySymbol() {
  const c = CURRENCIES.find((x) => x.code === currency) ?? CURRENCIES[0];
  return new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "";
}

export function money(n: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  const c = CURRENCIES.find((x) => x.code === currency) ?? CURRENCIES[0];
  if (amountsHidden()) return currencySymbol() + "••••";
  const s = new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.compact ? 1 : Number.isInteger(n) ? 0 : 2,
    notation: opts.compact && Math.abs(n) >= 100000 ? "compact" : "standard",
  }).format(Math.abs(n));
  if (opts.sign) return (n < 0 ? "−" : "+") + s;
  return n < 0 ? "−" + s : s;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const monthKey = (date: string) => date.slice(0, 7);

export function prettyDate(date: string) {
  const d = new Date(date + "T00:00:00");
  const t = today();
  if (date === t) return "Today";
  const y = new Date(t + "T00:00:00");
  y.setDate(y.getDate() - 1);
  if (d.getTime() === y.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function prettyMonth(key: string) {
  return new Date(key + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function daysUntil(date: string) {
  return Math.round((new Date(date + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000);
}
