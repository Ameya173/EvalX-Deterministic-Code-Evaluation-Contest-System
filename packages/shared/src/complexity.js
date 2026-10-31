import { mean } from './stats.js';

const log2 = (n) => Math.log2(Math.max(2, n));

export const MODELS = [
  { key: '1', label: 'O(1)', f: () => 1 },
  { key: 'log n', label: 'O(log n)', f: (n) => log2(n) },
  { key: 'n', label: 'O(n)', f: (n) => n },
  { key: 'n log n', label: 'O(n log n)', f: (n) => n * log2(n) },
  { key: 'n^2', label: 'O(n^2)', f: (n) => n * n },
  { key: 'n^3', label: 'O(n^3)', f: (n) => n * n * n },
];

export function parseComplexity(text) {
  if (!text) return null;
  let s = String(text).toLowerCase().replace(/\s+/g, '');
  s = s.replace(/^o\(/, '').replace(/\)$/, '');
  s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^').replace(/n\*n\*n/g, 'n^3').replace(/n\*n/g, 'n^2');
  s = s.replace(/nlogn|n\*logn|log\(n\)n|nlog\(n\)/g, 'nlog n');
  s = s.replace('nlog n', 'n log n').replace('logn', 'log n').replace('log(n)', 'log n');
  const found = MODELS.find((m) => m.key === s);
  return found ? found.key : null;
}

/** Geometric size schedule (factor 2) between minN and maxN, at most maxPoints sizes. */
export function generateSizes(minN, maxN, maxPoints = 9) {
  const sizes = [];
  let n = Math.max(2, Math.floor(minN));
  while (n <= maxN && sizes.length < maxPoints) {
    sizes.push(n);
    n *= 2;
  }
  return sizes;
}

/**
 * Fit candidate growth models to (n, ms) points in the log domain.
 * Each model has one free parameter (a constant factor), so the SSE of
 * ln(ms) - ln(a * f(n)) is comparable across models. The simplest model whose
 * SSE is within `tolerance` of the best is chosen (conservative: we prefer to
 * under-call complexity rather than falsely accuse a solution).
 */
export function fitComplexity(points, { minTimeMs = 5, minPoints = 4, tolerance = 1.15 } = {}) {
  const pts = points.filter((p) => p.n > 0 && p.ms >= minTimeMs).sort((a, b) => a.n - b.n);
  if (pts.length < minPoints) {
    return { ok: false, reason: `Only ${pts.length} measurable points (need ${minPoints}). Increase the size range or time.`, used: pts.length };
  }
  const lnT = pts.map((p) => Math.log(p.ms));
  const sst = lnT.reduce((acc, v) => acc + (v - mean(lnT)) ** 2, 0);
  const fits = MODELS.map((m, order) => {
    const lf = pts.map((p) => Math.log(m.f(p.n)));
    const lnA = mean(lnT.map((v, j) => v - lf[j]));
    const sse = lnT.reduce((acc, v, j) => acc + (v - lnA - lf[j]) ** 2, 0);
    return { key: m.key, label: m.label, order, a: Math.exp(lnA), sse };
  });
  const minSse = Math.min(...fits.map((f) => f.sse));
  const best = fits.find((f) => f.sse <= minSse * tolerance + 1e-6);

  // log-log slope for context
  const lnN = pts.map((p) => Math.log(p.n));
  const mx = mean(lnN);
  const my = mean(lnT);
  const sxx = lnN.reduce((a, v) => a + (v - mx) ** 2, 0);
  const sxy = lnN.reduce((a, v, i) => a + (v - mx) * (lnT[i] - my), 0);
  const slope = sxx > 0 ? sxy / sxx : 0;

  return {
    ok: true,
    used: pts.length,
    best,
    fits,
    slope,
    r2: sst > 0 ? 1 - best.sse / sst : 1,
  };
}

/**
 * Decide the cause of a TLE from the fit.
 *  - asymptotic:     fitted class is worse than the declared class
 *  - constant-factor: same class (or better) but clearly slower than the reference
 *  - unclear:        growth looks fine and speed is similar to the reference
 */
export function classifyComplexity({ fit, declaredKey, ratioVsReference }) {
  if (!fit || !fit.ok) {
    return { classification: 'inconclusive', message: fit?.reason || 'Not enough data to analyse growth.' };
  }
  const declaredOrder = MODELS.findIndex((m) => m.key === declaredKey);
  const fitted = fit.best;
  if (declaredOrder >= 0 && fitted.order > declaredOrder) {
    return {
      classification: 'asymptotic',
      message: `Your solution scales like ${fitted.label}; this problem expects about ${MODELS[declaredOrder].label}. A better algorithm or data structure is needed, not micro-optimisation.`,
    };
  }
  if (ratioVsReference && ratioVsReference > 2.5) {
    return {
      classification: 'constant-factor',
      message: `Growth matches ${fitted.label}, but your solution is about ${ratioVsReference.toFixed(1)}x slower than the reference at the largest size. Look at constant factors: I/O speed, allocations, unnecessary copies.`,
    };
  }
  return {
    classification: 'unclear',
    message: `Growth looks like ${fitted.label} and speed is close to the reference. The slowdown may depend on specific inputs (for example worst-case or adversarial data).`,
  };
}
