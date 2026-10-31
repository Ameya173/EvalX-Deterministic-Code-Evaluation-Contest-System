import { bootstrapMedian } from './stats.js';

/**
 * C1: noise-aware timing decision for one test.
 *
 * `first` is the result of the first run: { cpuMs, wallKilled }.
 * `runOnce()` performs another run and returns the same shape.
 * Times are multiplied by `speedFactor` (canary calibration) before comparison.
 *
 * Policies:
 *   single   - one run, TLE if normalised time > limit
 *   fixed3   - always three runs, compare the median with the limit
 *   adaptive - one run when clearly fast (< lowBand * limit) or clearly slow
 *              (> highBand * limit); otherwise re-run up to maxRuns and decide
 *              with a bootstrap confidence interval.
 *
 * Returns { timeOk, runs, median, ciLow, ciHigh, confidence, borderline, policy }.
 * confidence is null for clear cases (no statistics were needed).
 */
export async function measureWithPolicy({
  first,
  runOnce,
  limitMs,
  speedFactor = 1,
  policy = 'adaptive',
  maxRuns = 5,
  lowBand = 0.8,
  highBand = 1.2,
  rng = Math.random,
}) {
  const norm = (r) => (r.wallKilled ? limitMs * 3 : r.cpuMs * speedFactor);
  const runs = [norm(first)];
  const base = { policy, borderline: false, confidence: null, ciLow: null, ciHigh: null };

  if (first.wallKilled) {
    return { ...base, timeOk: false, runs, median: runs[0], confidence: 1 };
  }

  if (policy === 'single') {
    return { ...base, timeOk: runs[0] <= limitMs, runs, median: runs[0] };
  }

  if (policy === 'fixed3') {
    while (runs.length < 3) runs.push(norm(await runOnce()));
    const stats = bootstrapMedian(runs, { limit: limitMs, rng });
    return { ...base, timeOk: stats.median <= limitMs, runs, median: stats.median, ciLow: stats.low, ciHigh: stats.high };
  }

  // adaptive
  if (runs[0] <= lowBand * limitMs) {
    return { ...base, timeOk: true, runs, median: runs[0] };
  }
  if (runs[0] >= highBand * limitMs) {
    return { ...base, timeOk: false, runs, median: runs[0] };
  }
  while (runs.length < maxRuns) runs.push(norm(await runOnce()));
  const stats = bootstrapMedian(runs, { limit: limitMs, rng });
  const timeOk = stats.pWithin >= 0.5;
  return {
    policy,
    borderline: true,
    timeOk,
    runs,
    median: stats.median,
    ciLow: stats.low,
    ciHigh: stats.high,
    confidence: timeOk ? stats.pWithin : 1 - stats.pWithin,
  };
}
