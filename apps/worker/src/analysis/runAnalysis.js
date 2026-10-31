import { Problem, Report, Submission, TestCase, publishEvent } from '@judgebox/shared';
import { containerMemoryMb } from '../judge/judgeCore.js';
import { DockerSandbox } from '../sandbox.js';
import { complexityCore } from './complexityCore.js';
import { strengthCore } from './strengthCore.js';
import { config } from '../config.js';

/** C2: explain a TLE submission. */
export async function runComplexityJob({ submissionId, reportId }, ctx) {
  const report = await Report.findById(reportId);
  const sub = await Submission.findById(submissionId);
  if (!report || !sub) return;
  const problem = await Problem.findById(sub.problemId).lean();
  const emit = (extra) => publishEvent(ctx.redis, { type: 'analysis', userId: String(sub.userId), submissionId: String(sub._id), ...extra }).catch(() => {});

  await Report.updateOne({ _id: report._id }, { status: 'running', progress: 0 });
  await Submission.updateOne({ _id: sub._id }, { analysisStatus: 'running' });
  await emit({ analysisStatus: 'running' });

  let sandbox;
  try {
    sandbox = await DockerSandbox.create({ image: config.sandboxImage, memoryMb: Math.max(containerMemoryMb(problem), 1536) });
    const data = await complexityCore({
      submission: sub,
      problem,
      sandbox,
      calib: ctx.calib,
      onProgress: (done, total) => Report.updateOne({ _id: report._id }, { progress: done / total }),
    });
    await Report.updateOne({ _id: report._id }, { status: 'done', progress: 1, data });
    await Submission.updateOne({ _id: sub._id }, { analysisStatus: 'done' });
    await emit({ analysisStatus: 'done' });
  } catch (err) {
    console.error('[analysis] complexity failed:', err.message);
    await Report.updateOne({ _id: report._id }, { status: 'failed', error: err.message });
    await Submission.updateOne({ _id: sub._id }, { analysisStatus: 'failed' });
    await emit({ analysisStatus: 'failed' });
  } finally {
    if (sandbox) await sandbox.destroy();
  }
}

/** C3: mutation-test the problem's suite. */
export async function runStrengthJob({ problemId, reportId }, ctx) {
  const report = await Report.findById(reportId);
  const problem = await Problem.findById(problemId).lean();
  if (!report || !problem) return;
  await Report.updateOne({ _id: report._id }, { status: 'running', progress: 0 });
  let sandbox;
  try {
    const tests = await TestCase.find({ problemId }).sort({ ordinal: 1 }).lean();
    sandbox = await DockerSandbox.create({ image: config.sandboxImage, memoryMb: Math.max(containerMemoryMb(problem), 1024) });
    const data = await strengthCore({
      problem,
      tests,
      sandbox,
      maxMutants: config.maxMutants,
      stressCount: config.stressInputs,
      onProgress: (done, total) => Report.updateOne({ _id: report._id }, { progress: done / total }),
    });
    await Report.updateOne({ _id: report._id }, { status: 'done', progress: 1, data });
    await Problem.updateOne(
      { _id: problemId },
      { strength: { score: data.score, mutantsTotal: data.mutantsTotal, nonEquivalent: data.nonEquivalent, killed: data.killed, computedAt: new Date() } }
    );
  } catch (err) {
    console.error('[analysis] strength failed:', err.message);
    await Report.updateOne({ _id: report._id }, { status: 'failed', error: err.message });
  } finally {
    if (sandbox) await sandbox.destroy();
  }
}
