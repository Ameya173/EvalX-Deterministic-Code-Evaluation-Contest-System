import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket.js';
import { Verdict, fmtDate } from '../components/Verdict.jsx';

const pad = (n) => String(n).padStart(2, '0');
function countdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function Scoreboard({ board }) {
  const [filterUser, setFilterUser] = useState('');

  if (!board) return <p className="muted">Loading scoreboard...</p>;

  const filteredRows = (board.rows || []).filter((r) =>
    r.handle.toLowerCase().includes(filterUser.toLowerCase())
  );

  // Compute problem solve totals
  const problemStats = {};
  board.labels.forEach((l) => {
    problemStats[l] = { solved: 0, tries: 0 };
  });

  board.rows.forEach((r) => {
    board.labels.forEach((l) => {
      const c = r.problems[l];
      if (c) {
        if (c.solved) problemStats[l].solved++;
        problemStats[l].tries += (c.attempts || 0) + (c.solved ? 1 : 0);
      }
    });
  });

  return (
    <>
      {board.frozen && (
        <div className="alert info">
          <div>
            <strong>Scoreboard Frozen:</strong> Submissions after the freeze timestamp are hidden from public view and appear as pending (?) until the contest concludes.
          </div>
        </div>
      )}

      {/* Scoreboard Actions & Filter */}
      <div className="row space-between" style={{ marginBottom: '0.75rem', gap: '0.5rem' }}>
        <input
          placeholder="Filter contestants by handle..."
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <div className="small muted" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span><strong style={{ color: 'var(--ok)' }}>■</strong> Solved</span>
          <span><span style={{ color: '#f59e0b', fontWeight: 800 }}>★</span> First AC</span>
          <span><strong style={{ color: 'var(--bad)' }}>■</strong> Attempted</span>
          <span><strong style={{ color: 'var(--info)' }}>?</strong> Pending</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="sb">
          <thead>
            <tr>
              <th style={{ width: 50, textAlign: 'center' }}>Rank</th>
              <th>Contestant</th>
              <th style={{ width: 80, textAlign: 'center' }}>Solved</th>
              <th style={{ width: 90, textAlign: 'center' }}>Penalty</th>
              {board.labels.map((l) => (
                <th key={l} style={{ textAlign: 'center', minWidth: 65 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const rankIcon = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null;
              return (
                <tr key={r.userId}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>
                    {rankIcon ? <span title={`Rank ${r.rank}`} style={{ fontSize: '1.05rem' }}>{rankIcon}</span> : r.rank}
                  </td>
                  <td>
                    <Link to={`/users/${r.handle}`} style={{ fontWeight: 600 }}>
                      {r.handle}
                    </Link>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: r.solved > 0 ? 'var(--ok)' : 'inherit' }}>
                    {r.solved}
                  </td>
                  <td className="mono" style={{ textAlign: 'center' }}>{r.penalty}</td>
                  {board.labels.map((l) => {
                    const c = r.problems[l];
                    if (!c) return <td key={l} className="cell"></td>;
                    if (c.solved) {
                      return (
                        <td key={l} className={`cell solved ${c.firstSolve ? 'first-solve' : ''}`}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            {c.firstSolve && <span title="First to Solve!" style={{ color: '#f59e0b' }}>★</span>}
                            <span>+{c.attempts ? c.attempts : ''}</span>
                          </div>
                          <div className="small" style={{ opacity: 0.85 }}>{c.minutes}m</div>
                        </td>
                      );
                    }
                    if (c.pending) return <td key={l} className="cell pend">?{c.pending}</td>;
                    return <td key={l} className="cell tried">-{c.attempts}</td>;
                  })}
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr><td colSpan={4 + board.labels.length} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No submissions yet.</td></tr>
            )}

            {/* Problem Stats Footer Row */}
            {filteredRows.length > 0 && (
              <tr style={{ background: 'var(--surface-elevated)', fontWeight: 600, fontSize: '0.8rem' }}>
                <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Solves / Attempts:</td>
                {board.labels.map((l) => {
                  const stat = problemStats[l];
                  return (
                    <td key={l} className="cell" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--ok)' }}>{stat?.solved || 0}</span> / {stat?.tries || 0}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="help" style={{ marginTop: '0.5rem' }}>
        ICPC Penalty = sum of solve times in minutes + 20 minutes per incorrect attempt prior to acceptance. Compilation and System Errors do not incur penalty.
      </p>
    </>
  );
}

export default function Contest() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [contest, setContest] = useState(null);
  const [board, setBoard] = useState(null);
  const [mine, setMine] = useState([]);
  const [tab, setTab] = useState('problems');
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());

  const loadContest = useCallback(() => api.get(`/contests/${id}`).then((d) => {
    setContest(d.contest);
    setOffset(new Date(d.contest.serverTime).getTime() - Date.now());
  }).catch((e) => setError(e.message)), [id]);

  const loadBoard = useCallback(() => api.get(`/contests/${id}/scoreboard`).then(setBoard).catch(() => {}), [id]);
  const loadMine = useCallback(() => (user ? api.get(`/submissions?contest=${id}`).then((d) => setMine(d.submissions || [])).catch(() => {}) : null), [id, user]);

  useEffect(() => {
    loadContest();
    loadBoard();
    loadMine();
  }, [loadContest, loadBoard, loadMine, token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useSocketEvent(token, 'scoreboard:update', () => { loadBoard(); loadMine(); }, { contestId: id });
  useSocketEvent(token, 'submission:update', (e) => { if (e.status === 'done') loadMine(); });

  async function join() {
    await api.post(`/contests/${id}/join`);
    loadContest();
  }

  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!contest) return <div className="container muted">Loading contest arena...</div>;

  const start = new Date(contest.startsAt).getTime();
  const end = new Date(contest.endsAt).getTime();
  const t = now + offset;
  const phase = t < start ? 'upcoming' : t <= end ? 'running' : 'ended';
  const progressPct = phase === 'running' ? Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100)) : phase === 'ended' ? 100 : 0;

  return (
    <div className="container">
      {/* Contest Banner Card */}
      <div className="card highlight" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{contest.title}</h1>
              <span className={`badge ${phase === 'running' ? 'AC' : phase === 'upcoming' ? 'pending' : 'neutral'}`}>
                {phase === 'running' && <span className="pulse-dot" />}
                {phase.toUpperCase()}
              </span>
            </div>
            <p className="muted small" style={{ margin: '0.3rem 0 0' }}>
              {fmtDate(contest.startsAt)} &ndash; {fmtDate(contest.endsAt)}
            </p>
          </div>

          {/* Time Remaining Pill */}
          <div className="row" style={{ gap: '0.75rem' }}>
            {phase === 'upcoming' && (
              <div className="stat-pill">
                <span className="label">Starts In</span>
                <span className="value mono">{countdown(start - t)}</span>
              </div>
            )}
            {phase === 'running' && (
              <div className="stat-pill" style={{ borderColor: 'var(--ok-border)' }}>
                <span className="label">Time Remaining</span>
                <span className="value mono" style={{ color: 'var(--ok)' }}>{countdown(end - t)}</span>
              </div>
            )}
            {user && !contest.joined && phase !== 'ended' && (
              <button className="btn btn-primary" onClick={join}>
                Join Contest
              </button>
            )}
            {!user && (
              <Link to="/login" state={{ from: `/contests/${id}` }} className="btn btn-primary">
                Log in to join
              </Link>
            )}
          </div>
        </div>

        {/* Contest Timeline Progress Bar */}
        {phase === 'running' && (
          <div style={{ marginTop: '1rem' }}>
            <div className="progress">
              <div style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {contest.description && (
          <p style={{ marginTop: '0.75rem', marginBottom: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            {contest.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['problems', 'scoreboard', 'mine'].map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {k === 'mine' ? 'My Submissions' : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      {/* TAB 1: Problems */}
      {tab === 'problems' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60, textAlign: 'center' }}>#</th>
                <th>Problem Title</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {contest.problems.map((p) => (
                <tr key={p.label}>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.label}</td>
                  <td>
                    {p.slug ? (
                      <Link to={`/problems/${p.slug}${phase === 'running' ? `?contest=${id}` : ''}`} style={{ fontWeight: 600 }}>
                        {p.title}
                      </Link>
                    ) : (
                      <span className="muted">Hidden until contest commences</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.slug && (
                      <Link to={`/problems/${p.slug}${phase === 'running' ? `?contest=${id}` : ''}`} className="btn btn-sm">
                        Solve &rarr;
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {!contest.problems.length && (
                <tr><td colSpan="3" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Problems will appear when the contest starts.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Scoreboard */}
      {tab === 'scoreboard' && <Scoreboard board={board} />}

      {/* TAB 3: My Submissions */}
      {tab === 'mine' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Problem</th>
                <th>Verdict</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.id}>
                  <td className="small muted">{fmtDate(s.createdAt)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{s.problemSlug}</td>
                  <td><Verdict verdict={s.verdict} status={s.status} short /></td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/submissions/${s.id}`} className="btn btn-sm">Inspect</Link>
                  </td>
                </tr>
              ))}
              {!mine.length && (
                <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No submissions in this contest yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
