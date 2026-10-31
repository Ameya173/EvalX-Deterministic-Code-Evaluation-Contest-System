import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Contest, LANGUAGES, Participant, Problem, Report, Submission } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { canViewProblem } from '../lib/access.js';
import { enqueueJudge } from '../queues.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions, wait a minute' },
});

const submitSchema = z.object({
  problemSlug: z.string().min(1).max(60),
  language: z.enum(Object.keys(LANGUAGES)),
  source: z.string().min(1).max(65536),
  contestId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
});

const runSchema = z.object({
  problemSlug: z.string().min(1).max(60),
  language: z.enum(Object.keys(LANGUAGES)),
  source: z.string().min(1).max(65536),
  input: z.string().max(65536).optional(),
  expectedOutput: z.string().max(65536).optional(),
});

const summary = (s) => ({
  id: String(s._id),
  handle: s.handle,
  problemSlug: s.problemSlug,
  language: s.language,
  status: s.status,
  verdict: s.verdict,
  failedTest: s.failedTest,
  maxTimeMs: s.maxTimeMs,
  maxMemKb: s.maxMemKb,
  borderline: s.borderline,
  minConfidence: s.minConfidence,
  analysisStatus: s.analysisStatus,
  contestId: s.contestId ? String(s.contestId) : null,
  isRun: !!s.isRun,
  createdAt: s.createdAt,
});

router.post(
  '/run',
  requireAuth,
  submitLimiter,
  asyncHandler(async (req, res) => {
    const body = runSchema.parse(req.body);
    const problem = await Problem.findOne({ slug: body.problemSlug }).lean();
    if (!problem || !(await canViewProblem(req.user, problem))) throw new HttpError(404, 'Problem not found');

    const sub = await Submission.create({
      userId: req.user.id,
      handle: req.user.handle,
      problemId: problem._id,
      problemSlug: problem.slug,
      language: body.language,
      source: body.source,
      isRun: true,
      customInput: body.input ?? '',
      expectedOutput: body.expectedOutput ?? '',
      status: 'queued',
    });
    await enqueueJudge(sub._id, { priority: 2 });
    res.status(201).json({ submission: summary(sub) });
  })
);

router.post(
  '/',
  requireAuth,
  submitLimiter,
  asyncHandler(async (req, res) => {
    const body = submitSchema.parse(req.body);
    const problem = await Problem.findOne({ slug: body.problemSlug }).lean();
    if (!problem || !(await canViewProblem(req.user, problem))) throw new HttpError(404, 'Problem not found');

    let contestId;
    if (body.contestId) {
      const contest = await Contest.findById(body.contestId).lean();
      if (!contest) throw new HttpError(404, 'Contest not found');
      const now = new Date();
      if (now < contest.startsAt || now > contest.endsAt) throw new HttpError(400, 'The contest is not running');
      if (!contest.problems.some((p) => String(p.problemId) === String(problem._id))) throw new HttpError(400, 'This problem is not part of the contest');
      await Participant.updateOne({ contestId: contest._id, userId: req.user.id }, { $setOnInsert: { contestId: contest._id, userId: req.user.id } }, { upsert: true });
      contestId = contest._id;
    }

    const sub = await Submission.create({
      userId: req.user.id,
      handle: req.user.handle,
      problemId: problem._id,
      problemSlug: problem.slug,
      contestId,
      language: body.language,
      source: body.source,
      status: 'queued',
    });
    await enqueueJudge(sub._id, { priority: contestId ? 1 : 5 });
    res.status(201).json({ submission: summary(sub) });
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const filter = { userId: req.user.id, isRun: { $ne: true } };
    if (req.query.problem) filter.problemSlug = String(req.query.problem);
    if (req.query.contest) filter.contestId = String(req.query.contest);
    const subs = await Submission.find(filter).sort({ createdAt: -1 }).limit(100).select('-source -tests -compileLog').lean();
    res.json({ submissions: subs.map(summary) });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Submission not found');
    const s = await Submission.findById(req.params.id).lean();
    if (!s || (String(s.userId) !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'Submission not found');
    res.json({
      submission: {
        ...summary(s),
        source: s.source,
        compileLog: s.compileLog,
        tests: s.tests,
        testsTotal: s.testsTotal,
        speedFactor: s.speedFactor,
        policy: s.policy,
        isRun: !!s.isRun,
        customInput: s.customInput,
        expectedOutput: s.expectedOutput,
        runOutput: s.runOutput,
      },
    });
  })
);

// C2: complexity-explained TLE analysis
router.get(
  '/:id/analysis',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Submission not found');
    const s = await Submission.findById(req.params.id).select('userId analysisStatus').lean();
    if (!s || (String(s.userId) !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'Submission not found');
    const report = await Report.findOne({ kind: 'complexity', submissionId: s._id }).sort({ createdAt: -1 }).lean();
    res.json({ status: s.analysisStatus, progress: report?.progress ?? 0, error: report?.error, report: report?.status === 'done' ? report.data : null });
  })
);

export default router;
