import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMutants } from '../src/mutate.js';
import { computeScoreboard } from '../src/scoreboard.js';

const CPP = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    long long best = a[0], cur = 0;
    for (int i = 0; i < n; i++) {
        cur = max(a[i], cur + a[i]);
        if (cur > best) best = cur;
    }
    cout << "a < b" << best << endl; // x < y
}
`;

test('cpp mutants are deterministic, differ from the original and skip strings, comments and includes', () => {
  const a = generateMutants(CPP, 'cpp', { max: 50, seed: 5 });
  const b = generateMutants(CPP, 'cpp', { max: 50, seed: 5 });
  assert.deepEqual(a.map((m) => m.id + m.snippet), b.map((m) => m.id + m.snippet));
  assert.ok(a.length >= 5);
  for (const m of a) {
    assert.notEqual(m.source, CPP);
    assert.ok(!m.snippet.startsWith('#include'));
    // string literal and comment contents must not be mutated
    assert.ok(m.source.includes('"a < b"'));
    assert.ok(m.source.includes('// x < y'));
  }
  const ops = new Set(a.map((m) => m.operator));
  assert.ok(ops.has('ROR') && ops.has('CONST'));
});

test('max limits the number of mutants and sources are unique', () => {
  const ms = generateMutants(CPP, 'cpp', { max: 4, seed: 1 });
  assert.equal(ms.length, 4);
  assert.equal(new Set(ms.map((m) => m.source)).size, 4);
});

test('python mutants include and/or swaps', () => {
  const py = 'x = int(input())\nif x > 3 and x < 10:\n    print(x + 1)\n';
  const ms = generateMutants(py, 'python', { max: 40, seed: 2 });
  assert.ok(ms.some((m) => m.original === 'and' && m.replacement === 'or'));
  assert.ok(ms.some((m) => m.operator === 'CONST'));
});

const T0 = Date.parse('2026-01-01T10:00:00Z');
const at = (min) => new Date(T0 + min * 60000);
const contest = {
  startsAt: at(0),
  endsAt: at(120),
  freezeAt: at(90),
  problems: [{ problemId: 'p1', label: 'A' }, { problemId: 'p2', label: 'B' }],
};
const sub = (user, problem, verdict, min, status = 'done') => ({ userId: user, handle: user, problemId: problem, verdict, status, createdAt: at(min) });

test('ICPC scoring: penalty and ranking', () => {
  const subs = [
    sub('u1', 'p1', 'WA', 5), sub('u1', 'p1', 'AC', 10), // 10 + 20 = 30
    sub('u1', 'p2', 'AC', 40),                              // +40 => 70
    sub('u2', 'p1', 'AC', 20),                              // 20, solved 1
    sub('u3', 'p1', 'CE', 3), sub('u3', 'p1', 'AC', 15),   // CE ignored => 15
  ];
  const sb = computeScoreboard(contest, subs, { now: at(60) });
  assert.deepEqual(sb.rows.map((r) => r.userId), ['u1', 'u3', 'u2']);
  assert.equal(sb.rows[0].penalty, 70);
  assert.equal(sb.rows[1].penalty, 15);
});

test('submissions after the freeze are hidden from the public view', () => {
  const subs = [sub('u1', 'p1', 'AC', 30), sub('u2', 'p1', 'AC', 100)];
  const pub = computeScoreboard(contest, subs, { now: at(110) });
  assert.equal(pub.rows.find((r) => r.userId === 'u2').solved, 0);
  assert.equal(pub.rows.find((r) => r.userId === 'u2').problems.A.pending, 1);
  assert.equal(pub.frozen, true);
  const admin = computeScoreboard(contest, subs, { now: at(110), showFrozen: true });
  assert.equal(admin.rows.find((r) => r.userId === 'u2').solved, 1);
});

test('submissions outside the window and pending verdicts are not scored', () => {
  const subs = [sub('u1', 'p1', 'AC', -5), sub('u1', 'p1', 'AC', 130), sub('u2', 'p1', 'AC', 10, 'judging')];
  const sb = computeScoreboard(contest, subs, { now: at(60) });
  assert.equal(sb.rows.length, 1);
  assert.equal(sb.rows[0].solved, 0);
});
