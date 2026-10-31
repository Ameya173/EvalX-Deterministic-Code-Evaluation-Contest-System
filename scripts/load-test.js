// Experiment E1: submission latency under concurrent load.
// Registers N throwaway users (the API allows 20 submissions per user per minute) and submits a correct
// solution many times in parallel, then reports p50/p95 time from submit to final verdict.
//
//   npm run loadtest -- --users 6 --submissions 60 --problem sort-numbers --file docs/samples/sort-correct.cpp
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const base = args.api || 'http://localhost:4000/api';
const users = Number(args.users || 5);
const total = Number(args.submissions || 40);
const problem = args.problem || 'sort-numbers';
const source = readFileSync(args.file || 'docs/samples/sort-correct.cpp', 'utf8');
const language = args.lang || 'cpp';

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.error || ''}`);
  return data;
}

const run = Date.now().toString(36);
const tokens = [];
for (let i = 0; i < users; i++) {
  const d = await call('/auth/register', { method: 'POST', body: { handle: `load_${run}_${i}`, email: `load_${run}_${i}@example.com`, password: 'LoadTest#12345' } });
  tokens.push(d.accessToken);
}
console.log(`Registered ${users} users. Submitting ${total} solutions of "${problem}"...`);

const latencies = [];
const verdicts = {};
const started = Date.now();
async function one(i) {
  const token = tokens[i % tokens.length];
  const t0 = Date.now();
  const { submission } = await call('/submissions', { method: 'POST', token, body: { problemSlug: problem, language, source } });
  for (;;) {
    await new Promise((r) => setTimeout(r, 700));
    const { submission: s } = await call(`/submissions/${submission.id}`, { token });
    if (s.status === 'done') {
      latencies.push(Date.now() - t0);
      verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1;
      return;
    }
  }
}
await Promise.all(Array.from({ length: total }, (_, i) => one(i)));

latencies.sort((a, b) => a - b);
const q = (p) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))];
const wall = (Date.now() - started) / 1000;
console.log(JSON.stringify({ submissions: total, users, wallSeconds: wall, throughputPerMinute: Math.round((total / wall) * 60), p50Ms: q(0.5), p95Ms: q(0.95), maxMs: latencies.at(-1), verdicts }, null, 2));
