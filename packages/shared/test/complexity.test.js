import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, fitComplexity, classifyComplexity, parseComplexity, generateSizes } from '../src/complexity.js';

function synth(key, { a = 1e-4, noise = 0, seed = 1 } = {}) {
  const m = MODELS.find((x) => x.key === key);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  return generateSizes(1000, 256000).map((n) => ({ n, ms: Math.max(0.0001, a * m.f(n) * (1 + noise * rnd())) }));
}

for (const key of ['n', 'n log n', 'n^2', 'n^3']) {
  test(`fit recovers ${key} from clean data`, () => {
    const fit = fitComplexity(synth(key, { a: key === 'n^3' ? 1e-9 : key === 'n^2' ? 1e-6 : 1e-3 }));
    assert.equal(fit.ok, true);
    assert.equal(fit.best.key, key);
    assert.ok(fit.r2 > 0.95);
  });
}

test('fit tolerates 8% noise on n^2', () => {
  const fit = fitComplexity(synth('n^2', { a: 1e-6, noise: 0.08 }));
  assert.equal(fit.best.key, 'n^2');
});

test('too few measurable points is inconclusive', () => {
  const fit = fitComplexity([{ n: 10, ms: 1 }, { n: 20, ms: 2 }]);
  assert.equal(fit.ok, false);
  assert.equal(classifyComplexity({ fit, declaredKey: 'n' }).classification, 'inconclusive');
});

test('classification: asymptotic, constant-factor, unclear', () => {
  const quad = fitComplexity(synth('n^2', { a: 1e-6 }));
  assert.equal(classifyComplexity({ fit: quad, declaredKey: 'n log n', ratioVsReference: 40 }).classification, 'asymptotic');
  const lin = fitComplexity(synth('n', { a: 1e-3 }));
  assert.equal(classifyComplexity({ fit: lin, declaredKey: 'n', ratioVsReference: 6 }).classification, 'constant-factor');
  assert.equal(classifyComplexity({ fit: lin, declaredKey: 'n', ratioVsReference: 1.1 }).classification, 'unclear');
});

test('parseComplexity accepts common spellings', () => {
  assert.equal(parseComplexity('O(n log n)'), 'n log n');
  assert.equal(parseComplexity('n log n'), 'n log n');
  assert.equal(parseComplexity('nlogn'), 'n log n');
  assert.equal(parseComplexity('N^2'), 'n^2');
  assert.equal(parseComplexity('O(n)'), 'n');
  assert.equal(parseComplexity('log n'), 'log n');
  assert.equal(parseComplexity('weird'), null);
});

test('generateSizes is geometric and bounded', () => {
  assert.deepEqual(generateSizes(1000, 8000), [1000, 2000, 4000, 8000]);
  assert.ok(generateSizes(2, 1e12).length <= 9);
});
