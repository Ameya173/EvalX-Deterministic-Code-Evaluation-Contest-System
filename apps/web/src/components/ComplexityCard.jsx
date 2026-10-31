import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtMs } from './Verdict.jsx';

const log2 = (n) => Math.log2(Math.max(2, n));
const FN = {
  '1': () => 1,
  'log n': log2,
  n: (n) => n,
  'n log n': (n) => n * log2(n),
  'n^2': (n) => n * n,
  'n^3': (n) => n * n * n,
};

function LogLogChart({ rows, fit }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  const W = 620, H = 320, L = 64, R = 24, T = 20, B = 48;
  const sub = rows.filter((r) => r.subMs != null && r.subMs > 0);
  const ref = rows.filter((r) => r.refMs != null && r.refMs > 0);
  const all = [...sub.map((r) => [r.n, r.subMs]), ...ref.map((r) => [r.n, r.refMs])];
  if (all.length < 2) return null;

  const xs = all.map((p) => Math.log10(p[0]));
  const ys = all.map((p) => Math.log10(p[1]));
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.max(Math.ceil(Math.max(...ys)), y0 + 1);

  const sx = (v) => L + ((Math.log10(v) - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (v) => H - B - ((Math.log10(Math.max(v, 1e-9)) - y0) / (y1 - y0 || 1)) * (H - T - B);

  const xt = []; for (let e = x0; e <= x1; e++) xt.push(e);
  const yt = []; for (let e = y0; e <= y1; e++) yt.push(e);

  let curve = '';
  if (fit && fit.best && FN[fit.best.key]) {
    const f = FN[fit.best.key];
    const lo = Math.pow(10, x0), hi = Math.pow(10, x1);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const n = lo * Math.pow(hi / lo, i / 40);
      const y = fit.best.a * f(n);
      if (y > 0) pts.push(`${sx(n).toFixed(1)},${Math.min(H - B, Math.max(T, sy(y))).toFixed(1)}`);
    }
    curve = pts.join(' ');
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 660, margin: '1rem 0' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', overflow: 'visible', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}
        role="img"
        aria-label="Runtime versus input size on log-log axes"
      >
        {/* Grid lines */}
        {xt.map((e) => (
          <g key={`x${e}`}>
            <line x1={sx(Math.pow(10, e))} x2={sx(Math.pow(10, e))} y1={T} y2={H - B} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={sx(Math.pow(10, e))} y={H - B + 20} fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle" fill="var(--text-dim)">
              10^{e}
            </text>
          </g>
        ))}
        {yt.map((e) => (
          <g key={`y${e}`}>
            <line x1={L} x2={W - R} y1={sy(Math.pow(10, e))} y2={sy(Math.pow(10, e))} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={L - 8} y={sy(Math.pow(10, e)) + 4} fontSize="11" fontFamily="var(--font-mono)" textAnchor="end" fill="var(--text-dim)">
              10^{e}
            </text>
          </g>
        ))}

        <text x={(L + W - R) / 2} y={H - 8} fontSize="12" fontWeight="600" textAnchor="middle" fill="var(--text-muted)">
          Input Size n (log scale)
        </text>
        <text
          x={18}
          y={(T + H - B) / 2}
          fontSize="12"
          fontWeight="600"
          textAnchor="middle"
          fill="var(--text-muted)"
          transform={`rotate(-90 18 ${(T + H - B) / 2})`}
        >
          CPU Time ms (log scale)
        </text>

        {/* Best fit regression curve */}
        {curve && <polyline points={curve} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="6 4" />}

        {/* Reference Solution Points */}
        {ref.map((r) => (
          <g
            key={`r${r.n}`}
            onMouseEnter={() => setHoverPoint({ label: 'Reference', n: r.n, ms: r.refMs, x: sx(r.n), y: sy(r.refMs) })}
            onMouseLeave={() => setHoverPoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <rect x={sx(r.n) - 4} y={sy(r.refMs) - 4} width="8" height="8" rx="2" fill="var(--ok)" />
          </g>
        ))}

        {/* User Submission Points */}
        {sub.map((r) => (
          <g
            key={`s${r.n}`}
            onMouseEnter={() => setHoverPoint({ label: 'Your Solution', n: r.n, ms: r.subMs, x: sx(r.n), y: sy(r.subMs) })}
            onMouseLeave={() => setHoverPoint(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={sx(r.n)} cy={sy(r.subMs)} r="5" fill="var(--bad)" stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoverPoint && (
        <div
          style={{
            position: 'absolute',
            left: `${(hoverPoint.x / W) * 100}%`,
            top: `${(hoverPoint.y / H) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface)',
            border: '1px solid var(--border-hover)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <strong style={{ color: hoverPoint.label === 'Reference' ? 'var(--ok)' : 'var(--bad)' }}>{hoverPoint.label}</strong>
          <div>n = {hoverPoint.n.toLocaleString()}</div>
          <div>Time = {fmtMs(hoverPoint.ms)}</div>
        </div>
      )}
    </div>
  );
}

/** C2: complexity-explained TLE feedback. Polls until the analysis finishes. */
export default function ComplexityCard({ submissionId, initialStatus }) {
  const [state, setState] = useState({ status: initialStatus, report: null, progress: 0, error: null });
  const [projectN, setProjectN] = useState(100000);

  useEffect(() => {
    let stop = false;
    let timer;
    const tick = async () => {
      try {
        const d = await api.get(`/submissions/${submissionId}/analysis`);
        if (stop) return;
        setState({ status: d.status, report: d.report, progress: d.progress, error: d.error });
        if (d.status === 'queued' || d.status === 'running') timer = setTimeout(tick, 2000);
      } catch {
        if (!stop) timer = setTimeout(tick, 4000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [submissionId]);

  const { status, report, progress, error } = state;
  if (status === 'none') return null;

  // Predict execution time for projectN using best fit
  let projectedMs = null;
  if (report?.fit?.best && FN[report.fit.best.key]) {
    projectedMs = report.fit.best.a * FN[report.fit.best.key](projectN);
  }

  return (
    <div className="card" style={{ border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, var(--surface-card) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⏱</span> C2 Complexity-Explained TLE Analysis
        </h2>
        <span className="badge TLE">Research Innovation C2</span>
      </div>

      {(status === 'queued' || status === 'running') && (
        <div style={{ margin: '1rem 0' }}>
          <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pulse-dot" />
            {status === 'queued' ? 'Waiting for available analysis worker in queue...' : 'Measuring empirical growth rate across increasing input sizes (n)...'}
          </p>
          <div className="progress"><div style={{ width: `${Math.round((progress || 0) * 100)}%` }} /></div>
        </div>
      )}

      {status === 'failed' && <div className="alert warn">The growth analysis could not run{error ? `: ${error}` : '.'}</div>}

      {status === 'done' && report && (
        <>
          <div className={`alert ${report.classification === 'asymptotic' ? 'error' : 'info'}`} style={{ marginTop: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                {report.classification === 'asymptotic' ? '⚠️ Asymptotic Complexity Mismatch' : 'ℹ️ Constant-Factor Bottleneck'}
              </div>
              <div>{report.message}</div>
            </div>
          </div>

          <LogLogChart rows={report.sizes} fit={report.fit} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.82rem', margin: '0.5rem 0 1rem' }}>
            <span><span style={{ color: 'var(--bad)', fontWeight: 800 }}>●</span> Your Solution</span>
            <span><span style={{ color: 'var(--ok)', fontWeight: 800 }}>■</span> Reference Solution</span>
            <span><span style={{ color: 'var(--accent)', fontWeight: 800 }}>- - -</span> Best Fit: {report.fit?.best ? report.fit.best.label : ''}</span>
            {report.censoredAt && (
              <span className="muted">· Capped at n = {report.censoredAt.toLocaleString()} ({fmtMs(report.capMs)})</span>
            )}
          </div>

          {/* Interactive Projected Runtime Calculator */}
          {report.fit?.best && (
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Execution Time Estimator (Based on Empirical Model)
              </div>
              <div className="row" style={{ gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ margin: 0, fontSize: '0.75rem' }}>Input Size N: {projectN.toLocaleString()}</label>
                  <input
                    type="range"
                    min="1000"
                    max="1000000"
                    step="5000"
                    value={projectN}
                    onChange={(e) => setProjectN(Number(e.target.value))}
                    style={{ padding: 0 }}
                  />
                </div>
                <div className="stat-pill" style={{ minWidth: 160 }}>
                  <span className="label">Estimated Time</span>
                  <span className="value" style={{ color: projectedMs > 1000 ? 'var(--bad)' : 'var(--ok)' }}>
                    {fmtMs(projectedMs)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <table>
              <thead><tr><th>Input Size n</th><th>Your CPU Time</th><th>Reference Solution</th></tr></thead>
              <tbody>
                {report.sizes.map((r) => (
                  <tr key={r.n}>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.n.toLocaleString()}</td>
                    <td className="mono" style={{ color: r.censored ? 'var(--bad)' : 'inherit' }}>
                      {r.censored ? `> ${fmtMs(report.capMs)} (Timed out)` : fmtMs(r.subMs)}
                    </td>
                    <td className="mono">{r.refMs != null ? fmtMs(r.refMs) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.fit?.best && (
            <p className="help" style={{ marginTop: '0.75rem' }}>
              <strong>Regression Metrics:</strong> Slope = <span className="mono">{report.fit.slope}</span>, R² = <span className="mono">{report.fit.r2}</span> ({report.fit.used} sample points). Expected complexity for this problem: <span className="badge neutral">{report.declaredLabel || 'not specified'}</span>. Machine speed factor: <span className="mono">{report.speedFactor}</span>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
