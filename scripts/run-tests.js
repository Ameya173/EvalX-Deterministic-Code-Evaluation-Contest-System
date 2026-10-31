// Cross-version test runner: finds *.test.js files and runs them with node --test.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const found = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.test.js')) found.push(p);
  }
}
for (const d of ['packages', 'apps', 'sandbox']) {
  try { walk(join(root, d)); } catch { /* folder may not exist */ }
}
if (!found.length) { console.log('No tests found'); process.exit(0); }
const r = spawnSync(process.execPath, ['--test', ...found], { stdio: 'inherit' });
process.exit(r.status ?? 1);
