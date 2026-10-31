import { Router } from 'express';
import { z } from 'zod';
import { Calibration, Contest, Participant, Problem, ROLES, Submission, User, createRedis } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { analysisQueue, enqueueJudge, judgeQueue } from '../queues.js';
import { config } from '../config.js';

const router = Router();
const redis = createRedis(config.redisUrl);

router.use(requireRole('admin'));

const CONTEST_TEMPLATES = [
  {
    id: 'starter-sprint',
    title: 'CodeSprint #1: DSA Foundations',
    description: 'Perfect beginner-to-intermediate contest testing arrays, strings, basic math, and two-pointer techniques.',
    problemSlugs: ['two-sum', 'valid-parentheses', 'best-time-to-buy-and-sell-stock', 'longest-substring-without-repeating-characters'],
    tags: ['Warm-Up', 'Arrays', 'Strings'],
    durationMinutes: 90,
  },
  {
    id: 'sliding-window-hash',
    title: 'SDE Challenge: Sliding Window & HashMaps',
    description: 'Master sliding window, frequency counting, and hashmap optimizations for high-frequency interview patterns.',
    problemSlugs: ['subarray-sum-equals-k', 'group-anagrams', 'container-with-most-water', 'trapping-rain-water'],
    tags: ['Sliding Window', 'Two Pointers'],
    durationMinutes: 90,
  },
  {
    id: 'dp-showdown',
    title: 'Dynamic Programming Grand Prix',
    description: 'From 1D state transitions to 2D knapsack and longest common subsequence optimization.',
    problemSlugs: ['climbing-stairs', 'coin-change', 'longest-increasing-subsequence', 'edit-distance'],
    tags: ['DP', 'Optimization'],
    durationMinutes: 120,
  },
  {
    id: 'trees-graphs',
    title: 'Graph & Tree Algorithms Cup',
    description: 'Breadth-first search, depth-first search, topological sort, and lowest common ancestors.',
    problemSlugs: ['invert-binary-tree', 'lowest-common-ancestor-of-a-binary-tree', 'course-schedule', 'clone-graph'],
    tags: ['Trees', 'Graphs', 'BFS/DFS'],
    durationMinutes: 120,
  },
  {
    id: 'faang-mock',
    title: 'FAANG Final Round Mock Arena',
    description: 'Full simulation of Google/Meta/Amazon technical screen with 4 escalating difficulty algorithmic problems.',
    problemSlugs: ['merge-intervals', 'kth-largest-element-in-an-array', 'word-ladder', 'median-of-two-sorted-arrays'],
    tags: ['FAANG', 'Interview Simulation'],
    durationMinutes: 120,
  },
];

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [judge, analysis] = await Promise.all([
      judgeQueue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
      analysisQueue.getJobCounts('waiting', 'active', 'failed'),
    ]);
    const workers = [];
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'jb:worker:*', 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        const vals = await redis.mget(keys);
        vals.forEach((v) => v && workers.push(JSON.parse(v)));
      }
    } while (cursor !== '0');
    const [users, problems, submissions] = await Promise.all([User.countDocuments(), Problem.countDocuments(), Submission.countDocuments()]);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const calibration = await Calibration.find({ ts: { $gte: since } }).sort({ ts: 1 }).limit(300).lean();
    res.json({
      queues: { judge, analysis },
      workers,
      totals: { users, problems, submissions },
      calibration: calibration.map((c) => ({ ts: c.ts, canaryMs: c.canaryMs, speedFactor: c.speedFactor, workerId: c.workerId })),
    });
  })
);

router.get('/contest-templates', (_req, res) => {
  res.json({ templates: CONTEST_TEMPLATES });
});

router.post(
  '/contest-templates/deploy',
  asyncHandler(async (req, res) => {
    const { templateId, durationMinutes = 90, startInMinutes = 0 } = req.body;
    const tmpl = CONTEST_TEMPLATES.find((t) => t.id === templateId) || CONTEST_TEMPLATES[0];

    // Find matching problems or fallback to any available problems
    let probs = await Problem.find({ slug: { $in: tmpl.problemSlugs } }).lean();
    if (probs.length < 4) {
      const more = await Problem.find({ _id: { $nin: probs.map((p) => p._id) } }).limit(4 - probs.length).lean();
      probs = [...probs, ...more];
    }

    const now = Date.now();
    const startsAt = new Date(now + startInMinutes * 60000);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
    const freezeAt = new Date(endsAt.getTime() - 15 * 60000);

    const contest = await Contest.create({
      title: `${tmpl.title} (Live)`,
      description: tmpl.description,
      startsAt,
      endsAt,
      freezeAt,
      problems: probs.map((p, i) => ({ problemId: p._id, label: String.fromCharCode(65 + i) })),
      createdBy: req.user.id,
    });

    res.status(201).json({ contest, message: `Successfully deployed "${contest.title}"!` });
  })
);

router.get(
  '/students',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).select('handle email role createdAt').lean();

    const performances = await Promise.all(
      users.map(async (u) => {
        const [totalSubs, acSubs, contestsJoined] = await Promise.all([
          Submission.countDocuments({ userId: u._id, isRun: { $ne: true } }),
          Submission.distinct('problemId', { userId: u._id, verdict: 'AC' }),
          Participant.countDocuments({ userId: u._id }),
        ]);

        const solvedCount = acSubs.length;
        const accuracy = totalSubs > 0 ? Math.round((solvedCount / totalSubs) * 100) : 0;

        const recent = await Submission.find({ userId: u._id, isRun: { $ne: true } })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('problemSlug verdict maxTimeMs maxMemKb createdAt')
          .lean();

        return {
          id: String(u._id),
          handle: u.handle,
          email: u.email,
          role: u.role,
          joined: u.createdAt,
          solvedCount,
          totalSubs,
          accuracy,
          contestsJoined,
          recent,
        };
      })
    );

    res.json({ students: performances });
  })
);

router.post(
  '/submissions/:id/rejudge',
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Submission not found');
    const s = await Submission.findById(req.params.id);
    if (!s) throw new HttpError(404, 'Submission not found');
    await Submission.updateOne({ _id: s._id }, { status: 'queued', verdict: null, tests: [], analysisStatus: 'none' });
    await enqueueJudge(s._id, { priority: 2 });
    res.json({ queued: true });
  })
);

router.put(
  '/users/:handle/role',
  asyncHandler(async (req, res) => {
    const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body);
    const u = await User.findOneAndUpdate({ handle: req.params.handle }, { role }, { new: true });
    if (!u) throw new HttpError(404, 'User not found');
    res.json({ handle: u.handle, role: u.role });
  })
);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).limit(100).select('handle email role createdAt').lean();
    res.json({ users });
  })
);

export default router;
