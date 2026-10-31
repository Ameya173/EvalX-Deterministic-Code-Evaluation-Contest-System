import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate } from '../components/Verdict.jsx';

export default function Contests() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/contests').then((d) => setList(d.contests)).catch((e) => setError(e.message));
  }, []);

  const filtered = (list || []).filter((c) => {
    if (filter === 'all') return true;
    return c.phase === filter;
  });

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.4rem', fontSize: '2.1rem' }}>Contest Arena</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
            Compete in ICPC-style timed programming contests with real-time scoreboards, automatic freeze periods, and live verdict broadcasts.
          </p>
        </div>

        {isAdmin && (
          <Link to="/admin" className="btn btn-primary">
            + Create Contest
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All Contests</button>
        <button className={filter === 'running' ? 'on' : ''} onClick={() => setFilter('running')}>🔥 Live Now</button>
        <button className={filter === 'upcoming' ? 'on' : ''} onClick={() => setFilter('upcoming')}>Upcoming</button>
        <button className={filter === 'ended' ? 'on' : ''} onClick={() => setFilter('ended')}>Past</button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!list && !error && <p className="muted">Loading contests...</p>}

      {list && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Contest Title</th>
                <th>Starts</th>
                <th>Ends</th>
                <th style={{ width: 110, textAlign: 'center' }}>Problems</th>
                <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/contests/${c.id}`} style={{ fontWeight: 600, fontSize: '1rem' }}>
                      {c.title}
                    </Link>
                  </td>
                  <td className="small muted">{fmtDate(c.startsAt)}</td>
                  <td className="small muted">{fmtDate(c.endsAt)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.problems}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c.phase === 'running' ? 'AC' : c.phase === 'upcoming' ? 'pending' : 'neutral'}`}>
                      {c.phase === 'running' && <span className="pulse-dot" />}
                      {c.phase.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/contests/${c.id}`} className="btn btn-sm">
                      Enter Arena &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    No contests in this category.
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
