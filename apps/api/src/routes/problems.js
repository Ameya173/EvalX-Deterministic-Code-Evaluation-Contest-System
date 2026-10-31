import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES, Problem, Report, Submission, TestCase, parseComplexity } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { authOptional, requireAuth, requireRole } from '../middleware/auth.js';
import { canViewProblem, isOwnerOrAdmin } from '../lib/access.js';
import { analysisQueue } from '../queues.js';

const router = Router();
const LANG_KEYS = Object.keys(LANGUAGES);
const MAX_TEST_BYTES = 12 * 1024 * 1024;

const codeSchema = z.object({ lang: z.enum(LANG_KEYS), source: z.string().max(100000) });
const testSchema = z.object({ input: z.string().max(8_000_000), output: z.string().max(8_000_000), isSample: z.boolean().optional() });

const problemFields = {
  title: z.string().min(1).max(120),
  statementMd: z.string().max(50000).default(''),
  timeLimitMs: z.number().int().min(100).max(10000).default(1000),
  memoryKb: z.number().int().min(16384).max(1048576).default(262144),
  checkerType: z.enum(['token', 'exact', 'float']).default('token'),
  checkerEpsilon: z.number().min(0).max(1).default(1e-6),
  visibility: z.enum(['public', 'private', 'contest']).default('public'),
  tags: z.array(z.string().max(30)).max(10).default([]),
  difficulty: z.number().int().min(0).max(4000).optional(),
  declaredComplexity: z.string().max(30).default(''),
  reference: codeSchema.optional(),
  generator: codeSchema.optional(),
  scaling: z.object({ minN: z.number().int().min(2).max(1e7), maxN: z.number().int().min(2).max(1e7) }).optional(),
  tests: z.array(testSchema).max(60).optional(),
};
const createSchema = z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'lowercase letters, digits and dashes'), ...problemFields });
const updateSchema = z.object(problemFields).partial();

function checkTests(tests) {
  const bytes = tests.reduce((a, t) => a + t.input.length + t.output.length, 0);
  if (bytes > MAX_TEST_BYTES) throw new HttpError(413, 'Test data is too large (limit 12 MB in total)');
}
function checkComplexity(value) {
  if (value && !parseComplexity(value)) throw new HttpError(400, 'Declared complexity must be one of: 1, log n, n, n log n, n^2, n^3');
}

async function replaceTests(problemId, tests) {
  await TestCase.deleteMany({ problemId });
  if (tests.length) {
    await TestCase.insertMany(tests.map((t, i) => ({ problemId, ordinal: i + 1, input: t.input, output: t.output, isSample: !!t.isSample, origin: 'manual' })));
  }
}

const listItem = (p, solved) => ({
  slug: p.slug,
  title: p.title,
  difficulty: p.difficulty,
  tags: p.tags,
  category: p.category || (p.tags && p.tags[0]) || 'Arrays',
  companies: p.companies || [],
  sheet: p.sheet || [],
  acceptanceRate: p.acceptanceRate || 65,
  timeLimitMs: p.timeLimitMs,
  visibility: p.visibility,
  solved: solved.has(String(p._id)),
});

router.get(
  '/',
  authOptional,
  asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin' ? {} : { visibility: 'public' };
    const problems = await Problem.find(filter).sort({ difficulty: 1, createdAt: 1 }).lean();
    const solved = new Set();
    if (req.user) {
      const ids = await Submission.distinct('problemId', { userId: req.user.id, verdict: 'AC' });
      ids.forEach((i) => solved.add(String(i)));
    }
    res.json({ problems: problems.map((p) => listItem(p, solved)) });
  })
);

router.get(
  '/mine',
  requireRole('setter', 'admin'),
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { authorId: req.user.id };
    const problems = await Problem.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ problems: problems.map((p) => ({ ...listItem(p, new Set()), strength: p.strength })) });
  })
);

router.get(
  '/:slug',
  authOptional,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug }).lean();
    if (!p || !(await canViewProblem(req.user, p))) throw new HttpError(404, 'Problem not found');
    const samples = await TestCase.find({ problemId: p._id, isSample: true }).sort({ ordinal: 1 }).select('input output').lean();
    const manage = isOwnerOrAdmin(req.user, p);
    res.json({
      problem: {
        slug: p.slug,
        title: p.title,
        statementMd: p.statementMd,
        timeLimitMs: p.timeLimitMs,
        memoryKb: p.memoryKb,
        checkerType: p.checkerType,
        visibility: p.visibility,
        tags: p.tags,
        category: p.category || (p.tags && p.tags[0]) || 'Arrays',
        companies: p.companies || [],
        sheet: p.sheet || [],
        hints: p.hints || [],
        acceptanceRate: p.acceptanceRate || 65,
        difficulty: p.difficulty,
        declaredComplexity: p.declaredComplexity || '',
        canManage: manage,
        samples: samples.map((s) => ({ input: s.input, output: s.output })),
      },
      languages: Object.fromEntries(Object.entries(LANGUAGES).map(([k, v]) => [k, { label: v.label, timeMultiplier: v.timeMultiplier, template: v.template }])),
    });
  })
);

// Full editable view for the author/admin.
router.get(
  '/:slug/manage',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug }).lean();
    if (!p || !isOwnerOrAdmin(req.user, p)) throw new HttpError(404, 'Problem not found');
    const tests = await TestCase.find({ problemId: p._id }).sort({ ordinal: 1 }).lean();
    res.json({
      problem: p,
      tests: tests.map((t) => ({ ordinal: t.ordinal, input: t.input, output: t.output, isSample: t.isSample, origin: t.origin })),
    });
  })
);

router.post(
  '/',
  requireRole('setter', 'admin'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    checkComplexity(body.declaredComplexity);
    const { tests = [], ...fields } = body;
    checkTests(tests);
    if (await Problem.exists({ slug: fields.slug })) throw new HttpError(409, 'A problem with this slug already exists');
    const p = await Problem.create({ ...fields, authorId: req.user.id });
    await replaceTests(p._id, tests);
    res.status(201).json({ slug: p.slug });
  })
);

router.put(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug });
    if (!p || !isOwnerOrAdmin(req.user, p)) throw new HttpError(404, 'Problem not found');
    const body = updateSchema.parse(req.body);
    checkComplexity(body.declaredComplexity);
    const { tests, ...fields } = body;
    if (tests) {
      checkTests(tests);
      await replaceTests(p._id, tests);
      fields.strength = undefined; // the old score no longer describes this suite
    }
    p.set(fields);
    if (tests) p.strength = undefined;
    await p.save();
    res.json({ slug: p.slug });
  })
);

// ---- C3: test-suite strength ------------------------------------------------

router.post(
  '/:slug/strength',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug }).lean();
    if (!p || !isOwnerOrAdmin(req.user, p)) throw new HttpError(404, 'Problem not found');
    if (!p.reference?.source) throw new HttpError(400, 'Add a reference solution first');
    if (!['cpp', 'python'].includes(p.reference.lang)) throw new HttpError(400, 'Strength analysis needs a C++ or Python reference solution');
    if (!p.generator?.source) throw new HttpError(400, 'Add a generator first (reads "n seed", prints one valid input)');
    if (!(await TestCase.exists({ problemId: p._id }))) throw new HttpError(400, 'Add tests first');
    const running = await Report.findOne({ kind: 'strength', problemId: p._id, status: { $in: ['queued', 'running'] } }).lean();
    if (running) return res.status(202).json({ reportId: String(running._id), status: running.status });
    const report = await Report.create({ kind: 'strength', problemId: p._id, status: 'queued' });
    await analysisQueue.add('strength', { problemId: String(p._id), reportId: String(report._id) }, { attempts: 1, removeOnComplete: 100, removeOnFail: 100 });
    res.status(202).json({ reportId: String(report._id), status: 'queued' });
  })
);

router.get(
  '/:slug/strength',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug }).lean();
    if (!p || !isOwnerOrAdmin(req.user, p)) throw new HttpError(404, 'Problem not found');
    const report = await Report.findOne({ kind: 'strength', problemId: p._id }).sort({ createdAt: -1 }).lean();
    res.json({ report: report || null });
  })
);

// Add the distinguishing inputs of selected surviving mutants as new tests.
router.post(
  '/:slug/strength/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Problem.findOne({ slug: req.params.slug }).lean();
    if (!p || !isOwnerOrAdmin(req.user, p)) throw new HttpError(404, 'Problem not found');
    const { mutantIds } = z.object({ mutantIds: z.array(z.string()).min(1).max(40) }).parse(req.body);
    const report = await Report.findOne({ kind: 'strength', problemId: p._id, status: 'done' }).sort({ createdAt: -1 });
    if (!report) throw new HttpError(400, 'Run the strength analysis first');
    const wanted = new Set(mutantIds);
    const picked = (report.data.mutants || []).filter((m) => wanted.has(m.id) && m.status === 'survived' && m.distinguishingInput);
    if (!picked.length) throw new HttpError(400, 'None of the selected mutants has a proposed test');
    const seen = new Set();
    let ordinal = (await TestCase.findOne({ problemId: p._id }).sort({ ordinal: -1 }).select('ordinal').lean())?.ordinal || 0;
    let added = 0;
    for (const m of picked) {
      if (seen.has(m.distinguishingInput)) continue;
      seen.add(m.distinguishingInput);
      await TestCase.create({ problemId: p._id, ordinal: ++ordinal, input: m.distinguishingInput, output: m.expected, isSample: false, origin: 'hardened' });
      added++;
    }
    report.data = { ...report.data, mutants: report.data.mutants.map((m) => (wanted.has(m.id) && m.status === 'survived' ? { ...m, status: 'hardened' } : m)) };
    report.markModified('data');
    await report.save();
    res.json({ added });
  })
);

export default router;
