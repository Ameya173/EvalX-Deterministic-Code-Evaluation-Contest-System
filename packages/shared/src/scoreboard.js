/**
 * ICPC-style scoreboard as a pure function of submissions.
 *
 * contest: { startsAt, endsAt, freezeAt?, problems: [{ problemId, label }] }
 * submissions: [{ userId, handle, problemId, verdict, status, createdAt }]
 * opts: { now, showFrozen }  (showFrozen=false hides results after freezeAt)
 *
 * Rules: Compilation Error and System Error do not count. Penalty = minutes of the
 * accepted submission + 20 per earlier wrong attempt on that problem.
 */
export const WRONG_PENALTY_MIN = 20;

export function computeScoreboard(contest, submissions, { now = new Date(), showFrozen = false } = {}) {
  const start = new Date(contest.startsAt).getTime();
  const end = new Date(contest.endsAt).getTime();
  const freeze = contest.freezeAt ? new Date(contest.freezeAt).getTime() : null;
  const frozenNow = freeze !== null && new Date(now).getTime() >= freeze && new Date(now).getTime() < end + 1;
  const hide = !showFrozen && freeze !== null && new Date(now).getTime() >= freeze;
  const labels = new Map(contest.problems.map((p) => [String(p.problemId), p.label]));

  const users = new Map();
  const firstSolves = new Set();
  const sorted = [...submissions]
    .filter((s) => {
      const t = new Date(s.createdAt).getTime();
      return t >= start && t <= end && labels.has(String(s.problemId));
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  for (const s of sorted) {
    const uid = String(s.userId);
    if (!users.has(uid)) users.set(uid, { userId: uid, handle: s.handle, solved: 0, penalty: 0, lastAccepted: 0, problems: {} });
    const row = users.get(uid);
    const label = labels.get(String(s.problemId));
    const cell = (row.problems[label] ||= { solved: false, attempts: 0, pending: 0, minutes: null, firstSolve: false });
    if (cell.solved) continue;
    const t = new Date(s.createdAt).getTime();
    const isFrozenSub = hide && t >= freeze;
    if (isFrozenSub || s.status !== 'done' || !s.verdict) {
      cell.pending += 1;
      continue;
    }
    if (s.verdict === 'CE' || s.verdict === 'SE') continue;
    if (s.verdict === 'AC') {
      cell.solved = true;
      if (!firstSolves.has(label)) {
        firstSolves.add(label);
        cell.firstSolve = true;
      }
      cell.minutes = Math.floor((t - start) / 60000);
      row.solved += 1;
      row.penalty += cell.minutes + WRONG_PENALTY_MIN * cell.attempts;
      row.lastAccepted = Math.max(row.lastAccepted, t);
    } else {
      cell.attempts += 1;
    }
  }

  const rows = [...users.values()].sort(
    (a, b) => b.solved - a.solved || a.penalty - b.penalty || a.lastAccepted - b.lastAccepted || a.handle.localeCompare(b.handle)
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return { rows, frozen: hide && frozenNow, labels: contest.problems.map((p) => p.label) };
}
