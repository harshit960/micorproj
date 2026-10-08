// Pure forecasting math (no app imports, so it's unit-testable on its own).

/** Annual % → equivalent monthly compounding rate. */
export const monthlyRate = (annualPct: number) => (annualPct ? Math.pow(1 + annualPct / 100, 1 / 12) - 1 : 0);

export interface ProjectionPoint {
  m: number; // months from now
  value: number; // nominal
  low: number; // likely range (≈ ±1 standard deviation of monthly savings)
  high: number;
  contributed: number; // base + everything added
  real: number; // value in today's money
}

/**
 * Month-by-month projection: each month the pot grows by `rate` then `monthly` is added.
 * `sd` is the standard deviation of monthly savings; the range widens with √months.
 */
export function project(opts: { base: number; monthly: number; months: number; annualReturn?: number; inflation?: number; sd?: number }) {
  const r = monthlyRate(opts.annualReturn ?? 0);
  const inf = monthlyRate(opts.inflation ?? 0);
  const sd = opts.sd ?? 0;
  const out: ProjectionPoint[] = [];
  let v = opts.base;
  for (let m = 0; m <= opts.months; m++) {
    if (m > 0) v = v * (1 + r) + opts.monthly;
    const spread = sd * Math.sqrt(m) * (r ? Math.pow(1 + r, m / 2) : 1);
    out.push({
      m,
      value: v,
      low: v - spread,
      high: v + spread,
      contributed: opts.base + opts.monthly * m,
      real: v / Math.pow(1 + inf, m),
    });
  }
  return out;
}

/** Monthly amount needed to grow `base` into `target` in `months` at `annualReturn`. */
export function requiredMonthly(target: number, base: number, months: number, annualReturn = 0) {
  if (months <= 0) return Math.max(0, target - base);
  const r = monthlyRate(annualReturn);
  if (!r) return Math.max(0, (target - base) / months);
  const g = Math.pow(1 + r, months);
  return Math.max(0, ((target - base * g) * r) / (g - 1));
}

/** Months until the pot reaches `target`, or null if it never does within `cap` months. */
export function monthsToReach(target: number, base: number, monthly: number, annualReturn = 0, cap = 600) {
  if (base >= target) return 0;
  const r = monthlyRate(annualReturn);
  let v = base;
  for (let m = 1; m <= cap; m++) {
    v = v * (1 + r) + monthly;
    if (v >= target) return m;
  }
  return null;
}

export function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
}

/** Round "nice" milestones above `from` (1L, 2L, 5L, 10L… for INR; 1k, 2k, 5k… otherwise). */
export function nextMilestones(from: number, count = 3, currency = "INR") {
  const steps = [1, 2, 5];
  const out: number[] = [];
  let exp = currency === "INR" ? 5 : 3; // ₹1,00,000 or 1,000
  while (out.length < count && exp < 12) {
    for (const s of steps) {
      const v = s * 10 ** exp;
      if (v > from && out.length < count) out.push(v);
    }
    exp++;
  }
  return out;
}

export const monthsBetween = (fromYm: string, toYm: string) => {
  const [y1, m1] = fromYm.split("-").map(Number);
  const [y2, m2] = toYm.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};
