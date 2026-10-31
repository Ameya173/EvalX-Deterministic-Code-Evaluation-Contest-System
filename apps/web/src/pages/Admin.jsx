import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// ─── Spark Chart ──────────────────────────────────────────────────────────────
function Spark({ points }) {
  if (!points || points.length < 2) return <span className="muted small">Collecting canary timings...</span>;
  const W = 280, H = 50;
  const ys = points.map((p) => p.canaryMs);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const path = points.map((p, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${(H - ((p.canaryMs - lo) / (hi - lo || 1)) * (H - 10) - 5).toFixed(1)}`).join(' ');
  const lastVal = ys[ys.length - 1];
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <svg width={W} height={H} style={{ background: 'var(--surface-elevated)', borderRadius: 6, padding: '4px' }}>
        <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
        Latest: <strong className="mono" style={{ color: 'var(--text)' }}>{Math.round(lastVal * 10) / 10} ms</strong>
        {' '}(Range: {Math.round(lo)}–{Math.round(hi)} ms)
      </div>
    </div>
  );
}

// ─── Ready-Made Contest Templates ─────────────────────────────────────────────
const TEMPLATE_META = {
  'codesprint-foundations': { icon: '🚀', color: '#6366f1' },
  'sliding-window-challenge': { icon: '🪟', color: '#8b5cf6' },
  'dp-grand-prix': { icon: '🧮', color: '#f59e0b' },
  'trees-graphs-cup': { icon: '🌳', color: '#22c55e' },
  'faang-final-mock': { icon: '🏆', color: '#ec4899' },
};

function ContestTemplates({ onDeployed }) {
  const [templates, setTemplates] = useState([]);
  const [deploying, setDeploying] = useState(null);
  const [msg, setMsg] = useState(null);
  const [duration, setDuration] = useState(90);
  const [startIn, setStartIn] = useState(0);

  useEffect(() => {
    api.get('/admin/contest-templates').then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  async function deploy(templateId) {
    setDeploying(templateId);
    setMsg(null);
    try {
      const d = await api.post('/admin/contest-templates/deploy', { templateId, durationMinutes: duration, startInMinutes: startIn });
      setMsg({ type: 'ok', text: `✓ ${d.message}` });
      onDeployed?.();
    } catch (e) {
      setMsg({ type: 'error', text: `Deploy failed: ${e.message}` });
    } finally {
      setDeploying(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem' }}>🏆 1-Click Contest Deployment</h2>
          <p className="muted small" style={{ margin: 0 }}>Deploy pre-built, curated contest packages instantly. Problems are auto-selected from the database.</p>
        </div>
        <div className="row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label className="filter-label">Duration (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(+e.target.value)} min={30} max={300} style={{ width: 90 }} />
          </div>
          <div>
            <label className="filter-label">Starts in (min)</label>
            <input type="number" value={startIn} onChange={(e) => setStartIn(+e.target.value)} min={0} max={60} style={{ width: 90 }} />
          </div>
        </div>
      </div>

      {msg && <div className={`alert ${msg.type}`} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      <div className="templates-grid">
        {templates.map((t) => {
          const meta = TEMPLATE_META[t.id] || { icon: '📝', color: 'var(--primary)' };
          return (
            <div key={t.id} className="template-card" style={{ '--tmpl-color': meta.color }}>
              <div className="template-icon">{meta.icon}</div>
              <div className="template-body">
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{t.title}</div>
                <div className="muted small" style={{ marginBottom: '0.5rem' }}>{t.description}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {(t.problemSlugs || []).slice(0, 3).map((s) => (
                    <span key={s} className="badge neutral" style={{ fontSize: '0.65rem' }}>{s.replace(/-/g, ' ')}</span>
                  ))}
                  {(t.problemSlugs || []).length > 3 && (
                    <span className="badge neutral" style={{ fontSize: '0.65rem' }}>+{(t.problemSlugs || []).length - 3} more</span>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => deploy(t.id)}
                  disabled={deploying === t.id}
                >
                  {deploying === t.id ? '⏳ Deploying...' : '⚡ Deploy Now'}
                </button>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && <p className="muted">Loading templates...</p>}
      </div>
    </div>
  );
}

// ─── Student Performance Dashboard ────────────────────────────────────────────
function StudentDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('solved');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/students').then((d) => { setStudents(d.students || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const shown = students
    .filter((s) => s.handle.toLowerCase().includes(q.toLowerCase()) || s.email.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'solved') return b.solvedCount - a.solvedCount;
      if (sortBy === 'accuracy') return b.accuracy - a.accuracy;
      if (sortBy === 'submissions') return b.totalSubmissions - a.totalSubmissions;
      if (sortBy === 'contests') return b.contestsJoined - a.contestsJoined;
      return 0;
    });

  const verdictColor = { AC: 'var(--ok)', WA: 'var(--bad)', TLE: 'var(--warn)', MLE: '#f97316', RE: '#a855f7', CE: 'var(--text-dim)' };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.2rem' }}>👥 Student Performance Roster</h2>
          <p className="muted small" style={{ margin: 0 }}>{students.length} registered students</p>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          <input placeholder="Search handle / email..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 150 }}>
            <option value="solved">Most Solved</option>
            <option value="accuracy">Best Accuracy</option>
            <option value="submissions">Most Submissions</option>
            <option value="contests">Most Contests</option>
          </select>
        </div>
      </div>

      {loading && <p className="muted">Loading student data...</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="problems-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Student</th>
              <th>Role</th>
              <th style={{ width: 90 }}>Solved</th>
              <th style={{ width: 100 }}>Accuracy</th>
              <th style={{ width: 100 }}>Submissions</th>
              <th style={{ width: 90 }}>Contests</th>
              <th style={{ width: 100 }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, idx) => (
              <>
                <tr key={s.handle} className="problem-row">
                  <td className="muted mono small">{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.handle}</div>
                    <div className="muted small">{s.email}</div>
                  </td>
                  <td><span className="badge neutral" style={{ fontSize: '0.7rem' }}>{s.role}</span></td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--ok)', fontSize: '1.05rem' }}>{s.solvedCount}</span>
                  </td>
                  <td>
                    <div className="acceptance-cell">
                      <span className="mono small">{s.accuracy}%</span>
                      <div className="acceptance-bar">
                        <div className="acceptance-fill" style={{ width: `${s.accuracy}%`, background: s.accuracy > 70 ? 'var(--ok)' : s.accuracy > 40 ? 'var(--warn)' : 'var(--bad)' }} />
                      </div>
                    </div>
                  </td>
                  <td><span className="mono">{s.totalSubmissions}</span></td>
                  <td><span className="mono">{s.contestsJoined}</span></td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setExpanded(expanded === s.handle ? null : s.handle)}
                    >
                      {expanded === s.handle ? '▲ Hide' : '▼ Inspect'}
                    </button>
                  </td>
                </tr>
                {expanded === s.handle && (
                  <tr key={`${s.handle}-detail`}>
                    <td colSpan="8" style={{ background: 'var(--surface-elevated)', padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Recent Submissions</div>
                      {s.recentSubmissions?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {s.recentSubmissions.map((sub, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                              <span className="mono" style={{ fontWeight: 700, color: verdictColor[sub.verdict] || 'var(--text)' }}>{sub.verdict}</span>
                              <span style={{ fontWeight: 600 }}>{sub.problemId}</span>
                              <span className="badge neutral mono" style={{ fontSize: '0.65rem' }}>{sub.lang}</span>
                              <span className="muted small">{new Date(sub.createdAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted small">No submissions yet.</span>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!loading && !shown.length && (
              <tr><td colSpan="8" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Contest Creation Form ─────────────────────────────────────────────────────
function ContestForm({ onCreated }) {
  const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: toLocal(new Date(Date.now() + 3600e3)),
    endsAt: toLocal(new Date(Date.now() + 3 * 3600e3)),
    freezeAt: '',
    problems: 'two-sum:A\nbest-time-to-buy-and-sell-stock:B\nmaximum-subarray:C',
  });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    setError(null); setMsg(null);
    try {
      const problems = form.problems.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [slug, label] = l.split(':');
        return { slug: slug.trim(), label: (label || '').trim() };
      });
      const body = { title: form.title, description: form.description, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), problems };
      if (form.freezeAt) body.freezeAt = new Date(form.freezeAt).toISOString();
      const d = await api.post('/contests', body);
      setMsg(`✓ Created contest ${d.id} — it's live!`);
      onCreated?.();
    } catch (e) {
      setError([e.message, ...(e.details || [])].join(' | '));
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>✏️ Create Custom Contest</h2>
      <div className="grid2">
        <div>
          <label>Title</label>
          <input value={form.title} onChange={set('title')} placeholder="e.g. Weekly Coding Challenge #12" />
          <label>Description</label>
          <input value={form.description} onChange={set('description')} placeholder="Rules, prizes, and overview..." />
          <div className="grid2">
            <div><label>Starts At</label><input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} /></div>
            <div><label>Ends At</label><input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} /></div>
          </div>
          <label>Freeze Scoreboard At (Optional)</label>
          <input type="datetime-local" value={form.freezeAt} onChange={set('freezeAt')} />
        </div>
        <div>
          <label>Problems (one per line: slug:label)</label>
          <textarea rows="8" value={form.problems} onChange={set('problems')} style={{ fontFamily: 'var(--mono)' }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}
      <button className="btn btn-primary" onClick={create} disabled={!form.title} style={{ marginTop: '1rem' }}>
        🚀 Launch Contest
      </button>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [rejudgeId, setRejudgeId] = useState('');
  const [rejudgeMsg, setRejudgeMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(() => {
    api.get('/admin/stats').then(setStats).catch((e) => setError(e.message));
    api.get('/admin/users').then((d) => setUsers(d.users || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => api.get('/admin/stats').then(setStats).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [load]);

  async function setRole(handle, role) {
    await api.put(`/admin/users/${handle}/role`, { role });
    load();
  }

  async function rejudge() {
    try {
      await api.post(`/admin/submissions/${rejudgeId.trim()}/rejudge`);
      setRejudgeMsg({ type: 'ok', text: '✓ Submission re-queued for judging.' });
    } catch (e) {
      setRejudgeMsg({ type: 'error', text: `Rejudge failed: ${e.message}` });
    }
  }

  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!stats) return <div className="container muted">Loading admin panel...</div>;

  const q = stats.queues;
  const TABS = ['overview', 'contests', 'students', 'users'];

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '2rem' }}>🛡️ Admin Control Center</h1>
          <p className="muted small" style={{ margin: 0 }}>Deploy contests, track students, manage users, monitor system health.</p>
        </div>
        <div className="problems-stat-row">
          <div className="stat-pill-sm"><span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.totals?.users ?? 0}</span><span className="muted small">Users</span></div>
          <div className="stat-pill-sm"><span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>{stats.totals?.problems ?? 0}</span><span className="muted small">Problems</span></div>
          <div className="stat-pill-sm"><span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--ok)' }}>{stats.totals?.submissions ?? 0}</span><span className="muted small">Submissions</span></div>
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: stats.queues?.judge?.active > 0 ? 'var(--ok)' : 'var(--text-dim)' }}>
              {stats.queues?.judge?.active ?? 0}
            </span>
            <span className="muted small">Judging</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`admin-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' && '📊 '}
            {t === 'contests' && '🏆 '}
            {t === 'students' && '👥 '}
            {t === 'users' && '🔑 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid2">
            {/* Queue Metrics */}
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Queue Backpressure</h2>
              <table>
                <thead>
                  <tr><th>Queue</th><th>Waiting</th><th>Active</th><th>Failed</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Judge</strong></td>
                    <td className="mono" style={{ color: q.judge.waiting > 0 ? 'var(--warn)' : 'inherit' }}>{q.judge.waiting}</td>
                    <td className="mono" style={{ color: q.judge.active > 0 ? 'var(--ok)' : 'inherit' }}>{q.judge.active}</td>
                    <td className="mono" style={{ color: q.judge.failed > 0 ? 'var(--bad)' : 'inherit' }}>{q.judge.failed}</td>
                  </tr>
                  <tr>
                    <td><strong>Analysis</strong></td>
                    <td className="mono">{q.analysis.waiting}</td>
                    <td className="mono">{q.analysis.active}</td>
                    <td className="mono">{q.analysis.failed}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Worker Nodes */}
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Worker Nodes ({stats.workers.length})</h2>
              <table>
                <thead>
                  <tr><th>ID</th><th>Active</th><th>Speed</th><th>Policy</th></tr>
                </thead>
                <tbody>
                  {stats.workers.map((w) => (
                    <tr key={w.id}>
                      <td className="mono small">{w.id.slice(0, 12)}…</td>
                      <td className="mono">{w.active}/{w.concurrency}</td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{w.speedFactor}x</td>
                      <td><span className="badge neutral mono" style={{ fontSize: '0.7rem' }}>{w.policy}</span></td>
                    </tr>
                  ))}
                  {!stats.workers.length && <tr><td colSpan="4" className="muted small">No workers online.</td></tr>}
                </tbody>
              </table>
              <h3 style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.9rem' }}>Canary CPU (Past Hour)</h3>
              <Spark points={stats.calibration} />
            </div>
          </div>

          {/* Rejudge Tool */}
          <div className="card">
            <h2 style={{ marginTop: 0 }}>🔁 Manual Rejudge</h2>
            <div className="row" style={{ gap: '0.65rem' }}>
              <input
                style={{ maxWidth: 360 }}
                placeholder="Paste submission MongoDB ID..."
                value={rejudgeId}
                onChange={(e) => setRejudgeId(e.target.value)}
              />
              <button className="btn btn-primary" onClick={rejudge} disabled={!rejudgeId.trim()}>
                Queue Rejudge
              </button>
              {rejudgeMsg && <span className={`small ${rejudgeMsg.type === 'ok' ? '' : 'muted'}`} style={{ color: rejudgeMsg.type === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{rejudgeMsg.text}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Contests Tab */}
      {activeTab === 'contests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ContestTemplates onDeployed={load} />
          <ContestForm onCreated={load} />
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && <StudentDashboard />}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: '1.25rem 1.25rem 0' }}>
            <h2 style={{ margin: '0 0 0.25rem' }}>🔑 Role Management</h2>
            <p className="muted small" style={{ margin: '0 0 1rem' }}>Promote users to setter or admin. Setters can create and manage problems.</p>
          </div>
          <table className="problems-table">
            <thead>
              <tr><th>Handle</th><th>Email</th><th style={{ width: 180 }}>Role</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.handle} className="problem-row">
                  <td style={{ fontWeight: 700 }}>{u.handle}</td>
                  <td className="small muted">{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => setRole(u.handle, e.target.value)} style={{ width: 140 }}>
                      <option value="user">User</option>
                      <option value="setter">Setter</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
