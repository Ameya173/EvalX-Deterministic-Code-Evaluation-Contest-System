import { LANGUAGES, compareOutput, measureWithPolicy, median, speedFactorFrom } from '@judgebox/shared/core';

/** Limits for one problem + language. Times are CPU milliseconds. */
export function limitsFor(problem, language) {
  const lang = LANGUAGES[language];
  const cpuLimit = Math.round(problem.timeLimitMs * lang.timeMultiplier);
  const memKb = problem.memoryKb;
  return {
    cpuLimit,
    wallMs: cpuLimit * 3 + 2000,
    memKb,
    // RLIMIT_AS works for native code and CPython; the JVM and Node reserve huge address space, so they use heap flags instead.
    asKb: language === 'cpp' ? memKb : language === 'python' ? memKb + 65536 : 0,
    heapMb: Math.max(32, Math.floor(memKb / 1024) - 64),
  };
}

export function containerMemoryMb(problem) {
  return Math.max(768, Math.ceil(problem.memoryKb / 1024) * 2 + 256);
}

/** Measure the current speed of the machine with the canary program (C1). */
export async function calibrate(sandbox, calib, runs = 3) {
  const r = await sandbox.request({ cmd: 'canary', runs }, 120000);
  const current = median(r.runs);
  calib.history.push(current);
  if (calib.history.length > 100) calib.history.shift();
  return { canaryMs: current, speedFactor: speedFactorFrom(calib.history, current) };
}

export function normalizeRun(r) {
  if (r.error) throw new Error(`Sandbox error: ${r.error}`);
  return {
    cpuMs: r.cpu_ms,
    wallMs: r.wall_ms,
    memKb: r.mem_kb,
    exit: r.exit,
    signal: r.signal,
    wallKilled: !!r.wall_killed,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    outTruncated: !!r.out_truncated,
  };
}

const SIGXCPU = 24;
const SIGXFSZ = 25;
const round1 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);

export function makeRunner(sandbox, { name = 'sub', language, limits }) {
  return async (input, overrides = {}) => {
    const r = await sandbox.request(
      {
        cmd: 'run',
        name,
        lang: language,
        input,
        cpuMs: limits.cpuLimit,
        wallMs: limits.wallMs,
        asKb: limits.asKb,
        heapMb: limits.heapMb,
        outLimitKb: 16384,
        ...overrides,
      },
      limits.wallMs + 30000
    );
    return normalizeRun(r);
  };
}

/** Judge a single test: output correctness first, then the noise-aware time decision. */
export async function judgeOneTest({ run, test, problem, limits, speedFactor, policy, rng }) {
  const first = await run(test.input);
  const base = { ordinal: test.ordinal, isSample: !!test.isSample, rawMs: round1(first.cpuMs), memKb: first.memKb, borderline: false };
  const fail = (verdict, extra = {}) => ({
    ...base,
    verdict,
    timeMs: round1(first.cpuMs * speedFactor),
    runs: [round1(first.cpuMs * speedFactor)],
    confidence: null,
    ciLow: null,
    ciHigh: null,
    ...extra,
  });

  if (first.wallKilled || first.signal === SIGXCPU) return fail('TLE', { timeMs: round1(limits.cpuLimit * 3), confidence: 1 });
  if (first.outTruncated || first.signal === SIGXFSZ) return fail('OLE');
  if (first.signal || first.exit !== 0) {
    const nearMemory = first.memKb > limits.memKb * 0.9;
    return fail(nearMemory ? 'MLE' : 'RE', { stderr: first.stderr.slice(0, 300) });
  }
  if (first.memKb > limits.memKb) return fail('MLE');

  const correct = compareOutput(first.stdout, test.output, { type: problem.checkerType, epsilon: problem.checkerEpsilon });
  const firstNorm = first.cpuMs * speedFactor;
  if (!correct && firstNorm < 1.2 * limits.cpuLimit) return fail('WA');

  const timing = await measureWithPolicy({
    first: { cpuMs: first.cpuMs, wallKilled: false },
    runOnce: async () => {
      const r = await run(test.input);
      return { cpuMs: r.cpuMs, wallKilled: r.wallKilled };
    },
    limitMs: limits.cpuLimit,
    speedFactor,
    policy,
    rng,
  });
  const timed = {
    ...base,
    timeMs: round1(timing.median),
    runs: timing.runs.map(round1),
    ciLow: round1(timing.ciLow),
    ciHigh: round1(timing.ciHigh),
    confidence: timing.confidence == null ? null : Math.round(timing.confidence * 1000) / 1000,
    borderline: timing.borderline,
  };
  if (!timing.timeOk) return { ...timed, verdict: 'TLE' };
  if (!correct) return { ...timed, verdict: 'WA' };
  return { ...timed, verdict: 'AC' };
}

/**
 * Judge a whole submission (no database access; easy to test).
 * Returns { verdict, failedTest, tests, maxTimeMs, maxMemKb, compileLog, speedFactor, canaryMs, borderline, minConfidence }.
 */
export async function judgeCore({ submission, problem, tests, sandbox, calib, policy = 'adaptive', rng = Math.random, onProgress = () => {} }) {
  const language = submission.language;
  const limits = limitsFor(problem, language);

  const comp = await sandbox.request({ cmd: 'compile', name: 'sub', lang: language, source: submission.source }, 120000);
  if (comp.error) throw new Error(`Sandbox error: ${comp.error}`);
  if (!comp.ok) {
    return { verdict: 'CE', failedTest: null, tests: [], compileLog: comp.log, speedFactor: 1, borderline: false, minConfidence: null, maxTimeMs: 0, maxMemKb: 0 };
  }

  const { speedFactor, canaryMs } = await calibrate(sandbox, calib);
  const run = makeRunner(sandbox, { language, limits });
  const results = [];
  let verdict = 'AC';
  let failedTest = null;
  for (const test of tests) {
    const r = await judgeOneTest({ run, test, problem, limits, speedFactor, policy, rng });
    results.push(r);
    await onProgress(results.length, tests.length);
    if (r.verdict !== 'AC') {
      verdict = r.verdict;
      failedTest = r.ordinal;
      break;
    }
  }

  const conf = results.filter((r) => r.borderline && r.confidence != null).map((r) => r.confidence);
  return {
    verdict,
    failedTest,
    tests: results,
    compileLog: comp.log || '',
    speedFactor: Math.round(speedFactor * 1000) / 1000,
    canaryMs,
    borderline: results.some((r) => r.borderline),
    minConfidence: conf.length ? Math.min(...conf) : null,
    maxTimeMs: results.length ? Math.max(...results.map((r) => r.timeMs || 0)) : 0,
    maxMemKb: results.length ? Math.max(...results.map((r) => r.memKb || 0)) : 0,
  };
}
