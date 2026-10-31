import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket.js';
import { Verdict, fmtDate, fmtMem, fmtMs } from '../components/Verdict.jsx';

export default function Submissions() {
  const { token } = useAuth();
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(null);
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    api.get('/submissions').then((d) => setSubs(d.submissions || [])).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocketEvent(token, 'submission:update', (evt) => { if (evt.status === 'done') load(); });

  const filtered = (subs || []).filter((s) => {
    const matchesQ = s.problemSlug.toLowerCase().includes(q.toLowerCase());
    const matchesV = verdictFilter === 'all' || s.verdict === verdictFilter;
    return matchesQ && matchesV;
  });

  const totalSubs = subs?.length || 0;
  const acCount = subs?.filter((s) => s.verdict === 'AC').length || 0;
  const acRate = totalSubs > 0 ? Math.round((acCount / totalSubs) * 100) : 0;

  return (
    <div className="container">
      {/* Header & Stats Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.4rem', fontSize: '2.1rem' }}>My Submissions</h1>
          <p className="muted" style={{ margin: 0 }}>
            Audit log of all your evaluated submissions with C1 confidence intervals and C2 growth classifications.
          </p>
        </div>

        <div className="row" style={{ gap: '0.75rem' }}>
          <div className="stat-pill" style={{ minWidth: 100 }}>
            <span className="label">Total</span>
            <span className="value">{totalSubs}</span>
          </div>
          <div className="stat-pill" style={{ minWidth: 100 }}>
            <span className="label">Accepted</span>
            <span className="value" style={{ color: 'var(--ok)' }}>{acCount}</span>
          </div>
          <div className="stat-pill" style={{ minWidth: 100 }}>
            <span className="label">Accuracy</span>
            <span className="value" style={{ color: 'var(--accent)' }}>{acRate}%</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
        <div className="row space-between" style={{ gap: '0.75rem' }}>
          <input
            placeholder="Filter by problem slug..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />

          <div className="row" style={{ gap: '0.5rem' }}>
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="all">All Verdicts</option>
              <option value="AC">Accepted (AC)</option>
              <option value="WA">Wrong Answer (WA)</option>
              <option value="TLE">Time Limit (TLE)</option>
              <option value="MLE">Memory Limit (MLE)</option>
              <option value="RE">Runtime Error (RE)</option>
              <option value="CE">Compile Error (CE)</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!subs && !error && <p className="muted">Loading submissions history...</p>}

      {subs && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Problem</th>
                <th>Language</th>
                <th>Verdict</th>
                <th>Peak CPU Time</th>
                <th>Memory</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="small muted">{fmtDate(s.createdAt)}</td>
                  <td>
                    <Link to={`/problems/${s.problemSlug}`} style={{ fontWeight: 600 }}>
                      {s.problemSlug}
                    </Link>
                  </td>
                  <td>
                    <span className="badge neutral mono" style={{ fontSize: '0.72rem' }}>
                      {s.language}
                    </span>
                  </td>
                  <td>
                    <Verdict verdict={s.verdict} status={s.status} short />
                    {s.borderline && (
                      <span className="badge TLE" style={{ marginLeft: 6, fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                        C1 borderline
                      </span>
                    )}
                  </td>
                  <td className="mono">{fmtMs(s.maxTimeMs)}</td>
                  <td className="mono">{fmtMem(s.maxMemKb)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/submissions/${s.id}`} className="btn btn-sm">
                      Inspect &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    No submissions found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
