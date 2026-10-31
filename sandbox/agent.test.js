// Integration test for runner.c + agent.js without Docker (needs gcc, g++ and python3 on the host).
// Run with: npm test   (skipped automatically when the toolchain is missing)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const here = dirname(fileURLToPath(import.meta.url));
const have = (c) => spawnSync(c, ['--version']).status === 0;
const skip = !(have('gcc') && have('g++') && have('python3')) || process.platform === 'win32';

let work, proc, rl, nextId = 1;
const pending = new Map();

function send(cmd) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ id, ...cmd }) + '\n');
  });
}

test('agent protocol', { skip }, async (t) => {
  work = mkdtempSync(join(tmpdir(), 'jb-'));
  const runner = join(work, 'runner');
  const canary = join(work, 'canary');
  assert.equal(spawnSync('gcc', ['-O2', '-o', runner, join(here, 'runner.c')]).status, 0);
  assert.equal(spawnSync('gcc', ['-O1', '-o', canary, join(here, 'canary.c')]).status, 0);
  proc = spawn('node', [join(here, 'agent.cjs')], { env: { ...process.env, WORK_DIR: join(work, 'w'), RUNNER: runner, CANARY: canary } });
  rl = readline.createInterface({ input: proc.stdout });
  rl.on('line', (l) => {
    const m = JSON.parse(l);
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  t.after(() => {
    proc.kill();
    rmSync(work, { recursive: true, force: true });
  });

  assert.equal((await send({ cmd: 'ping' })).pong, true);

  const run = (extra) => send({ cmd: 'run', name: 'sub', lang: 'cpp', cpuMs: 1000, wallMs: 4000, asKb: 0, ...extra });

  await t.test('compile + run A+B', async () => {
    const c = await send({ cmd: 'compile', name: 'sub', lang: 'cpp', source: '#include <cstdio>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);}' });
    assert.equal(c.ok, true);
    const r = await run({ input: '2 40\n' });
    assert.equal(r.stdout.trim(), '42');
    assert.equal(r.exit, 0);
    assert.equal(r.signal, 0);
    assert.ok(r.mem_kb > 0);
  });

  await t.test('compile error is reported', async () => {
    const c = await send({ cmd: 'compile', name: 'bad', lang: 'cpp', source: 'int main( { return 0 }' });
    assert.equal(c.ok, false);
    assert.ok(c.log.length > 0);
  });

  await t.test('CPU time is measured from rusage, not wall time', async () => {
    await send({ cmd: 'compile', name: 'cpu', lang: 'cpp', source: 'int main(){volatile unsigned long long s=0;for(long i=0;i<150000000L;i++)s+=i;return 0;}' });
    const r = await send({ cmd: 'run', name: 'cpu', lang: 'cpp', input: '', cpuMs: 20000, wallMs: 30000 });
    assert.ok(r.cpu_ms > 50, `cpu_ms=${r.cpu_ms}`);
    assert.ok(Math.abs(r.cpu_ms - r.wall_ms) < r.wall_ms * 0.5 + 50);
  });

  await t.test('sleeping program is killed by the wall limit', async () => {
    await send({ cmd: 'compile', name: 'sleep', lang: 'cpp', source: '#include <unistd.h>\nint main(){sleep(30);}' });
    const r = await send({ cmd: 'run', name: 'sleep', lang: 'cpp', input: '', cpuMs: 200, wallMs: 600 });
    assert.equal(r.wall_killed, 1);
    assert.ok(r.cpu_ms < 100);
  });

  await t.test('infinite loop is stopped (wall limit or CPU rlimit)', async () => {
    await send({ cmd: 'compile', name: 'loop', lang: 'cpp', source: 'int main(){for(;;);}' });
    const r = await send({ cmd: 'run', name: 'loop', lang: 'cpp', input: '', cpuMs: 300, wallMs: 900 });
    assert.ok(r.wall_killed === 1 || r.signal === 24 || r.signal === 9);
  });

  await t.test('runtime error: segfault and non-zero exit', async () => {
    await send({ cmd: 'compile', name: 'segv', lang: 'cpp', source: '#include <csignal>\nint main(){raise(SIGSEGV);}' });
    const r = await send({ cmd: 'run', name: 'segv', lang: 'cpp', input: '', cpuMs: 1000, wallMs: 3000 });
    assert.equal(r.signal, 11);
    await send({ cmd: 'compile', name: 'ex', lang: 'cpp', source: 'int main(){return 3;}' });
    const r2 = await send({ cmd: 'run', name: 'ex', lang: 'cpp', input: '', cpuMs: 1000, wallMs: 3000 });
    assert.equal(r2.exit, 3);
  });

  await t.test('address-space limit stops a memory bomb', async () => {
    await send({ cmd: 'compile', name: 'mem', lang: 'cpp', source: '#include <cstdlib>\n#include <cstring>\nint main(){for(;;){char*p=(char*)malloc(1<<26);if(!p)return 7;memset(p,1,1<<26);}}' });
    const r = await send({ cmd: 'run', name: 'mem', lang: 'cpp', input: '', cpuMs: 5000, wallMs: 10000, asKb: 262144 });
    assert.equal(r.exit, 7);
  });

  await t.test('output limit (RLIMIT_FSIZE) stops output flooding', async () => {
    await send({ cmd: 'compile', name: 'flood', lang: 'cpp', source: '#include <cstdio>\nint main(){for(;;)putchar(65);}' });
    const r = await send({ cmd: 'run', name: 'flood', lang: 'cpp', input: '', cpuMs: 5000, wallMs: 10000, outLimitKb: 64 });
    assert.equal(r.signal, 25);
  });

  await t.test('python run', async () => {
    const c = await send({ cmd: 'compile', name: 'py', lang: 'python', source: 'a,b=map(int,input().split())\nprint(a*b)\n' });
    assert.equal(c.ok, true);
    const r = await send({ cmd: 'run', name: 'py', lang: 'python', input: '6 7\n', cpuMs: 2000, wallMs: 6000 });
    assert.equal(r.stdout.trim(), '42');
  });

  await t.test('generator and scale command', async () => {
    const gen = 'import sys\nn,seed=map(int,sys.stdin.read().split())\nprint(n)\nprint(*range(n))\n';
    await send({ cmd: 'compile', name: 'gen', lang: 'python', source: gen });
    const g = await send({ cmd: 'gen', name: 'gen', lang: 'python', n: 5, seed: 1 });
    assert.equal(g.stdout.trim(), '5\n0 1 2 3 4');
    await send({ cmd: 'compile', name: 'sum', lang: 'cpp', source: '#include <cstdio>\nint main(){int n;scanf("%d",&n);long long s=0;for(int i=0;i<n;i++){int x;scanf("%d",&x);s+=x;}printf("%lld\\n",s);}' });
    const s = await send({ cmd: 'scale', gen: 'gen', genLang: 'python', name: 'sum', lang: 'cpp', n: 20000, seed: 1, cpuMs: 2000, wallMs: 6000 });
    assert.equal(s.sub.exit, 0);
    assert.ok(s.inputBytes > 20000);
  });

  await t.test('canary returns positive CPU times', async () => {
    const r = await send({ cmd: 'canary', runs: 2 });
    assert.equal(r.runs.length, 2);
    assert.ok(r.runs.every((x) => x > 20));
  });
});
