import test from 'node:test';
import assert from 'node:assert/strict';
import { median, bootstrapMedian, speedFactorFrom, mulberry32 } from '../src/stats.js';
import { measureWithPolicy } from '../src/timing.js';
import { compareOutput } from '../src/compare.js';

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('bootstrap interval brackets the median', () => {
  const rng = mulberry32(7);
  const s = bootstrapMedian([95, 100, 105, 98, 102], { limit: 110, rng });
  assert.ok(s.low <= s.median && s.median <= s.high);
  assert.equal(s.pWithin, 1);
});

test('speed factor shrinks times on a slow machine, never above 1.05', () => {
  const quiet = [100, 101, 99, 100, 102, 100];
  assert.ok(speedFactorFrom(quiet, 100) > 0.98);
  assert.ok(speedFactorFrom(quiet, 150) < 0.7);
  assert.ok(speedFactorFrom(quiet, 50) <= 1.05);
  assert.equal(speedFactorFrom([], 100), 1);
});

const fake = (times) => {
  let i = 0;
  return async () => ({ cpuMs: times[Math.min(++i, times.length - 1)] });
};

test('adaptive: clearly fast = one run, no statistics', async () => {
  let calls = 0;
  const r = await measureWithPolicy({ first: { cpuMs: 500 }, runOnce: async () => { calls++; return { cpuMs: 500 }; }, limitMs: 1000 });
  assert.equal(r.timeOk, true);
  assert.equal(r.borderline, false);
  assert.equal(calls, 0);
});

test('adaptive: clearly slow = TLE after one run', async () => {
  const r = await measureWithPolicy({ first: { cpuMs: 1500 }, runOnce: fake([1500]), limitMs: 1000 });
  assert.equal(r.timeOk, false);
  assert.equal(r.borderline, false);
});

test('adaptive: borderline re-runs and reports confidence', async () => {
  const rng = mulberry32(3);
  const r = await measureWithPolicy({ first: { cpuMs: 1050 }, runOnce: fake([1050, 900, 920, 940, 950]), limitMs: 1000, rng });
  assert.equal(r.borderline, true);
  assert.equal(r.runs.length, 5);
  assert.equal(r.timeOk, true);
  assert.ok(r.confidence >= 0.5 && r.confidence <= 1);
  assert.ok(r.ciLow <= r.ciHigh);
});

test('adaptive: borderline but consistently over the limit = TLE', async () => {
  const r = await measureWithPolicy({ first: { cpuMs: 1100 }, runOnce: fake([1100, 1090, 1110, 1105, 1095]), limitMs: 1000, rng: mulberry32(1) });
  assert.equal(r.timeOk, false);
  assert.equal(r.borderline, true);
});

test('wall-killed run is an immediate TLE', async () => {
  const r = await measureWithPolicy({ first: { cpuMs: 10, wallKilled: true }, runOnce: fake([10]), limitMs: 1000 });
  assert.equal(r.timeOk, false);
  assert.equal(r.confidence, 1);
});

test('speed factor is applied before comparing with the limit', async () => {
  const r = await measureWithPolicy({ first: { cpuMs: 1300 }, runOnce: fake([1300]), limitMs: 1000, speedFactor: 0.7 });
  // 1300 * 0.7 = 910 -> inside the borderline band, not an immediate TLE
  assert.equal(r.borderline, true);
});

test('policies single and fixed3', async () => {
  const s = await measureWithPolicy({ first: { cpuMs: 1010 }, runOnce: fake([900]), limitMs: 1000, policy: 'single' });
  assert.equal(s.timeOk, false);
  const f = await measureWithPolicy({ first: { cpuMs: 1010 }, runOnce: fake([1010, 900, 905]), limitMs: 1000, policy: 'fixed3', rng: mulberry32(2) });
  assert.equal(f.runs.length, 3);
  assert.equal(f.timeOk, true);
});

test('compare: token, exact, float', () => {
  assert.equal(compareOutput('1 2 3\n', '1\n2\n3', { type: 'token' }), true);
  assert.equal(compareOutput('1 2', '1 3', { type: 'token' }), false);
  assert.equal(compareOutput('a  b\n', 'a  b', { type: 'exact' }), true);
  assert.equal(compareOutput('a b', 'a  b', { type: 'exact' }), false);
  assert.equal(compareOutput('3.1415927', '3.14159265', { type: 'float', epsilon: 1e-6 }), true);
  assert.equal(compareOutput('3.2', '3.1', { type: 'float', epsilon: 1e-6 }), false);
});
