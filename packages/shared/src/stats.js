export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function median(values) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantileSorted(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function mean(a) {
  return a.reduce((x, y) => x + y, 0) / (a.length || 1);
}

/**
 * Bootstrap the median of `samples`.
 * Returns the sample median, a (1 - alpha) percentile interval, and
 * pWithin = estimated probability that the true median is <= limit.
 */
export function bootstrapMedian(samples, { limit = Infinity, B = 1000, alpha = 0.05, rng = Math.random } = {}) {
  const n = samples.length;
  const med = median(samples);
  if (n < 2) {
    return { median: med, low: med, high: med, pWithin: med <= limit ? 1 : 0 };
  }
  const meds = new Array(B);
  let within = 0;
  for (let b = 0; b < B; b++) {
    const draw = new Array(n);
    for (let i = 0; i < n; i++) draw[i] = samples[Math.floor(rng() * n)];
    const m = median(draw);
    meds[b] = m;
    if (m <= limit) within++;
  }
  meds.sort((a, b) => a - b);
  return {
    median: med,
    low: quantileSorted(meds, alpha / 2),
    high: quantileSorted(meds, 1 - alpha / 2),
    pWithin: within / B,
  };
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * Canary-based speed factor. `history` holds recent canary medians (ms).
 * The reference is the median of the fastest half of the history (the machine's
 * "quiet" speed). factor = reference / current, clamped, so a slow moment shrinks
 * measured times and a quiet moment leaves them unchanged.
 */
export function speedFactorFrom(history, current) {
  if (!history.length || !(current > 0)) return 1;
  const sorted = [...history].sort((a, b) => a - b);
  const fast = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const reference = median(fast);
  return clamp(reference / current, 0.5, 1.05);
}
