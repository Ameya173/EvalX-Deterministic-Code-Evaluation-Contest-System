import { Contest, Participant } from '@judgebox/shared';

export const isOwnerOrAdmin = (user, problem) => !!user && (user.role === 'admin' || String(problem.authorId) === user.id);

/** public problems: everyone. private: author/admin. contest: after the contest starts, participants (everyone once it has ended). */
export async function canViewProblem(user, problem) {
  if (problem.visibility === 'public') return true;
  if (!user) return false;
  if (isOwnerOrAdmin(user, problem)) return true;
  if (problem.visibility === 'contest') {
    const now = new Date();
    const contests = await Contest.find({ 'problems.problemId': problem._id, startsAt: { $lte: now } }).select('_id endsAt').lean();
    if (!contests.length) return false;
    if (contests.some((c) => new Date(c.endsAt) < now)) return true;
    return !!(await Participant.exists({ contestId: { $in: contests.map((c) => c._id) }, userId: user.id }));
  }
  return false;
}
