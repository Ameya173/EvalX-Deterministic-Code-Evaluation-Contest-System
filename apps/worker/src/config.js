import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });

const int = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

export const config = {
  mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/judgebox',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  sandboxImage: process.env.SANDBOX_IMAGE || 'judgebox-sandbox',
  concurrency: int(process.env.WORKER_CONCURRENCY, 2),
  policy: ['adaptive', 'single', 'fixed3'].includes(process.env.TIMING_POLICY) ? process.env.TIMING_POLICY : 'adaptive',
  maxMutants: int(process.env.STRENGTH_MAX_MUTANTS, 30),
  stressInputs: int(process.env.STRENGTH_STRESS_INPUTS, 40),
  workerId: `${os.hostname()}-${process.pid}`,
};
