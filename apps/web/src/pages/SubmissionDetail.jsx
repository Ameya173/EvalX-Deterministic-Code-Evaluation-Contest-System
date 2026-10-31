import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket.js';
import { Verdict, fmtDate, fmtMem, fmtMs } from '../components/Verdict.jsx';
import TestTable from '../components/TestTable.jsx';
import ComplexityCard from '../components/ComplexityCard.jsx';

const MONACO = { cpp: 'cpp', python: 'python', java: 'java', javascript: 'javascript' };

export default function SubmissionDetail() {
  const { id } = useParams();
  const { token, isAdmin } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.get(`/submissions/${id}`).then((d) => setS(d.submission)).catch((e) => setError(e.message)), [id]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent(token, 'submission:update', (evt) => { if (evt.submissionId === id) load(); });

  useEffect(() => {
    if (!s || s.status === 'done') return undefined;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [s?.status, load]);

  async function rejudge() {
    try {
      await api.post(`/admin/submissions/${id}/rejudge`);
      setMsg('Submission queued for rejudging in the worker cluster.');
      load();
    } catch (e) {
      setMsg(`Rejudge failed: ${e.message}`);
    }
  }

  const copySource = () => {
    if (!s?.source) return;
    navigator.clipboard.writeText(s.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!s) return <div className="container muted">Loading submission #{id}...</div>;

  return (
    <div className="container">
      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className="row" style={{ gap: '0.65rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Submission #{s.id.slice(-6)}</h1>
            <Verdict verdict={s.verdict} status={s.status} />
          </div>
          <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
            Submitted by <strong>{s.handle}</strong> for <Link to={`/problems/${s.problemSlug}`}>{s.problemSlug}</Link> on {fmtDate(s.createdAt)}
          </p>
        </div>

        <div className="row" style={{ gap: '0.6rem' }}>
          {isAdmin && (
            <button className="btn btn-sm" onClick={rejudge} title="Trigger worker re-execution">
              ↻ Rejudge
            </button>
          )}
          <Link to={`/problems/${s.problemSlug}`} className="btn btn-sm btn-primary">
            Open in Workspace &rarr;
          </Link>
        </div>
      </div>

      {msg && <div className="alert ok">{msg}</div>}

      {/* Metrics Banner */}
      <div className="card highlight" style={{ marginBottom: '1.25rem' }}>
        <div className="grid4">
          <div>
            <div className="small muted">Verdict</div>
            <div style={{ marginTop: '0.2rem' }}><Verdict verdict={s.verdict} status={s.status} /></div>
          </div>
          <div>
            <div className="small muted">Peak CPU Time</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{fmtMs(s.maxTimeMs)}</div>
          </div>
          <div>
            <div className="small muted">Peak Memory</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{fmtMem(s.maxMemKb)}</div>
          </div>
          <div>
            <div className="small muted">Canary Calibration Factor</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent)' }}>
              {s.speedFactor ? `${s.speedFactor}x` : '—'}
            </div>
          </div>
        </div>

        {s.speedFactor != null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              margin: '0.85rem 0 0',
              borderTop: '1px solid var(--border)',
              paddingTop: '0.65rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              i
            </span>
            <span>
              <strong>C1 Calibration Factor:</strong> {s.speedFactor} (1.00 = baseline quiet host; &lt;1.00 indicates CPU contention was normalized to ensure deterministic verdicts). Policy: <code style={{ padding: '0.1rem 0.35rem', background: 'var(--surface-elevated)', borderRadius: 4 }}>{s.policy || 'adaptive'}</code>.
            </span>
          </div>
        )}
      </div>

      {s.verdict === 'CE' && (
        <div className="card" style={{ border: '1px solid var(--bad-border)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--bad)' }}>Compilation Error Log</h3>
          <pre style={{ color: 'var(--bad)', margin: 0 }}>{s.compileLog}</pre>
        </div>
      )}

      {s.verdict === 'SE' && (
        <div className="alert warn">
          <strong>System Error:</strong> {s.compileLog || 'The judge had an internal sandbox issue. Please rejudge or check worker health.'}
        </div>
      )}

      {/* Test Results Table */}
      {s.tests && s.tests.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Detailed Test Breakdown</h2>
          <TestTable tests={s.tests} total={s.testsTotal} />
        </div>
      )}

      {/* C2 Complexity Card */}
      {s.verdict === 'TLE' && s.analysisStatus && s.analysisStatus !== 'none' && (
        <ComplexityCard key={s.id + s.analysisStatus} submissionId={s.id} initialStatus={s.analysisStatus} />
      )}

      {/* Source Code Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Submitted Code ({s.language})</h2>
          <button className="btn btn-sm btn-ghost" onClick={copySource}>
            {copied ? '✓ Copied!' : '📋 Copy Source'}
          </button>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <Editor
            height="360px"
            language={MONACO[s.language] || 'cpp'}
            theme="vs-dark"
            value={s.source}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>
    </div>
  );
}
