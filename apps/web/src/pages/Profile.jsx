import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Verdict.jsx';

export default function Profile() {
  const { handle } = useParams();
  const [u, setU] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/users/${handle}`).then(setU).catch((e) => setError(e.message));
  }, [handle]);

  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!u) return <div className="container muted">Loading user profile...</div>;

  const totalSubs = u.submissions || 0;
  const solved = u.solved || 0;
  const rate = totalSubs > 0 ? Math.round((solved / totalSubs) * 100) : 0;

  return (
    <div className="container">
      {/* Profile Card */}
      <div className="card highlight" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.8rem',
              fontWeight: 800,
              boxShadow: '0 0 20px var(--primary-glow)',
            }}
          >
            {u.handle[0].toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem' }}>{u.handle}</h1>
              <span className="badge neutral">Member</span>
            </div>
            <p className="muted small" style={{ margin: '0.2rem 0 0' }}>
              Registered on {fmtDate(u.joined)}
            </p>
          </div>

          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="stat-pill" style={{ minWidth: 100 }}>
              <span className="label">Solved</span>
              <span className="value" style={{ color: 'var(--ok)' }}>{solved}</span>
            </div>
            <div className="stat-pill" style={{ minWidth: 100 }}>
              <span className="label">Submissions</span>
              <span className="value">{totalSubs}</span>
            </div>
            <div className="stat-pill" style={{ minWidth: 100 }}>
              <span className="label">Solve Rate</span>
              <span className="value" style={{ color: 'var(--accent)' }}>{rate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Solved Problems Portfolio */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Solved Problems Archive ({u.solvedProblems?.length || 0})</h2>
        {u.solvedProblems?.length ? (
          <div className="row" style={{ gap: '0.5rem', marginTop: '0.75rem' }}>
            {u.solvedProblems.map((s) => (
              <Link
                key={s}
                to={`/problems/${s}`}
                className="badge AC"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', textDecoration: 'none' }}
              >
                ✓ {s}
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: '0.5rem 0 0' }}>
            No solved problems yet. Head to the <Link to="/">Problem Archive</Link> to start coding!
          </p>
        )}
      </div>
    </div>
  );
}
