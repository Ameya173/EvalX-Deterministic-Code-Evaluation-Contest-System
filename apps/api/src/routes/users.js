import { Router } from 'express';
import { Submission, User } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';

const router = Router();

router.get(
  '/:handle',
  asyncHandler(async (req, res) => {
    const u = await User.findOne({ handle: req.params.handle }).select('handle createdAt').lean();
    if (!u) throw new HttpError(404, 'User not found');
    const [solved, total] = await Promise.all([Submission.distinct('problemSlug', { userId: u._id, verdict: 'AC' }), Submission.countDocuments({ userId: u._id })]);
    res.json({ handle: u.handle, joined: u.createdAt, solved: solved.length, solvedProblems: solved, submissions: total });
  })
);

export default router;
