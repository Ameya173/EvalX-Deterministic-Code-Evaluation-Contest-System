// End-to-end test of judging, C1 timing, C2 complexity analysis and C3 strength scoring
// against a local (non-Docker) sandbox. Needs Linux with gcc, g++ and python3; skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleProblems } from '../../../packages/shared/src/sampleProblems.js';
import { mulberry32 } from '../../../packages/shared/src/stats.js';
import { judgeCore } from '../src/judge/judgeCore.js';
import { complexityCore } from '../src/analysis/complexityCore.js';
import { strengthCore } from '../src/analysis/strengthCore.js';
import { canRunLocally, createLocalSandbox } from './localSandbox.js';

const samples = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/samples');
const src = (f) => readFileSync(join(samples, f), 'utf8');
const problems = Object.fromEntries(sampleProblems().map((p) => [p.slug, p]));
const withOrdinals = (p) => p.tests.map((t, i) => ({ ...t, ordinal: i + 1 }));

test('judging pipeline', { skip: !canRunLocally }, async (t) => {
  const sandbox = await createLocalSandbox();
  t.after(() => sandbox.destroy());
  const calib = { history: [] };
  const judge = (problem, language, source, extra = {}) =>
    judgeCore({ submission: { language, source }, problem, tests: withOrdinals(problem), sandbox, calib, rng: mulberry32(1), ...extra });

  await t.test('reference solution is accepted on every sample problem', async () => {
    for (const p of Object.values(problems)) {
      const r = await judge(p, 'cpp', p.reference.source);
      assert.equal(r.verdict, 'AC', `${p.slug}: ${r.verdict} ${r.compileLog}`);
      assert.equal(r.tests.length, p.tests.length);
    }
  });

  await t.test('wrong answer, compile error and runtime error', async () => {
    const wa = await judge(problems['sort-numbers'], 'cpp', src('wrong-answer.cpp'));
    assert.equal(wa.verdict, 'WA');
    const ce = await judge(problems['sort-numbers'], 'cpp', 'int main( {');
    assert.equal(ce.verdict, 'CE');
    assert.ok(ce.compileLog.length > 0);
    const re = await judge(problems['a-plus-b'], 'cpp', 'int main(){ int *p = 0; *p = 1; }');
    assert.equal(re.verdict, 'RE');
  });

  await t.test('python solution is accepted (3x time multiplier)', async () => {
    const r = await judge(problems['sort-numbers'], 'python', src('sort-slow-constant.py'));
    assert.equal(r.verdict, 'AC');
  });

  await t.test('O(n^2) bubble sort gets TLE on the large test', async () => {
    const r = await judge(problems['sort-numbers'], 'cpp', src('sort-bubble-tle.cpp'));
    assert.equal(r.verdict, 'TLE');
    assert.equal(r.failedTest, 6);
  });

  await t.test('C1: a borderline test is re-run and reports confidence', async () => {
    // Use a program whose CPU time lands near the limit, so the adaptive policy must re-run.
    const spin = '#include <cstdio>\nint main(){volatile unsigned long long s=0;for(long i=0;i<%N%L;i++)s+=i;return 0;}';
    const problem = { ...problems['a-plus-b'], timeLimitMs: 500 };
    // calibrate the loop length so one run takes roughly 480 ms of CPU
    const probe = await sandbox.request({ cmd: 'compile', name: 'probe', lang: 'cpp', source: spin.replace('%N%', '200000000') });
    assert.equal(probe.ok, true);
    const pr = await sandbox.request({ cmd: 'run', name: 'probe', lang: 'cpp', input: '', cpuMs: 20000, wallMs: 30000 });
    const iters = Math.round((200000000 * 480) / pr.cpu_ms);
    const r = await judgeCore({
      submission: { language: 'cpp', source: spin.replace('%N%', String(iters)) },
      problem,
      tests: [{ ordinal: 1, input: '', output: '' }],
      sandbox,
      calib,
      rng: mulberry32(9),
    });
    const tr = r.tests[0];
    assert.equal(tr.borderline, true, `time ${tr.rawMs}ms vs limit 500ms`);
    assert.ok(tr.runs.length >= 3);
    assert.ok(tr.confidence >= 0.5 && tr.confidence <= 1);
    assert.ok(tr.ciLow <= tr.ciHigh);
    assert.ok(['AC', 'TLE'].includes(r.verdict));
    assert.ok(r.minConfidence >= 0.5);
  });

  await t.test('C2: bubble sort is diagnosed as quadratic and the reference as expected', async () => {
    const problem = { ...problems['sort-numbers'], scaling: { minN: 2000, maxN: 64000 } };
    const d = await complexityCore({ submission: { language: 'cpp', source: src('sort-bubble-tle.cpp') }, problem, sandbox, calib });
    assert.equal(d.fit.best.key, 'n^2', JSON.stringify(d.sizes));
    assert.equal(d.classification, 'asymptotic');
    assert.match(d.message, /n\^2/);
    assert.ok(d.sizes.length >= 5);
  });

  await t.test('C2: a correct n log n solution is not accused of a worse class', async () => {
    const problem = { ...problems['sort-numbers'], scaling: { minN: 4000, maxN: 128000 } };
    const d = await complexityCore({ submission: { language: 'cpp', source: src('sort-correct.cpp') }, problem, sandbox, calib });
    assert.notEqual(d.classification, 'asymptotic', d.message);
  });

  await t.test('C3: mutation testing scores the suite, finds survivors and proposes tests', async () => {
    const problem = problems['max-subarray'];
    const progress = [];
    const rep = await strengthCore({ problem, tests: withOrdinals(problem), sandbox, maxMutants: 14, stressCount: 25, onProgress: (d, n) => progress.push([d, n]) });
    assert.ok(rep.mutantsTotal >= 8, `mutants: ${rep.mutantsTotal}`);
    assert.ok(rep.killed >= 1);
    assert.ok(rep.score === null || (rep.score >= 0 && rep.score <= 1));
    for (const m of rep.mutants.filter((x) => x.status === 'survived')) {
      assert.ok(m.distinguishingInput && m.expected);
    }
    assert.equal(progress.at(-1)[0], progress.at(-1)[1]);
    assert.equal(rep.killed + rep.survived + rep.equivalent + rep.invalid, rep.mutantsTotal);
  });
});
