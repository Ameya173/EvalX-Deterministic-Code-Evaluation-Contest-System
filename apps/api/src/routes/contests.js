import { Router } from 'express';
import { z } from 'zod';
import { Contest, Participant, Problem, Submission, computeScoreboard } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { authOptional, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const oid = /^[a-f0-9]{24}$/;

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(5000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  freezeAt: z.coerce.date().optional(),
  problems: z.array(z.object({ slug: z.string(), label: z.string().min(1).max(3) })).min(1).max(26),
});

const phase = (c, now = new Date()) => (now < c.startsAt ? 'upcoming' : now <= c.endsAt ? 'running' : 'ended');

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const contests = await Contest.find().sort({ startsAt: -1 }).limit(50).lean();
    res.json({
      contests: contests.map((c) => ({ id: String(c._id), title: c.title, startsAt: c.startsAt, endsAt: c.endsAt, phase: phase(c), problems: c.problems.length })),
    });
  })
);

router.post(
  '/',
  requireRole('setter', 'admin'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    if (body.endsAt <= body.startsAt) throw new HttpError(400, 'The contest must end after it starts');
    if (body.freezeAt && (body.freezeAt < body.startsAt || body.freezeAt > body.endsAt)) throw new HttpError(400, 'Freeze time must be inside the contest');
    const problems = [];
    for (const { slug, label } of body.problems) {
      const p = await Problem.findOne({ slug }).lean();
      if (!p) throw new HttpError(400, `Unknown problem: ${slug}`);
      if (req.user.role !== 'admin' && String(p.authorId) !== req.user.id && p.visibility !== 'public') throw new HttpError(403, `You cannot use ${slug}`);
      problems.push({ problemId: p._id, label: label.toUpperCase() });
    }
    const c = await Contest.create({ ...body, problems, createdBy: req.user.id });
    res.status(201).json({ id: String(c._id) });
  })
);

router.get(
  '/:id',
  authOptional,
  asyncHandler(async (req, res) => {
    if (!oid.test(req.params.id)) throw new HttpError(404, 'Contest not found');
    const c = await Contest.findById(req.params.id).lean();
    if (!c) throw new HttpError(404, 'Contest not found');
    const now = new Date();
    const joined = req.user ? !!(await Participant.exists({ contestId: c._id, userId: req.user.id })) : false;
    const visible = now >= c.startsAt || req.user?.role === 'admin';
    let problems = [];
    if (visible) {
      const docs = await Problem.find({ _id: { $in: c.problems.map((p) => p.problemId) } }).select('slug title').lean();
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      problems = c.problems.map((p) => ({ label: p.label, slug: byId.get(String(p.problemId))?.slug, title: byId.get(String(p.problemId))?.title }));
    }
    res.json({
      contest: { id: String(c._id), title: c.title, description: c.description, startsAt: c.startsAt, endsAt: c.endsAt, freezeAt: c.freezeAt, phase: phase(c, now), serverTime: now, joined, problems },
    });
  })
);

router.post(
  '/:id/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!oid.test(req.params.id)) throw new HttpError(404, 'Contest not found');
    const c = await Contest.findById(req.params.id).lean();
    if (!c) throw new HttpError(404, 'Contest not found');
    if (new Date() > c.endsAt) throw new HttpError(400, 'The contest has ended');
    await Participant.updateOne({ contestId: c._id, userId: req.user.id }, { $setOnInsert: { contestId: c._id, userId: req.user.id } }, { upsert: true });
    res.json({ joined: true });
  })
);

const cache = new Map(); // contestId + mode -> { at, data }

router.get(
  '/:id/scoreboard',
  authOptional,
  asyncHandler(async (req, res) => {
    if (!oid.test(req.params.id)) throw new HttpError(404, 'Contest not found');
    const showFrozen = req.user?.role === 'admin';
    const key = `${req.params.id}:${showFrozen}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 2000) return res.json(hit.data);
    const c = await Contest.findById(req.params.id).lean();
    if (!c) throw new HttpError(404, 'Contest not found');
    const subs = await Submission.find({ contestId: c._id }).select('userId handle problemId verdict status createdAt').lean();
    const board = computeScoreboard(c, subs, { now: new Date(), showFrozen });
    const data = { ...board, freezeAt: c.freezeAt, endsAt: c.endsAt, startsAt: c.startsAt };
    cache.set(key, { at: Date.now(), data });
    res.json(data);
  })
);

export function invalidateScoreboard(contestId) {
  for (const k of cache.keys()) if (k.startsWith(contestId)) cache.delete(k);
}

export default router;
