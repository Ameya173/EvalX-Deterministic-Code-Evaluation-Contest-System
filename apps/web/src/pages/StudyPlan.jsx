import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const TRACKS = [
  {
    id: 'blind75',
    name: 'Blind 75',
    tagline: 'The gold-standard curated 75 questions to crack FAANG & top tech rounds',
    color: '#6366f1',
    badge: 'Essential',
    totalTarget: 75,
    filterSheet: 'Blind 75',
  },
  {
    id: 'neetcode150',
    name: 'NeetCode 150',
    tagline: 'Comprehensive 18-topic roadmap covering all recurring algorithmic patterns',
    color: '#8b5cf6',
    badge: 'Popular',
    totalTarget: 150,
    filterSheet: 'NeetCode 150',
  },
  {
    id: 'striver-sde',
    name: 'Striver SDE Sheet',
    tagline: 'End-to-end coding interview roadmap trusted by over 1,000,000 engineers',
    color: '#ec4899',
    badge: 'Comprehensive',
    totalTarget: 180,
    filterSheet: 'Striver SDE',
  },
  {
    id: 'top500',
    name: 'Top 500 Mastery',
    tagline: 'The ultimate DSA compendium spanning Easy to International Collegiate level',
    color: '#f59e0b',
    badge: 'Complete',
    totalTarget: 500,
    filterSheet: 'Top 500 Mastery',
  },
  {
    id: 'dp-intensive',
    name: 'DP Deep Dive',
    tagline: 'Master 1D, 2D, Knapsack, Trees, and Bitmask Dynamic Programming',
    color: '#10b981',
    badge: 'Specialized',
    totalTarget: 40,
    filterCategory: 'Dynamic Programming',
  },
  {
    id: 'graphs-trees',
    name: 'Graphs & Trees Blueprint',
    tagline: 'BFS, DFS, Dijkstra, Union-Find, Segment Trees, and Topological Sort',
    color: '#06b6d4',
    badge: 'High Impact',
    totalTarget: 45,
    filterCategory: 'Trees,Graphs',
  },
];

function diffLabel(d) {
  if (d <= 1000) return { label: 'Easy', color: 'var(--ok)' };
  if (d <= 1300) return { label: 'Medium', color: 'var(--warn)' };
  if (d <= 1600) return { label: 'Hard', color: '#f97316' };
  return { label: 'Expert', color: 'var(--bad)' };
}

export default function StudyPlan() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTrack = searchParams.get('track') || 'blind75';
  const [activeTrackId, setActiveTrackId] = useState(initialTrack);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Completed tracking via localStorage
  const [localChecked, setLocalChecked] = useState(() => {
    try {
      const saved = localStorage.getItem('jb_study_completed');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCheck = (slug) => {
    setLocalChecked((prev) => {
      const next = { ...prev, [slug]: !prev[slug] };
      localStorage.setItem('jb_study_completed', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    setLoading(true);
    api.get('/problems')
      .then((d) => {
        setProblems(d.problems || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeTrack = useMemo(
    () => TRACKS.find((t) => t.id === activeTrackId) || TRACKS[0],
    [activeTrackId]
  );

  // Filter problems for active track
  const trackProblems = useMemo(() => {
    if (!problems.length) return [];
    let list = problems.filter((p) => {
      if (activeTrack.filterSheet) {
        return (p.sheet || []).includes(activeTrack.filterSheet);
      }
      if (activeTrack.filterCategory) {
        const cats = activeTrack.filterCategory.split(',');
        return cats.includes(p.category) || (p.tags || []).some((t) => cats.includes(t));
      }
      return true;
    });

    // Enforce exact curated target problem count
    if (activeTrack.totalTarget && list.length > activeTrack.totalTarget) {
      list = list.slice(0, activeTrack.totalTarget);
    }
    return list;
  }, [problems, activeTrack]);

  // Unique topics in track
  const trackTopics = useMemo(() => {
    const set = new Set();
    trackProblems.forEach((p) => {
      if (p.category) set.add(p.category);
      (p.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [trackProblems]);

  // Computed solved status: either server solved OR user checked locally
  const isProblemCompleted = (p) => !!(p.solved || localChecked[p.slug]);

  // Filtered view
  const filteredProblems = useMemo(() => {
    return trackProblems.filter((p) => {
      const isDone = isProblemCompleted(p);
      if (statusFilter === 'completed' && !isDone) return false;
      if (statusFilter === 'remaining' && isDone) return false;

      const d = p.difficulty || 800;
      if (diffFilter === 'easy' && d > 1000) return false;
      if (diffFilter === 'medium' && (d <= 1000 || d > 1300)) return false;
      if (diffFilter === 'hard' && d <= 1300) return false;

      if (topicFilter !== 'all') {
        const matchesCat = p.category === topicFilter;
        const matchesTag = (p.tags || []).includes(topicFilter);
        if (!matchesCat && !matchesTag) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        const matchesCo = (p.companies || []).some((c) => c.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTags && !matchesCo) return false;
      }

      return true;
    });
  }, [trackProblems, statusFilter, diffFilter, topicFilter, searchQuery, localChecked]);

  // Overall statistics for active track
  const stats = useMemo(() => {
    const total = trackProblems.length;
    const completed = trackProblems.filter(isProblemCompleted).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const easy = trackProblems.filter((p) => (p.difficulty || 800) <= 1000).length;
    const medium = trackProblems.filter((p) => {
      const d = p.difficulty || 800;
      return d > 1000 && d <= 1300;
    }).length;
    const hard = trackProblems.filter((p) => (p.difficulty || 800) > 1300).length;

    return { total, completed, percent, easy, medium, hard };
  }, [trackProblems, localChecked]);

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '780px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.8rem',
              borderRadius: '999px',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.8rem',
            }}
          >
            <span>Targeted Roadmaps</span>
            <span>-</span>
            <span>Structured DSA Mastery</span>
          </div>

          <h1 style={{ fontSize: '2.4rem', margin: '0 0 0.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Curated Study Plans
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
            Step-by-step interview tracks designed by FAANG engineers. Track your completion, focus on high-yield patterns, and practice in our isolated Docker judge.
          </p>
        </div>
      </div>

      {/* Track Tabs */}
      <div className="study-tracks-grid">
        {TRACKS.map((t) => {
          const isActive = t.id === activeTrackId;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveTrackId(t.id);
                setSearchParams({ track: t.id });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveTrackId(t.id);
                  setSearchParams({ track: t.id });
                }
              }}
              className={`study-track-card${isActive ? ' active' : ''}`}
              style={{ '--tc': t.color }}
            >
              <div className="study-track-header">
                <span className="study-track-title" style={{ color: isActive ? t.color : 'var(--text)' }}>
                  {t.name}
                </span>
                <span
                  className="study-track-badge"
                  style={{
                    background: `${t.color}20`,
                    color: t.color,
                    border: `1px solid ${t.color}40`,
                  }}
                >
                  {t.badge}
                </span>
              </div>
              <p className="study-track-tagline">
                {t.tagline}
              </p>
              <div className="study-track-footer">
                <span>Curated Track</span>
                <span style={{ color: isActive ? t.color : 'var(--text)', fontWeight: 700 }}>
                  Target: {t.totalTarget} Problems
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Track Progress Card */}
      <div
        className="card"
        style={{
          padding: '1.6rem 2rem',
          marginBottom: '2rem',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{activeTrack.name} Progress</h2>
              <span
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                {stats.completed} / {stats.total} Solved ({stats.percent}%)
              </span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {activeTrack.tagline}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--ok)' }}>{stats.easy}</div>
              <div className="muted small">Easy</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--warn)' }}>{stats.medium}</div>
              <div className="muted small">Medium</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f97316' }}>{stats.hard}</div>
              <div className="muted small">Hard</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: '10px',
            borderRadius: '999px',
            background: 'var(--surface-elevated)',
            overflow: 'hidden',
            marginTop: '1.2rem',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${stats.percent}%`,
              background: `linear-gradient(90deg, ${activeTrack.color} 0%, #38bdf8 100%)`,
              borderRadius: '999px',
              transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Filter Controls */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1.5rem',
          background: 'var(--surface)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search by problem name, company, tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '0.55rem 0.9rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            fontSize: '0.88rem',
          }}
        />

        {/* Topic Filter */}
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            fontSize: '0.88rem',
          }}
        >
          <option value="all">All Topics ({trackTopics.length})</option>
          {trackTopics.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>

        {/* Difficulty Filter */}
        <select
          value={diffFilter}
          onChange={(e) => setDiffFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            fontSize: '0.88rem',
          }}
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy (&le; 1000)</option>
          <option value="medium">Medium (1001 - 1300)</option>
          <option value="hard">Hard (&gt; 1300)</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            fontSize: '0.88rem',
          }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="remaining">Remaining</option>
        </select>

        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Showing <strong>{filteredProblems.length}</strong> of {trackProblems.length}
        </span>
      </div>

      {/* Problem Checklist Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          Loading roadmap problems...
        </div>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : filteredProblems.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            color: 'var(--text-dim)',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem' }}>No problems match your selected filters.</p>
          <button
            className="btn btn-sm"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              setSearchQuery('');
              setTopicFilter('all');
              setDiffFilter('all');
              setStatusFilter('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'center' }}>Done</th>
                <th style={{ width: 60, textAlign: 'center' }}>#</th>
                <th>Problem Title</th>
                <th style={{ width: 140 }}>Category</th>
                <th style={{ width: 180 }}>Company Tags</th>
                <th style={{ width: 110, textAlign: 'center' }}>Difficulty</th>
                <th style={{ width: 100, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map((p, idx) => {
                const isDone = isProblemCompleted(p);
                const { label, color } = diffLabel(p.difficulty || 800);
                return (
                  <tr
                    key={p.slug}
                    style={{
                      background: isDone ? 'rgba(34, 197, 94, 0.03)' : undefined,
                      transition: 'background 0.2s',
                    }}
                  >
                    {/* Done Checkbox */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleCheck(p.slug)}
                        title={isDone ? 'Mark as unsolved' : 'Mark as solved'}
                        style={{ cursor: 'pointer', width: 18, height: 18, accentColor: 'var(--ok)' }}
                      />
                    </td>

                    {/* Number */}
                    <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </td>

                    {/* Title */}
                    <td>
                      <Link
                        to={`/problems/${p.slug}`}
                        style={{
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          textDecoration: isDone ? 'line-through' : 'none',
                          color: isDone ? 'var(--text-dim)' : 'var(--text)',
                        }}
                      >
                        {p.title}
                      </Link>
                    </td>

                    {/* Category */}
                    <td>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-dim)',
                        }}
                      >
                        {p.category || (p.tags && p.tags[0]) || 'DSA'}
                      </span>
                    </td>

                    {/* Company Tags */}
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {(p.companies || []).slice(0, 3).map((co) => (
                          <span
                            key={co}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: 4,
                              background: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                            }}
                          >
                            {co}
                          </span>
                        ))}
                        {(!p.companies || p.companies.length === 0) && (
                          <span className="muted small">-</span>
                        )}
                      </div>
                    </td>

                    {/* Difficulty Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          background: `${color}18`,
                          color,
                          border: `1px solid ${color}40`,
                        }}
                      >
                        {label} ({p.difficulty || 800})
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/problems/${p.slug}`}
                        className="btn btn-sm"
                        style={{
                          background: isDone ? 'var(--surface-elevated)' : 'var(--primary)',
                          color: isDone ? 'var(--text)' : '#fff',
                          border: isDone ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {isDone ? 'Review' : 'Solve ->'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
