import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function AuthPromptModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Never show if user is authenticated or already on auth screens
    if (user || location.pathname === '/login' || location.pathname === '/register') {
      setOpen(false);
      return;
    }

    // Check if dismissed in this browser session
    const dismissed = sessionStorage.getItem('evalx_auth_prompt_dismissed');
    if (dismissed) return;

    // Trigger pop-up after 6 seconds (between 5-8 seconds as requested)
    const timer = setTimeout(() => {
      setOpen(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [user, location.pathname]);

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem('evalx_auth_prompt_dismissed', '1');
  };

  if (!open || user) return null;

  return (
    <div className="auth-modal-backdrop" onClick={handleDismiss} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="auth-modal-close"
          onClick={handleDismiss}
          aria-label="Close dialog"
        >
          ✕
        </button>

        <div className="auth-modal-icon-wrap">
          <div className="auth-modal-icon">⚡</div>
        </div>

        <div className="auth-modal-badge">Developer Access</div>
        <h2 className="auth-modal-title">Join EvalX to Start Coding</h2>
        <p className="auth-modal-desc">
          Sign up or log in to unlock our full problem-solving workspace, run code with our hardened Docker sandbox, and compete in live contests.
        </p>

        <div className="auth-modal-perks">
          <div className="auth-modal-perk">
            <span className="auth-modal-perk-icon">💻</span>
            <div>
              <strong>Monaco Code Editor:</strong> Full C++, Python, Java & JS support with custom test runner.
            </div>
          </div>
          <div className="auth-modal-perk">
            <span className="auth-modal-perk-icon">🎯</span>
            <div>
              <strong>500+ Curated Problems:</strong> Tagged by Google, Meta, Amazon, Blind 75 & Striver SDE.
            </div>
          </div>
          <div className="auth-modal-perk">
            <span className="auth-modal-perk-icon">🛡️</span>
            <div>
              <strong>Noise-Aware Judging:</strong> Accurate execution timing with 95% confidence intervals.
            </div>
          </div>
        </div>

        <div className="auth-modal-actions">
          <Link
            to="/register"
            className="btn btn-primary auth-modal-btn"
            onClick={handleDismiss}
          >
            Create Free Account
          </Link>
          <Link
            to="/login"
            className="btn btn-ghost auth-modal-btn"
            onClick={handleDismiss}
          >
            Sign In
          </Link>
        </div>

        <button
          type="button"
          className="auth-modal-dismiss-link"
          onClick={handleDismiss}
        >
          Explore catalog first
        </button>
      </div>
    </div>
  );
}

