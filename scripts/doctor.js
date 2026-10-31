// Checks that everything the project needs is in place. Usage: npm run doctor
import 'dotenv/config';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ok = (m) => console.log(`  [ok]   ${m}`);
const bad = (m, hint) => { console.log(`  [FAIL] ${m}${hint ? `\n         -> ${hint}` : ''}`); failed++; };
let failed = 0;

const major = Number(process.versions.node.split('.')[0]);
console.log('JudgeBox environment check\n');
major >= 20 ? ok(`Node.js ${process.versions.node}`) : bad(`Node.js ${process.versions.node} is too old`, 'Install Node.js 20 or newer from nodejs.org');

const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (docker.status === 0) ok(`Docker engine ${docker.stdout.trim()} is running`);
else bad('Docker is not reachable', 'Start Docker Desktop (WSL2 backend) and wait until it says "Engine running"');

const image = process.env.SANDBOX_IMAGE || 'judgebox-sandbox';
const img = spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf8', shell: process.platform === 'win32' });
img.status === 0 ? ok(`Sandbox image "${image}" exists`) : bad(`Sandbox image "${image}" not found`, 'Run: npm run sandbox:build   (first build takes a few minutes)');

existsSync('.env') ? ok('.env file present') : bad('.env missing', 'Run: npm run setup');

const check = (name, url, port) =>
  new Promise((resolve) => {
    let host = '127.0.0.1';
    try { const u = new URL(url); host = u.hostname; port = Number(u.port) || port; } catch {}
    const s = net.connect({ host, port, timeout: 2000 });
    s.on('connect', () => { ok(`${name} reachable at ${host}:${port}`); s.destroy(); resolve(); });
    const fail = () => { bad(`${name} not reachable at ${host}:${port}`, 'Run: npm run dev:deps'); s.destroy(); resolve(); };
    s.on('error', fail);
    s.on('timeout', fail);
  });
await check('MongoDB', process.env.MONGO_URL || 'mongodb://127.0.0.1:27017', 27017);
await check('Redis', process.env.REDIS_URL || 'redis://127.0.0.1:6379', 6379);

console.log(failed ? `\n${failed} problem(s) found. Fix them and run "npm run doctor" again.` : '\nAll good. Start the app with: npm run dev');
process.exit(failed ? 1 : 0);
