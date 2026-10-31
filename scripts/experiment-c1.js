// Experiment E7 (C1): how stable are verdicts under different timing policies?
//
// The time limit is set to the solution's own median CPU time, so the "right" verdict is a coin flip
// and any instability from machine noise becomes visible. Each policy judges the same test many times.
//
// Usage:
//   npm run experiment:c1 -- --file docs/samples/sort-correct.cpp --lang cpp --problem sort-numbers --test 6 --trials 100
//   add  --load 2  to run 2 busy processes on this machine during the experiment (simulated noisy neighbours)
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { sampleProblems, median } from '@judgebox/shared/core';
import { DockerSandbox, ensureSandboxImage } from '../apps/worker/src/sandbox.js';
import { calibrate, judgeOneTest, makeRunner } from '../apps/worker/src/judge/judgeCore.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []));
const file = args.file || 'docs/samples/sort-correct.cpp';
const language = args.lang || 'cpp';
const slug = args.problem || 'sort-numbers';
const testIndex = Number(args.test || 6) - 1;
const trials = Number(args.trials || 60);
const load = Number(args.load || 0);
const image = process.env.SANDBOX_IMAGE || 'judgebox-sandbox';

const problem = sampleProblems().find((p) => p.slug === slug);
if (!problem) throw new Error(`Unknown sample problem ${slug}`);
const test = { ...problem.tests[testIndex], ordinal: testIndex + 1 };

await ensureSandboxImage(image);
const sandbox = await DockerSandbox.create({ image, memoryMb: 1024 });
const loaders = [];
for (let i = 0; i < load; i++) loaders.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));

try {
  const comp = await sandbox.request({ cmd: 'compile', name: 'sub', lang: language, source: readFileSync(file, 'utf8') }, 120000);
  if (!comp.ok) throw new Error(`Compile error: ${comp.log}`);
  const calib = { history: [] };
  const baseLimits = { cpuLimit: 1000, wallMs: 20000, memKb: problem.memoryKb, asKb: language === 'cpp' ? problem.memoryKb : 0, heapMb: 192 };
  const probeRun = makeRunner(sandbox, { language, limits: baseLimits });
  const probe = [];
  for (let i = 0; i < 7; i++) probe.push((await probeRun(test.input)).cpuMs);
  const limitMs = Math.round(median(probe));
  console.log(`Solution median CPU time: ${limitMs} ms -> using that as the limit (verdict is a coin flip by construction)`);

  const limits = { ...baseLimits, cpuLimit: limitMs, wallMs: limitMs * 3 + 2000 };
  const run = makeRunner(sandbox, { language, limits });
  const results = {};
  for (const policy of ['single', 'fixed3', 'adaptive']) {
    const verdicts = [];
    let runs = 0;
    let borderline = 0;
    for (let i = 0; i < trials; i++) {
      const { speedFactor } = await calibrate(sandbox, calib, 2);
      const r = await judgeOneTest({ run, test, problem, limits, speedFactor, policy });
      verdicts.push(r.verdict);
      runs += r.runs.length;
      if (r.borderline) borderline++;
    }
    const flips = verdicts.slice(1).filter((v, i) => v !== verdicts[i]).length;
    results[policy] = {
      AC: verdicts.filter((v) => v === 'AC').length,
      TLE: verdicts.filter((v) => v === 'TLE').length,
      flipRate: Math.round((flips / (trials - 1)) * 1000) / 1000,
      avgRunsPerJudgement: Math.round((runs / trials) * 100) / 100,
      borderlineShare: Math.round((borderline / trials) * 100) / 100,
    };
    console.log(policy.padEnd(9), JSON.stringify(results[policy]));
  }

  mkdirSync('benchmarks/results', { recursive: true });
  const out = `benchmarks/results/c1-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify({ file, language, slug, test: testIndex + 1, trials, load, limitMs, results, probe }, null, 2));
  console.log(`Saved ${out}`);
} finally {
  loaders.forEach((l) => l.kill());
  await sandbox.destroy();
}
process.exit(0);
