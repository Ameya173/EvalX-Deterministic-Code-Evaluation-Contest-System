import { Problem, Report, Submission, TestCase, compareOutput, publishEvent } from '@judgebox/shared';
import { judgeCore, containerMemoryMb, limitsFor, calibrate, makeRunner } from './judgeCore.js';
import { DockerSandbox } from '../sandbox.js';
import { config } from '../config.js';

/** Load a submission, judge it in a fresh sandbox container and store the result. */
export async function runJudgeJob({ submissionId }, ctx, { isLastAttempt }) {
  const sub = await Submission.findById(submissionId);
  if (!sub) return;
  const problem = await Problem.findById(sub.problemId).lean();
  const emit = (extra) =>
    publishEvent(ctx.redis, { type: 'submission', userId: String(sub.userId), submissionId: String(sub._id), ...extra }).catch(() => {});

  if (!problem) {
    await Submission.updateOne({ _id: sub._id }, { status: 'done', verdict: 'SE', compileLog: 'Problem not found.', judgedAt: new Date() });
    await emit({ status: 'done', verdict: 'SE' });
    return;
  }

  // Handle interactive "Run Code" execution (custom test run without submitting to contest/leaderboard)
  if (sub.isRun) {
    await Submission.updateOne({ _id: sub._id }, { status: 'judging', workerId: ctx.workerId });
    await emit({ status: 'judging' });

    let sandbox;
    try {
      sandbox = await DockerSandbox.create({ image: config.sandboxImage, memoryMb: containerMemoryMb(problem) });
      const limits = limitsFor(problem, sub.language);
      const comp = await sandbox.request({ cmd: 'compile', name: 'sub', lang: sub.language, source: sub.source }, 120000);
      if (!comp.ok) {
        await Submission.updateOne(
          { _id: sub._id },
          { status: 'done', verdict: 'CE', compileLog: comp.log || '', judgedAt: new Date() }
        );
        await emit({ status: 'done', verdict: 'CE' });
        return;
      }

      const { speedFactor } = await calibrate(sandbox, ctx.calib);
      const runner = makeRunner(sandbox, { language: sub.language, limits });
      const res = await runner(sub.customInput || '');
      const normMs = Math.round(res.cpuMs * speedFactor * 10) / 10;
      let verdict = 'AC';
      if (res.wallKilled || res.signal === 24) verdict = 'TLE';
      else if (res.outTruncated) verdict = 'OLE';
      else if (res.signal || res.exit !== 0) verdict = res.memKb > limits.memKb * 0.9 ? 'MLE' : 'RE';
      else if (sub.expectedOutput && sub.expectedOutput.trim()) {
        const ok = compareOutput(res.stdout, sub.expectedOutput, { type: problem.checkerType, epsilon: problem.checkerEpsilon });
        if (!ok) verdict = 'WA';
      }

      await Submission.updateOne(
        { _id: sub._id },
        {
          status: 'done',
          verdict,
          speedFactor,
          maxTimeMs: normMs,
          maxMemKb: res.memKb,
          compileLog: '',
          runOutput: {
            stdout: res.stdout || '',
            stderr: res.stderr || '',
            timeMs: normMs,
            memKb: res.memKb,
            exitCode: res.exit,
          },
          judgedAt: new Date(),
        }
      );
      await emit({ status: 'done', verdict });
    } catch (err) {
      console.error(`[judge] run submission ${submissionId} failed:`, err.message);
      await Submission.updateOne(
        { _id: sub._id },
        { status: 'done', verdict: 'SE', compileLog: `System error: ${err.message}`, judgedAt: new Date() }
      );
      await emit({ status: 'done', verdict: 'SE' });
    } finally {
      if (sandbox) await sandbox.destroy();
    }
    return;
  }

  const tests = await TestCase.find({ problemId: sub.problemId }).sort({ ordinal: 1 }).lean();
  if (!tests.length) {
    await Submission.updateOne({ _id: sub._id }, { status: 'done', verdict: 'SE', compileLog: 'Problem has no tests.', judgedAt: new Date() });
    await emit({ status: 'done', verdict: 'SE' });
    return;
  }

  await Submission.updateOne({ _id: sub._id }, { status: 'judging', workerId: ctx.workerId, verdict: null, tests: [], testsTotal: tests.length, policy: config.policy });
  await emit({ status: 'judging', progress: 0, total: tests.length });

  let sandbox;
  try {
    sandbox = await DockerSandbox.create({ image: config.sandboxImage, memoryMb: containerMemoryMb(problem) });
    const result = await judgeCore({
      submission: sub,
      problem,
      tests,
      sandbox,
      calib: ctx.calib,
      policy: config.policy,
      onProgress: (done, total) => emit({ status: 'judging', progress: done, total }),
    });
    ctx.lastSpeedFactor = result.speedFactor;

    const wantAnalysis = result.verdict === 'TLE' && problem.generator?.source && problem.declaredComplexity;
    await Submission.updateOne(
      { _id: sub._id },
      {
        status: 'done',
        verdict: result.verdict,
        failedTest: result.failedTest,
        tests: result.tests,
        compileLog: result.compileLog,
        maxTimeMs: result.maxTimeMs,
        maxMemKb: result.maxMemKb,
        speedFactor: result.speedFactor,
        borderline: result.borderline,
        minConfidence: result.minConfidence,
        analysisStatus: wantAnalysis ? 'queued' : 'none',
        judgedAt: new Date(),
      }
    );
    if (wantAnalysis) {
      const report = await Report.create({ kind: 'complexity', submissionId: sub._id, problemId: problem._id, status: 'queued' });
      await ctx.analysisQueue.add('complexity', { submissionId: String(sub._id), reportId: String(report._id) }, { attempts: 1, removeOnComplete: 200, removeOnFail: 200 });
    }
    await emit({ status: 'done', verdict: result.verdict, analysisStatus: wantAnalysis ? 'queued' : 'none' });
    if (sub.contestId) await publishEvent(ctx.redis, { type: 'scoreboard', contestId: String(sub.contestId) }).catch(() => {});
  } catch (err) {
    console.error(`[judge] submission ${submissionId} failed:`, err.message);
    if (isLastAttempt) {
      await Submission.updateOne({ _id: sub._id }, { status: 'done', verdict: 'SE', compileLog: `System error: ${err.message}`, judgedAt: new Date() });
      await emit({ status: 'done', verdict: 'SE' });
      if (sub.contestId) await publishEvent(ctx.redis, { type: 'scoreboard', contestId: String(sub.contestId) }).catch(() => {});
      return;
    }
    throw err; // BullMQ retries with backoff; the result write is keyed by submission id, so a retry never double-counts
  } finally {
    if (sandbox) await sandbox.destroy();
  }
}
