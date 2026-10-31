import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Manage() {
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/problems/mine').then((d) => setProblems(d.problems)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.1rem' }}>Problem Management & Authoring</h1>
          <p className="muted" style={{ margin: '0.2rem 0 0' }}>
            Author problem statements, write generators, and analyze test-suite strength using mutation testing.
          </p>
        </div>
        <Link to="/manage/new" className="btn btn-primary">
          + Author New Problem
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!problems && !error && <p className="muted">Loading problems...</p>}

      {problems && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Visibility</th>
                <th>C3 Mutation Score</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => {
                const score = p.strength?.score;
                const scorePct = score != null ? Math.round(score * 100) : null;
                const badgeClass = scorePct >= 80 ? 'AC' : scorePct != null ? 'TLE' : 'neutral';

                return (
                  <tr key={p.slug}>
                    <td>
                      <Link to={`/problems/${p.slug}`} style={{ fontWeight: 600, fontSize: '1rem' }}>
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <span className="badge neutral mono" style={{ fontSize: '0.75rem' }}>{p.visibility}</span>
                    </td>
                    <td>
                      {scorePct != null ? (
                        <div className="row" style={{ gap: '0.5rem' }}>
                          <span className={`badge ${badgeClass}`}>{scorePct}% Caught</span>
                          <span className="small muted">
                            ({p.strength.killed}/{p.strength.nonEquivalent} non-equivalent mutants killed)
                          </span>
                        </div>
                      ) : (
                        <span className="muted small">Not analyzed yet &ndash; run in editor</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/manage/${p.slug}`} className="btn btn-sm">
                        Edit &amp; Mutate &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!problems.length && (
                <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No authored problems yet. Click "Author New Problem" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
