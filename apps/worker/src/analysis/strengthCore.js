import { LANGUAGES, compareOutput, generateMutants } from '@judgebox/shared/core';

const SCHEDULE = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50];

/**
 * C3: score how well the test suite catches bugs in the reference solution.
 *
 *  1. Mutate the reference solution (relational, arithmetic, logical operators, constants).
 *  2. A mutant that fails any test in the suite is "killed".
 *  3. A mutant the suite does not catch is run against random small inputs from the
 *     generator; if it ever disagrees with the reference it is a real, non-equivalent bug
 *     the suite misses ("survived") and the distinguishing input is proposed as a new test.
 *     If it never disagrees it is treated as likely equivalent and excluded from the score.
 *  score = killed / (killed + survived)
 */
export async function strengthCore({ problem, tests, sandbox, maxMutants = 30, stressCount = 40, onProgress = () => {} }) {
  const refLang = problem.reference?.lang;
  if (!problem.reference?.source) throw new Error('This problem needs a reference solution.');
  if (!['cpp', 'python'].includes(refLang)) throw new Error('Strength analysis supports C++ and Python reference solutions.');
  if (!problem.generator?.source) throw new Error('This problem needs a generator (reads "n seed") to find distinguishing inputs.');
  if (!tests.length) throw new Error('The problem has no tests yet.');

  const genLang = problem.generator.lang || 'python';
  const langCfg = LANGUAGES[refLang];
  const cpuMs = Math.max(1000, Math.round(problem.timeLimitMs * langCfg.timeMultiplier * 2));
  const wallMs = cpuMs * 2 + 1000;

  const comp = async (name, lang, source) => sandbox.request({ cmd: 'compile', name, lang, source }, 120000);
  const ref = await comp('ref', refLang, problem.reference.source);
  if (!ref.ok) throw new Error(`Reference does not compile: ${ref.log}`);
  const gen = await comp('gen', genLang, problem.generator.source);
  if (!gen.ok) throw new Error(`Generator does not compile: ${gen.log}`);

  const exec = async (name, input) => {
    const r = await sandbox.request(
      { cmd: 'run', name, lang: refLang, input, cpuMs, wallMs, asKb: refLang === 'cpp' ? problem.memoryKb : 0, outLimitKb: 4096 },
      wallMs + 30000
    );
    if (r.error) throw new Error(r.error);
    const crashed = r.wall_killed || r.signal || r.exit !== 0 || r.out_truncated;
    return { crashed: !!crashed, stdout: r.stdout || '' };
  };
  const same = (a, b) => compareOutput(a, b, { type: problem.checkerType, epsilon: problem.checkerEpsilon });

  // Stress inputs with reference outputs (smallest first).
  const stress = [];
  for (let i = 0; i < stressCount; i++) {
    const n = SCHEDULE[i % SCHEDULE.length];
    const g = await sandbox.request({ cmd: 'gen', name: 'gen', lang: genLang, n, seed: i + 1, capKb: 256 }, 60000);
    if (g.error || g.exit !== 0 || g.truncated || !g.stdout) continue;
    const out = await exec('ref', g.stdout);
    if (out.crashed) continue;
    stress.push({ input: g.stdout, expected: out.stdout });
  }
  stress.sort((a, b) => a.input.length - b.input.length);

  const orderedTests = [...tests].sort((a, b) => a.input.length - b.input.length);
  const mutants = generateMutants(problem.reference.source, refLang, { max: maxMutants, seed: 1 });
  const results = [];

  for (let i = 0; i < mutants.length; i++) {
    const m = mutants[i];
    const info = { id: m.id, operator: m.operator, line: m.line, original: m.original, replacement: m.replacement, snippet: m.snippet };
    const c = await comp('mut', refLang, m.source);
    if (!c.ok) {
      results.push({ ...info, status: 'invalid' });
      await onProgress(i + 1, mutants.length);
      continue;
    }

    let killedBy = null;
    for (const t of orderedTests) {
      const r = await exec('mut', t.input);
      if (r.crashed || !same(r.stdout, t.output)) {
        killedBy = t.ordinal;
        break;
      }
    }
    if (killedBy !== null) {
      results.push({ ...info, status: 'killed', killedBy });
    } else {
      let found = null;
      for (const s of stress) {
        const r = await exec('mut', s.input);
        if (r.crashed || !same(r.stdout, s.expected)) {
          found = s;
          break;
        }
      }
      results.push(found ? { ...info, status: 'survived', distinguishingInput: found.input, expected: found.expected } : { ...info, status: 'equivalent' });
    }
    await onProgress(i + 1, mutants.length);
  }

  const killed = results.filter((r) => r.status === 'killed').length;
  const survived = results.filter((r) => r.status === 'survived').length;
  return {
    score: killed + survived > 0 ? killed / (killed + survived) : null,
    mutantsTotal: results.length,
    killed,
    survived,
    equivalent: results.filter((r) => r.status === 'equivalent').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    nonEquivalent: killed + survived,
    stressInputs: stress.length,
    suiteSize: tests.length,
    mutants: results,
  };
}
