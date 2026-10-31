import { LANGUAGES, classifyComplexity, fitComplexity, generateSizes, median, parseComplexity } from '@judgebox/shared/core';
import { calibrate, limitsFor } from '../judge/judgeCore.js';

const REPEATS_SUB = 3;
const REPEATS_REF = 2;

/**
 * C2: explain a TLE by measuring how the solution's CPU time grows with input size.
 *
 * The setter's generator (reads "n seed", prints a valid input) creates inputs of
 * geometrically increasing size inside the sandbox. The submission and the reference
 * solution are timed on each. Times are normalised with the canary speed factor.
 * Returns data for the report (no database access).
 */
export async function complexityCore({ submission, problem, sandbox, calib, onProgress = () => {} }) {
  if (!problem.generator?.source) throw new Error('This problem has no generator, so growth cannot be measured.');
  const language = submission.language;
  const limits = limitsFor(problem, language);
  const lang = LANGUAGES[language];
  const declaredKey = parseComplexity(problem.declaredComplexity);

  const g = await sandbox.request({ cmd: 'compile', name: 'gen', lang: problem.generator.lang || 'python', source: problem.generator.source }, 120000);
  if (!g.ok) throw new Error(`Generator does not compile: ${g.log}`);
  const s = await sandbox.request({ cmd: 'compile', name: 'sub', lang: language, source: submission.source }, 120000);
  if (!s.ok) throw new Error('Submission does not compile.');
  const hasRef = !!problem.reference?.source;
  if (hasRef) {
    const r = await sandbox.request({ cmd: 'compile', name: 'ref', lang: problem.reference.lang, source: problem.reference.source }, 120000);
    if (!r.ok) throw new Error(`Reference does not compile: ${r.log}`);
  }

  const { speedFactor } = await calibrate(sandbox, calib);
  const sizes = generateSizes(problem.scaling?.minN || 1000, problem.scaling?.maxN || 256000);
  const capMs = Math.min(15000, Math.max(3000, limits.cpuLimit * 10));

  const rows = [];
  let censoredAt = null;
  for (let i = 0; i < sizes.length; i++) {
    const n = sizes[i];
    const times = [];
    let censored = false;
    for (let rep = 0; rep < REPEATS_SUB; rep++) {
      const r = await sandbox.request(
        { cmd: 'scale', gen: 'gen', genLang: problem.generator.lang || 'python', name: 'sub', lang: language, n, seed: rep + 1, cpuMs: capMs, wallMs: capMs * 2 + 2000, asKb: limits.asKb, heapMb: limits.heapMb },
        capMs * 2 + 120000
      );
      if (r.error) throw new Error(r.error);
      if (r.genFailed) throw new Error(`Generator failed for n=${n}: ${r.stderr || 'unknown error'}`);
      const sub = r.sub;
      if (sub.wall_killed || sub.signal === 24) {
        censored = true;
        break;
      }
      if (sub.signal || sub.exit !== 0) throw new Error(`Submission crashed on generated input (n=${n}); growth cannot be measured.`);
      times.push(sub.cpu_ms * speedFactor);
    }
    const row = { n, subMs: censored ? null : Math.round(median(times) * 10) / 10, censored, refMs: null };
    if (!censored && hasRef) {
      const rt = [];
      for (let rep = 0; rep < REPEATS_REF; rep++) {
        const r = await sandbox.request(
          { cmd: 'scale', gen: 'gen', genLang: problem.generator.lang || 'python', name: 'ref', lang: problem.reference.lang, n, seed: rep + 1, cpuMs: capMs, wallMs: capMs * 2 + 2000, asKb: 0, heapMb: limits.heapMb },
          capMs * 2 + 120000
        );
        if (!r.error && !r.genFailed && !r.sub.signal && r.sub.exit === 0) rt.push(r.sub.cpu_ms * speedFactor);
      }
      if (rt.length) row.refMs = Math.round(median(rt) * 10) / 10;
    }
    rows.push(row);
    await onProgress(i + 1, sizes.length);
    if (censored) {
      censoredAt = n;
      break;
    }
  }

  const points = rows.filter((r) => !r.censored && r.subMs != null).map((r) => ({ n: r.n, ms: r.subMs }));
  const fit = fitComplexity(points);
  const both = rows.filter((r) => r.subMs != null && r.refMs != null && r.refMs > 0);
  const last = both[both.length - 1];
  const ratio = last ? last.subMs / Math.max(last.refMs, 1) : null;
  const verdict = classifyComplexity({ fit, declaredKey, ratioVsReference: ratio });

  return {
    sizes: rows,
    censoredAt,
    capMs,
    speedFactor: Math.round(speedFactor * 1000) / 1000,
    declared: declaredKey,
    declaredLabel: problem.declaredComplexity || null,
    ratioVsReference: ratio ? Math.round(ratio * 10) / 10 : null,
    fit: fit.ok
      ? {
          best: { key: fit.best.key, label: fit.best.label, a: fit.best.a },
          models: fit.fits.map((f) => ({ key: f.key, label: f.label, a: f.a, sse: f.sse })),
          slope: Math.round(fit.slope * 100) / 100,
          r2: Math.round(fit.r2 * 1000) / 1000,
          used: fit.used,
        }
      : { reason: fit.reason, used: fit.used },
    classification: verdict.classification,
    message: verdict.message,
    language: lang.label,
  };
}
