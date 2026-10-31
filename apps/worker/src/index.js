import { Queue, Worker } from 'bullmq';
import { Calibration, QUEUES, connectMongo, createRedis } from '@judgebox/shared';
import { config } from './config.js';
import { ensureSandboxImage, removeStaleSandboxes } from './sandbox.js';
import { runJudgeJob } from './judge/judgeSubmission.js';
import { runComplexityJob, runStrengthJob } from './analysis/runAnalysis.js';

async function main() {
  console.log(`[worker] ${config.workerId} starting (policy=${config.policy}, concurrency=${config.concurrency})`);
  await connectMongo(config.mongoUrl);
  await ensureSandboxImage(config.sandboxImage);
  const removed = await removeStaleSandboxes();
  if (removed) console.log(`[worker] removed ${removed} stale sandbox container(s)`);

  const connection = createRedis(config.redisUrl);
  const publisher = createRedis(config.redisUrl);
  const analysisQueue = new Queue(QUEUES.analysis, { connection: createRedis(config.redisUrl) });

  const ctx = {
    workerId: config.workerId,
    redis: publisher,
    analysisQueue,
    calib: { history: [] }, // rolling canary history for C1 (per worker process)
    lastSpeedFactor: 1,
    active: 0,
  };

  const attempts = 3;
  const judgeWorker = new Worker(
    QUEUES.judge,
    async (job) => {
      ctx.active++;
      try {
        await runJudgeJob(job.data, ctx, { isLastAttempt: job.attemptsMade + 1 >= (job.opts.attempts || attempts) });
      } finally {
        ctx.active--;
      }
    },
    { connection, concurrency: config.concurrency }
  );
  const analysisWorker = new Worker(
    QUEUES.analysis,
    async (job) => {
      if (job.name === 'complexity') return runComplexityJob(job.data, ctx);
      if (job.name === 'strength') return runStrengthJob(job.data, ctx);
    },
    { connection: createRedis(config.redisUrl), concurrency: 1 }
  );
  for (const w of [judgeWorker, analysisWorker]) {
    w.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed: ${err.message}`));
    w.on('error', (err) => console.error('[worker] error:', err.message));
  }

  // Heartbeat so the admin page can show live workers and their current speed factor.
  const beat = async () => {
    const info = { id: ctx.workerId, concurrency: config.concurrency, active: ctx.active, speedFactor: ctx.lastSpeedFactor, policy: config.policy, lastSeen: Date.now() };
    await publisher.set(`jb:worker:${ctx.workerId}`, JSON.stringify(info), 'EX', 20).catch(() => {});
    if (ctx.calib.history.length) {
      const last = ctx.calib.history[ctx.calib.history.length - 1];
      if (ctx.lastCalibLogged !== last) {
        ctx.lastCalibLogged = last;
        await Calibration.create({ workerId: ctx.workerId, canaryMs: last, speedFactor: ctx.lastSpeedFactor }).catch(() => {});
      }
    }
  };
  await beat();
  const timer = setInterval(beat, 5000);

  const shutdown = async (sig) => {
    console.log(`[worker] ${sig} received, finishing current jobs...`);
    clearInterval(timer);
    await Promise.all([judgeWorker.close(), analysisWorker.close()]);
    await publisher.del(`jb:worker:${ctx.workerId}`).catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  console.log('[worker] ready, waiting for jobs');
}

main().catch((err) => {
  console.error('[worker] fatal:', err.message);
  process.exit(1);
});
