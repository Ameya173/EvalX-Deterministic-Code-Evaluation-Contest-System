import { Queue } from 'bullmq';
import { QUEUES, createRedis } from '@judgebox/shared';
import { config } from './config.js';

export const judgeQueue = new Queue(QUEUES.judge, { connection: createRedis(config.redisUrl) });
export const analysisQueue = new Queue(QUEUES.analysis, { connection: createRedis(config.redisUrl) });

export async function enqueueJudge(submissionId, { priority = 5 } = {}) {
  await judgeQueue.add(
    'judge',
    { submissionId: String(submissionId) },
    {
      jobId: `${submissionId}-${Date.now()}`, // BullMQ custom ids may not contain ":"
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    }
  );
}
