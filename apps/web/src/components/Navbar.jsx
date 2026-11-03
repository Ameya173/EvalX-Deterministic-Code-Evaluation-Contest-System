import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Navbar() {
  const { user, logout, isSetter, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('jb_theme') || 'dark');
  const [telemetry, setTelemetry] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jb_theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchTelemetry = () => {
      api.get('/telemetry').then(setTelemetry).catch(() => {});
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const isHealthy = telemetry?.status === 'healthy';
  const speedFactor = telemetry?.workers?.[0]?.speedFactor ?? 1.0;

  return (
    <nav className="nav">
      <div className="nav-container">
        {/* Left: Brand + Navlinks */}
        <div className="nav-left">
          <Link to="/" className="brand-wrap">
            <div className="brand-icon">⚡</div>
            <span className="brand-text">EvalX</span>
          </Link>

          <div className={`nav-links${menuOpen ? ' open' : ''}`}>
            <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
            <NavLink to="/problems" onClick={() => setMenuOpen(false)}>Problems</NavLink>
            <NavLink to="/contests" onClick={() => setMenuOpen(false)}>Contests</NavLink>
            <NavLink to="/study-plan" onClick={() => setMenuOpen(false)}>Study Plan</NavLink>
            {user && <NavLink to="/submissions" onClick={() => setMenuOpen(false)}>Submissions</NavLink>}
            {isSetter && <NavLink to="/manage" onClick={() => setMenuOpen(false)}>Manage</NavLink>}
            {isAdmin && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Admin</NavLink>}
          </div>
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {/* Live Status Pill */}
          <div
            className="telemetry-chip"
            title={`Worker at ${speedFactor}x speed — ${isHealthy ? 'All systems healthy' : 'Degraded'}`}
          >
            <span className="pulse-dot" style={{ background: isHealthy ? 'var(--ok)' : 'var(--warn)' }} />
            <span>{isHealthy ? `${speedFactor}x` : 'Offline'}</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Dark theme (click to switch to Light)' : 'Light theme (click to switch to Dark)'}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          {/* Auth State */}
          {user ? (
            <div className="row" style={{ gap: '0.6rem' }}>
              <Link
                to={`/users/${user.handle}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 999,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {user.handle[0].toUpperCase()}
                </div>
                <span>{user.handle}</span>
                {isAdmin && <span className="badge neutral" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>Admin</span>}
              </Link>
              <button className="btn-sm btn-ghost" onClick={logout} title="Sign out of account">
                Logout
              </button>
            </div>
          ) : (
            <div className="row" style={{ gap: '0.5rem' }}>
              <Link to="/login" className="btn btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Sign up</Link>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen((x) => !x)}
            aria-label="Open menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  );
}
