'use strict';
/*
 * Sandbox agent. Runs INSIDE the sandbox container.
 * Protocol: one JSON object per line on stdin, one JSON object per line on stdout.
 * Every request has an "id"; the reply carries the same id.
 *
 * Commands: ping, compile, run, gen, scale, canary, cleanup
 * Untrusted code is only ever executed through the C runner (rlimits, CPU accounting).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFile } = require('child_process');

const WORK = process.env.WORK_DIR || '/work';
const RUNNER = process.env.RUNNER || '/usr/local/bin/runner';
const CANARY = process.env.CANARY || '/opt/canary';

const LANGS = {
  cpp: {
    file: 'main.cpp',
    compile: (d) => ['g++', '-O2', '-std=c++17', '-o', `${d}/main`, `${d}/main.cpp`],
    run: (d) => [`${d}/main`],
  },
  python: {
    file: 'main.py',
    compile: (d) => ['python3', '-m', 'py_compile', `${d}/main.py`],
    run: (d) => ['python3', `${d}/main.py`],
  },
  java: {
    file: 'Main.java',
    compile: (d) => ['javac', '-encoding', 'UTF-8', '-d', d, `${d}/Main.java`],
    run: (d, o) => ['java', `-Xmx${o.heapMb || 256}m`, '-Xss64m', '-XX:+UseSerialGC', '-XX:-UsePerfData', '-Xshare:auto', '-cp', d, 'Main'],
  },
  javascript: {
    file: 'main.js',
    compile: null,
    run: (d) => ['node', '--stack-size=4000', `${d}/main.js`],
  },
};

const safeName = (n) => String(n || 'sub').replace(/[^a-zA-Z0-9_-]/g, '_');
const dirOf = (name) => path.join(WORK, safeName(name));
const tail = (s, n) => (s.length > n ? s.slice(0, n) + '\n...[truncated]' : s);

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: opts.timeout || 30000, maxBuffer: 4 * 1024 * 1024, cwd: opts.cwd }, (err, stdout, stderr) => {
      resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function runWithRunner({ cpuMs, wallMs, asKb, fsizeKb, stdin, stdout, stderr }, cmd) {
  const args = [String(cpuMs), String(wallMs), String(asKb || 0), String(fsizeKb || 0), stdin, stdout, stderr, '--', ...cmd];
  const r = await exec(RUNNER, args, { timeout: wallMs + 15000 });
  const line = r.stdout.trim().split('\n').pop();
  try {
    return JSON.parse(line);
  } catch {
    return { cpu_ms: 0, wall_ms: 0, mem_kb: 0, exit: 99, signal: 0, wall_killed: 0, runner_error: tail(r.stderr || 'runner failed', 500) };
  }
}

function readCapped(file, capBytes) {
  try {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(st.size, capBytes));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return { text: buf.toString('utf8'), truncated: st.size > capBytes, size: st.size };
  } catch {
    return { text: '', truncated: false, size: 0 };
  }
}

async function cmdCompile(m) {
  const lang = LANGS[m.lang];
  if (!lang) return { ok: false, log: `Unsupported language: ${m.lang}` };
  const d = dirOf(m.name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, lang.file), m.source);
  if (!lang.compile) return { ok: true, log: '' };
  const [cmd, ...args] = lang.compile(d);
  const r = await exec(cmd, args, { timeout: 60000, cwd: d });
  if (r.err) return { ok: false, log: tail((r.stderr || r.stdout || String(r.err.message)).replaceAll(d + '/', ''), 6000) };
  return { ok: true, log: tail(r.stderr, 2000) };
}

async function cmdRun(m) {
  const lang = LANGS[m.lang];
  const d = dirOf(m.name);
  if (!lang) return { error: `Unsupported language: ${m.lang}` };
  fs.writeFileSync(path.join(d, 'in.txt'), m.input || '');
  const res = await runWithRunner(
    {
      cpuMs: m.cpuMs,
      wallMs: m.wallMs,
      asKb: m.asKb,
      fsizeKb: m.outLimitKb || 16384,
      stdin: path.join(d, 'in.txt'),
      stdout: path.join(d, 'out.txt'),
      stderr: path.join(d, 'err.txt'),
    },
    lang.run(d, { heapMb: m.heapMb })
  );
  const out = readCapped(path.join(d, 'out.txt'), (m.outLimitKb || 16384) * 1024);
  const err = readCapped(path.join(d, 'err.txt'), 2048);
  return { ...res, stdout: out.text, out_truncated: out.truncated, out_size: out.size, stderr: err.text };
}

// Run a generator program ("n seed" on stdin) and return its stdout.
async function cmdGen(m) {
  const lang = LANGS[m.lang];
  const d = dirOf(m.name);
  fs.writeFileSync(path.join(d, 'gin.txt'), `${m.n} ${m.seed}\n`);
  const res = await runWithRunner(
    { cpuMs: 10000, wallMs: 30000, asKb: 0, fsizeKb: 65536, stdin: path.join(d, 'gin.txt'), stdout: path.join(d, 'gout.txt'), stderr: path.join(d, 'gerr.txt') },
    lang.run(d, {})
  );
  const out = readCapped(path.join(d, 'gout.txt'), (m.capKb || 1024) * 1024);
  const err = readCapped(path.join(d, 'gerr.txt'), 1024);
  return { ...res, stdout: out.text, truncated: out.truncated, stderr: err.text };
}

// Generate an input of size n with the generator and time a program on it, all inside the container.
async function cmdScale(m) {
  const glang = LANGS[m.genLang];
  const slang = LANGS[m.lang];
  const g = dirOf(m.gen);
  const s = dirOf(m.name);
  fs.writeFileSync(path.join(g, 'gin.txt'), `${m.n} ${m.seed}\n`);
  const inputFile = path.join(s, 'scale-in.txt');
  const gres = await runWithRunner(
    { cpuMs: 20000, wallMs: 60000, asKb: 0, fsizeKb: 100000, stdin: path.join(g, 'gin.txt'), stdout: inputFile, stderr: path.join(g, 'gerr.txt') },
    glang.run(g, {})
  );
  if (gres.exit !== 0 || gres.signal) return { genFailed: true, gen: gres, stderr: readCapped(path.join(g, 'gerr.txt'), 1024).text };
  const sres = await runWithRunner(
    { cpuMs: m.cpuMs, wallMs: m.wallMs, asKb: m.asKb, fsizeKb: 16384, stdin: inputFile, stdout: path.join(s, 'scale-out.txt'), stderr: path.join(s, 'scale-err.txt') },
    slang.run(s, { heapMb: m.heapMb })
  );
  let inputBytes = 0;
  try {
    inputBytes = fs.statSync(inputFile).size;
  } catch {}
  return { gen: gres, sub: sres, inputBytes };
}

async function cmdCanary(m) {
  const runs = [];
  const empty = path.join(WORK, 'empty.txt');
  fs.writeFileSync(empty, '');
  for (let i = 0; i < (m.runs || 3); i++) {
    const r = await runWithRunner(
      { cpuMs: 10000, wallMs: 30000, asKb: 0, fsizeKb: 1024, stdin: empty, stdout: path.join(WORK, 'canary-out.txt'), stderr: path.join(WORK, 'canary-err.txt') },
      [CANARY]
    );
    runs.push(r.cpu_ms);
  }
  return { runs };
}

const handlers = {
  ping: async () => ({ pong: true }),
  compile: cmdCompile,
  run: cmdRun,
  gen: cmdGen,
  scale: cmdScale,
  canary: cmdCanary,
  cleanup: async (m) => {
    fs.rmSync(dirOf(m.name), { recursive: true, force: true });
    return { ok: true };
  },
};

fs.mkdirSync(WORK, { recursive: true });
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let chain = Promise.resolve();
rl.on('line', (line) => {
  if (!line.trim()) return;
  // Requests are handled strictly one at a time, in order.
  chain = chain.then(async () => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    let reply;
    try {
      const h = handlers[msg.cmd];
      reply = h ? await h(msg) : { error: `unknown command ${msg.cmd}` };
    } catch (e) {
      reply = { error: String((e && e.message) || e) };
    }
    process.stdout.write(JSON.stringify({ id: msg.id, ...reply }) + '\n');
  });
});
rl.on('close', () => process.exit(0));
