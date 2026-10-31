import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login({ mode }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', handle: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register(form.handle, form.email, form.password);
      else await login(form.login, form.password);
      nav(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError([err.message, ...(err.details || [])].join(' | '));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '4rem auto', padding: '0 1rem' }}>
      <div className="card highlight" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.4rem',
              fontWeight: 800,
              margin: '0 auto 0.75rem',
              boxShadow: '0 0 16px var(--primary-glow)',
            }}
          >
            ⚡
          </div>
          <h1 style={{ margin: 0, fontSize: '1.65rem' }}>
            {isRegister ? 'Join EvalX' : 'Welcome Back'}
          </h1>
          <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
            {isRegister
              ? 'Create a developer account to solve challenges and compete'
              : 'Sign in to access your coding studio and contests'}
          </p>
        </div>

        <form onSubmit={submit}>
          {isRegister ? (
            <>
              <label>Handle / Username</label>
              <input
                value={form.handle}
                onChange={set('handle')}
                autoComplete="username"
                placeholder="e.g. tourist_algo"
                required
              />

              <label>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                placeholder="alex@domain.com"
                required
              />
            </>
          ) : (
            <>
              <label>Handle or Email</label>
              <input
                value={form.login}
                onChange={set('login')}
                autoComplete="username"
                placeholder="admin or handle"
                required
              />
            </>
          )}

          <label>
            Password {isRegister && <span className="small muted">(min 8 characters)</span>}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            required
          />

          {error && <div className="alert error" style={{ marginTop: '0.85rem' }}>{error}</div>}

          <div style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }} disabled={busy}>
              {busy ? 'Verifying credentials...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        <p className="small muted" style={{ textAlign: 'center', marginTop: '1.25rem', marginBottom: 0 }}>
          {isRegister ? (
            <>Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link></>
          ) : (
            <>Don't have an account yet? <Link to="/register" style={{ fontWeight: 600 }}>Sign up</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
