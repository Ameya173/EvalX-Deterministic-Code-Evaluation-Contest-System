import { Link } from 'react-router-dom';

export default function InterviewerModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🎯</span>
          <h2 style={{ margin: 0 }}>EvalX: Engineering &amp; Research Highlights</h2>
        </div>
        <p className="muted" style={{ marginTop: '0.2rem' }}>
          Welcome, Interviewer! Here is a concise architectural breakdown of the key innovations, systems hardening, and mathematical models running in EvalX.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', margin: '1.5rem 0' }}>
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <span>🔬 C1: Noise-Aware Verdicts</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Standard online judges suffer from 10-30% false TLEs due to noisy cloud CPU contention. EvalX continuously calibrates CPU speed via an in-container canary program and computes a <strong>bootstrap 95% confidence interval</strong> on borderline tests.
            </p>
          </div>

          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warn)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <span>⏱ C2: Complexity-Explained TLE</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Instead of an uninformative "Time Limit Exceeded", EvalX empirically benchmarks the submission across geometric input sizes, fits log-log linear regressions ($\log T = \log a + b \log n$), and tells the user whether their algorithm scales as $O(n^2)$ vs expected $O(n \log n)$.
            </p>
          </div>

          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--ok)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <span>🧬 C3: Mutation Test Suite Scoring</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Problem setters can mutation-test their own testsuites: EvalX synthesizes mutants of the reference solution (AOR, ROR, LCR operators) and uses random stress inputs to detect missed bugs and propose new testcases automatically.
            </p>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            Hardened Docker Sandbox Security Stack (Defense-in-Depth)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span className="badge neutral">✓ Ephemeral Containers</span>
            <span className="badge neutral">✓ NetworkDisabled: true</span>
            <span className="badge neutral">✓ ReadonlyRootfs: true</span>
            <span className="badge neutral">✓ CapDrop: ALL</span>
            <span className="badge neutral">✓ User: 65534 (nobody)</span>
            <span className="badge neutral">✓ Tmpfs nosuid, 256MB</span>
            <span className="badge neutral">✓ C Runner RLIMIT_CPU & RLIMIT_AS</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn" onClick={onClose}>Close</button>
          <Link to="/architecture" className="btn btn-primary" onClick={onClose}>
            Explore Full Architecture & Interactive Simulators &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
