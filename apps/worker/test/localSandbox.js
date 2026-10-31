// TEST HELPER ONLY. Runs the sandbox agent directly on a Linux host without Docker so the
// judging pipeline can be tested in CI. It provides NO isolation and is never used by the worker.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const sandboxDir = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox');
const have = (c) => spawnSync(c, ['--version']).status === 0;
export const canRunLocally = process.platform === 'linux' && have('gcc') && have('g++') && have('python3');

export async function createLocalSandbox() {
  const work = mkdtempSync(join(tmpdir(), 'jb-local-'));
  const runner = join(work, 'runner');
  const canary = join(work, 'canary');
  spawnSync('gcc', ['-O2', '-o', runner, join(sandboxDir, 'runner.c')]);
  spawnSync('gcc', ['-O1', '-o', canary, join(sandboxDir, 'canary.c')]);
  const proc = spawn('node', [join(sandboxDir, 'agent.cjs')], { env: { ...process.env, WORK_DIR: join(work, 'w'), RUNNER: runner, CANARY: canary } });
  const pending = new Map();
  let seq = 0;
  readline.createInterface({ input: proc.stdout }).on('line', (l) => {
    const m = JSON.parse(l);
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  return {
    request: (cmd) => new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      proc.stdin.write(JSON.stringify({ id, ...cmd }) + '\n');
    }),
    destroy: async () => {
      proc.kill();
      rmSync(work, { recursive: true, force: true });
    },
  };
}
