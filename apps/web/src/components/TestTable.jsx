import React, { useState, Fragment } from 'react';
import { BorderlineBar, Verdict, fmtMem, fmtMs } from './Verdict.jsx';

/** Per-test results, including the C1 statistics (runs, interval, confidence). */
export default function TestTable({ tests, total, limitMs }) {
  const [expanded, setExpanded] = useState({});

  if (!tests || !tests.length) return null;
  const anyBorderline = tests.some((t) => t.borderline);
  const passedCount = tests.filter((t) => t.verdict === 'AC').length;

  const toggle = (ord) => {
    setExpanded((prev) => ({ ...prev, [ord]: !prev[ord] }));
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Test Results ({passedCount} of {tests.length} passed{total && total > tests.length ? `, ${total} total` : ''})
        </span>
        {anyBorderline && (
          <span className="badge TLE" style={{ fontSize: '0.74rem' }}>
            C1 Noise Compensation Active
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <table className="test-breakdown-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '44px', textAlign: 'center' }}>#</th>
              <th style={{ width: '130px', textAlign: 'left' }}>Test</th>
              <th style={{ width: '150px', textAlign: 'left' }}>Verdict</th>
              <th style={{ width: '130px', textAlign: 'left' }}>CPU Time</th>
              <th style={{ width: '180px', textAlign: 'left' }}>95% Bootstrap CI</th>
              <th style={{ width: '140px', textAlign: 'center' }}>Confidence</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Memory</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const isOpen = !!expanded[t.ordinal];
              const hasRuns = t.runs && t.runs.length > 1;
              return (
                <Fragment key={t.ordinal}>
                  <tr
                    onClick={() => hasRuns && toggle(t.ordinal)}
                    style={{
                      cursor: hasRuns ? 'pointer' : 'default',
                      background: isOpen ? 'var(--surface-elevated)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      {hasRuns ? (
                        <span style={{ color: 'var(--primary)', cursor: 'pointer' }}>{isOpen ? '▼' : '▶'}</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', opacity: 0.6 }}>•</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <span className="mono" style={{ fontWeight: 600 }}>#{t.ordinal}</span>
                      {t.isSample && (
                        <span className="badge neutral small" style={{ marginLeft: 6, fontSize: '0.7rem', padding: '0.12rem 0.45rem' }}>
                          sample
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <Verdict verdict={t.verdict} short />
                    </td>
                    <td className="mono" style={{ textAlign: 'left', fontWeight: 500 }}>
                      {fmtMs(t.timeMs)}
                    </td>
                    <td className="mono" style={{ textAlign: 'left', color: t.borderline ? 'var(--warn)' : 'var(--text-dim)' }}>
                      {t.borderline && t.ciLow != null ? `${fmtMs(t.ciLow)} – ${fmtMs(t.ciHigh)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {t.borderline ? (
                        <span className="badge TLE" title={`${t.runs.length} runs: ${t.runs.map((r) => Math.round(r)).join(', ')} ms`}>
                          borderline, {Math.round((t.confidence ?? 0) * 100)}%
                        </span>
                      ) : (
                        <span className="badge neutral" style={{ fontSize: '0.74rem' }}>clear</span>
                      )}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {fmtMem(t.memKb)}
                    </td>
                  </tr>

                  {isOpen && hasRuns && (
                    <tr style={{ background: 'var(--surface-elevated)' }}>
                      <td colSpan="7" style={{ padding: '0.85rem 1.25rem', borderTop: 'none' }}>
                        <div style={{ maxWidth: 540, background: 'var(--bg)', padding: '0.85rem 1.1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            C1 Adaptive Calibration ({t.runs.length} Sandbox Runs)
                          </div>
                          <div className="mono small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                            Raw execution timings: {t.runs.map((r) => `${r}ms`).join(', ')}
                          </div>
                          {t.borderline && (
                            <BorderlineBar ciLow={t.ciLow} ciHigh={t.ciHigh} median={t.timeMs} limitMs={limitMs || 1000} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {total && tests.length < total && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            marginTop: '0.75rem',
            padding: '0.65rem 0.95rem',
            borderRadius: '8px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem' }}>ℹ</span>
          <span>Judging stopped at the first failing test ({tests.length} of {total} total suite tests executed).</span>
        </div>
      )}

      {anyBorderline && (
        <div className="alert warn" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>
          <div>
            <strong>C1 Noise-Aware Verdicts Applied:</strong> The CPU time fell within the borderline threshold (0.8x to 1.3x limit),
            so EvalX executed multiple runs and computed a bootstrap 95% confidence interval on the speed-normalized median, eliminating cloud jitter false-positives!
          </div>
        </div>
      )}
    </div>
  );
}
