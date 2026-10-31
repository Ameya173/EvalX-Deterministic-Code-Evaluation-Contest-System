import Docker from 'dockerode';
import readline from 'node:readline';
import { PassThrough } from 'node:stream';

// dockerode picks the right endpoint by itself:
//   Windows -> //./pipe/docker_engine (Docker Desktop)    Linux/macOS -> /var/run/docker.sock
// (or whatever DOCKER_HOST says).
export const docker = new Docker();

export async function ensureSandboxImage(image) {
  try {
    await docker.getImage(image).inspect();
  } catch {
    throw new Error(`Sandbox image "${image}" not found. Build it once with: npm run sandbox:build`);
  }
}

/** Remove sandbox containers left behind by a crashed worker. */
export async function removeStaleSandboxes() {
  const list = await docker.listContainers({ all: true, filters: { label: ['judgebox=sandbox'] } });
  await Promise.all(list.map((c) => docker.getContainer(c.Id).remove({ force: true }).catch(() => {})));
  return list.length;
}

/**
 * One hardened container per submission.
 *  - no network, read-only root filesystem, tmpfs working directory
 *  - all Linux capabilities dropped, no-new-privileges, non-root user
 *  - CPU, memory (swap off) and process-count limits
 * The in-container agent (sandbox/agent.cjs) speaks line-delimited JSON on stdin/stdout.
 */
export class DockerSandbox {
  static async create({ image, memoryMb = 1024, pids = 512, cpus = 1 }) {
    const container = await docker.createContainer({
      Image: image,
      Tty: false,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      NetworkDisabled: true,
      User: '65534:65534',
      Env: ['HOME=/tmp'],
      Labels: { judgebox: 'sandbox' },
      HostConfig: {
        NetworkMode: 'none',
        ReadonlyRootfs: true,
        Memory: memoryMb * 1024 * 1024,
        MemorySwap: memoryMb * 1024 * 1024,
        NanoCpus: Math.round(cpus * 1e9),
        PidsLimit: pids,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Ulimits: [
          { Name: 'nofile', Soft: 512, Hard: 512 },
          { Name: 'core', Soft: 0, Hard: 0 },
        ],
        Tmpfs: {
          '/work': 'rw,exec,nosuid,size=256m,mode=1777',
          '/tmp': 'rw,exec,nosuid,size=128m,mode=1777',
        },
      },
    });

    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true, hijack: true });
    const out = new PassThrough();
    const err = new PassThrough();
    docker.modem.demuxStream(stream, out, err);
    await container.start();

    const sb = new DockerSandbox(container, stream, out, err);
    try {
      await sb.request({ cmd: 'ping' }, 30000);
    } catch (e) {
      await sb.destroy();
      throw new Error(`Sandbox did not start: ${e.message}. Stderr: ${sb.stderrTail}`);
    }
    return sb;
  }

  constructor(container, stream, out, err) {
    this.container = container;
    this.stream = stream;
    this.seq = 0;
    this.pending = new Map();
    this.stderrTail = '';
    this.dead = false;
    err.on('data', (d) => {
      this.stderrTail = (this.stderrTail + d.toString()).slice(-2000);
    });
    readline.createInterface({ input: out }).on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        p.resolve(msg);
      }
    });
    const onEnd = () => this.#fail(new Error('Sandbox container stopped unexpectedly (out of memory or killed)'));
    stream.on('end', onEnd);
    stream.on('close', onEnd);
    stream.on('error', (e) => this.#fail(e));
  }

  #fail(error) {
    this.dead = true;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }

  request(cmd, timeoutMs = 60000) {
    if (this.dead) return Promise.reject(new Error('Sandbox is not running'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Sandbox request "${cmd.cmd}" timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.stream.write(JSON.stringify({ id, ...cmd }) + '\n');
    });
  }

  async destroy() {
    this.dead = true;
    try {
      this.stream.destroy();
    } catch {}
    await this.container.remove({ force: true }).catch(() => {});
  }
}
