import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const TOPIC_LIST = ['Arrays', 'Strings', 'Linked List', 'Stacks & Queues', 'Binary Search', 'Trees', 'Dynamic Programming', 'Graphs', 'Heaps', 'Backtracking', 'Greedy', 'Bit Manipulation', 'Math'];
const SHEETS = ['Blind 75', 'NeetCode 150', 'Striver SDE', 'Top 500 Mastery'];
const COMPANIES = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Uber', 'Netflix', 'Bloomberg', 'Goldman Sachs'];

function diffLabel(d) {
  if (d <= 1000) return { label: 'Easy', color: 'var(--ok)' };
  if (d <= 1300) return { label: 'Medium', color: 'var(--warn)' };
  if (d <= 1600) return { label: 'Hard', color: '#f97316' };
  return { label: 'Expert', color: 'var(--bad)' };
}

export default function Problems() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [q, setQ] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [sheetFilter, setSheetFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minDiff, setMinDiff] = useState(+(searchParams.get('minDiff') || 0));
  const [maxDiff, setMaxDiff] = useState(+(searchParams.get('maxDiff') || 2400));
  const [sortBy, setSortBy] = useState('difficulty');
  const [view, setView] = useState('table'); // 'table' | 'grid'

  useEffect(() => {
    api.get('/problems').then((d) => setProblems(d.problems)).catch((e) => setError(e.message));
  }, [token]);

  const shown = useMemo(() => {
    if (!problems) return [];
    return problems
      .filter((p) => {
        const d = p.difficulty || 800;
        const matchDiff = d >= (minDiff || 0) && d <= (maxDiff || 9999);
        const matchQ = (p.title + ' ' + (p.tags || []).join(' ') + ' ' + (p.companies || []).join(' ')).toLowerCase().includes(q.toLowerCase());
        const matchTopic = topicFilter === 'all' || p.category === topicFilter || (p.tags || []).some(t => t === topicFilter);
        const matchSheet = sheetFilter === 'all' || (p.sheet || []).includes(sheetFilter);
        const matchCompany = companyFilter === 'all' || (p.companies || []).includes(companyFilter);
        const matchStatus = statusFilter === 'all' || (statusFilter === 'solved' && p.solved) || (statusFilter === 'unsolved' && !p.solved);
        return matchDiff && matchQ && matchTopic && matchSheet && matchCompany && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'difficulty') return (a.difficulty || 0) - (b.difficulty || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'acceptance') return (b.acceptanceRate || 0) - (a.acceptanceRate || 0);
        return 0;
      });
  }, [problems, q, topicFilter, sheetFilter, companyFilter, statusFilter, minDiff, maxDiff, sortBy]);

  const stats = useMemo(() => {
    if (!problems) return {};
    return {
      total: problems.length,
      solved: problems.filter((p) => p.solved).length,
      easy: problems.filter((p) => (p.difficulty || 0) <= 1000).length,
      medium: problems.filter((p) => { const d = p.difficulty || 0; return d > 1000 && d <= 1300; }).length,
      hard: problems.filter((p) => (p.difficulty || 0) > 1300).length,
    };
  }, [problems]);

  return (
    <div className="container">
      {/* Page Header */}
      <div className="problems-header">
        <div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: '2rem' }}>Problem Archive</h1>
          <p className="muted" style={{ margin: 0 }}>
            500+ curated DSA problems across 13 topics. Filter, sort, and track your progress.
          </p>
        </div>
        <div className="problems-stat-row">
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.total ?? '—'}</span>
            <span className="muted small">Total</span>
          </div>
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ok)' }}>{stats.solved ?? 0}</span>
            <span className="muted small">Solved</span>
          </div>
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ok)' }}>{stats.easy ?? '—'}</span>
            <span className="muted small">Easy</span>
          </div>
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warn)' }}>{stats.medium ?? '—'}</span>
            <span className="muted small">Medium</span>
          </div>
          <div className="stat-pill-sm">
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--bad)' }}>{stats.hard ?? '—'}</span>
            <span className="muted small">Hard+</span>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="card filters-panel">
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search by title, tag, company..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: '2.4rem', width: '100%' }}
          />
        </div>

        {/* Row 1: Topic + Sheet + Company + Status */}
        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label">Topic</label>
            <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
              <option value="all">All Topics</option>
              {TOPIC_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Sheet</label>
            <select value={sheetFilter} onChange={(e) => setSheetFilter(e.target.value)}>
              <option value="all">All Sheets</option>
              {SHEETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Company</label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="all">All Companies</option>
              {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="solved">✓ Solved</option>
              <option value="unsolved">○ Unsolved</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="difficulty">Difficulty</option>
              <option value="title">Title A-Z</option>
              <option value="acceptance">Acceptance %</option>
            </select>
          </div>
          <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setQ(''); setTopicFilter('all'); setSheetFilter('all'); setCompanyFilter('all'); setStatusFilter('all'); setMinDiff(0); setMaxDiff(2400); }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Difficulty Range Slider */}
        <div className="diff-range-row">
          <label className="filter-label">Difficulty Range:</label>
          <div className="diff-range-controls">
            <span className="mono small" style={{ color: 'var(--ok)', minWidth: 35 }}>{minDiff || 800}</span>
            <input
              type="range" min={800} max={2400} step={50}
              value={minDiff || 800}
              onChange={(e) => setMinDiff(+e.target.value)}
              className="range-input-inline"
              style={{ flex: 1 }}
            />
            <div className="diff-range-bar">
              <div
                className="diff-bar-fill"
                style={{
                  left: `${(((minDiff || 800) - 800) / 1600) * 100}%`,
                  width: `${(((maxDiff || 2400) - (minDiff || 800)) / 1600) * 100}%`,
                }}
              />
            </div>
            <input
              type="range" min={800} max={2400} step={50}
              value={maxDiff || 2400}
              onChange={(e) => setMaxDiff(+e.target.value)}
              className="range-input-inline"
              style={{ flex: 1 }}
            />
            <span className="mono small" style={{ color: 'var(--bad)', minWidth: 35 }}>{maxDiff || 2400}</span>
          </div>
        </div>

        {/* Topic Quick Pills */}
        <div className="topic-pills-row">
          <button className={`btn-chip ${topicFilter === 'all' ? 'active' : ''}`} onClick={() => setTopicFilter('all')}>All</button>
          {TOPIC_LIST.map((t) => (
            <button key={t} className={`btn-chip ${topicFilter === t ? 'active' : ''}`} onClick={() => setTopicFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="problems-results-header">
        <span className="muted small">{shown.length} problems</span>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('table')}>☰ Table</button>
          <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('grid')}>⊞ Grid</button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!problems && !error && <p className="muted">Loading problems...</p>}

      {problems && view === 'table' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="problems-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>✓</th>
                <th style={{ width: 48 }}>#</th>
                <th>Problem</th>
                <th>Companies</th>
                <th style={{ width: 100 }}>Difficulty</th>
                <th style={{ width: 90 }}>Accept %</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, idx) => {
                const { label, color } = diffLabel(p.difficulty || 800);
                return (
                  <tr key={p.slug} className="problem-row">
                    <td style={{ textAlign: 'center', fontSize: '1.05rem' }}>
                      {p.solved
                        ? <span style={{ color: 'var(--ok)', fontWeight: 800 }}>✓</span>
                        : <span style={{ color: 'var(--text-dim)' }}>○</span>}
                    </td>
                    <td className="mono muted small">{idx + 1}</td>
                    <td>
                      <div>
                        <Link to={`/problems/${p.slug}`} style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {p.title}
                        </Link>
                        <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(p.sheet || []).slice(0, 2).map((s) => (
                            <span key={s} className="badge" style={{ fontSize: '0.65rem', background: 'var(--primary)22', color: 'var(--primary)', border: '1px solid var(--primary)44' }}>{s}</span>
                          ))}
                          {(p.tags || []).slice(0, 2).map((t) => (
                            <span key={t} className="badge neutral" style={{ fontSize: '0.65rem' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(p.companies || []).slice(0, 3).map((c) => (
                          <span key={c} className="company-chip-sm">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="diff-badge" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                        {label}
                        <span className="mono" style={{ marginLeft: 4, opacity: 0.7 }}>{p.difficulty}</span>
                      </span>
                    </td>
                    <td>
                      <div className="acceptance-cell">
                        <span className="mono small">{p.acceptanceRate || 65}%</span>
                        <div className="acceptance-bar">
                          <div className="acceptance-fill" style={{ width: `${p.acceptanceRate || 65}%`, background: (p.acceptanceRate || 65) > 60 ? 'var(--ok)' : (p.acceptanceRate || 65) > 40 ? 'var(--warn)' : 'var(--bad)' }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link to={`/problems/${p.slug}`} className="btn btn-sm btn-primary">Solve →</Link>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr>
                  <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '3rem' }}>
                    No problems match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {problems && view === 'grid' && (
        <div className="problems-grid-view">
          {shown.map((p) => {
            const { label, color } = diffLabel(p.difficulty || 800);
            return (
              <Link key={p.slug} to={`/problems/${p.slug}`} className="problem-grid-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    {p.category || (p.tags || [])[0] || 'DSA'}
                  </span>
                  {p.solved && <span style={{ color: 'var(--ok)', fontWeight: 800 }}>✓</span>}
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', lineHeight: 1.4 }}>{p.title}</h3>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span className="diff-badge" style={{ background: color + '22', color, border: `1px solid ${color}44`, fontSize: '0.7rem' }}>{label} · {p.difficulty}</span>
                  {(p.companies || []).slice(0, 2).map((c) => (
                    <span key={c} className="company-chip-sm">{c}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted small">{p.acceptanceRate || 65}% accept</span>
                  <span className="btn-sm btn-primary" style={{ borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.78rem', background: 'var(--primary)', color: '#fff' }}>Solve →</span>
                </div>
              </Link>
            );
          })}
          {!shown.length && (
            <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
              No problems match your filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
