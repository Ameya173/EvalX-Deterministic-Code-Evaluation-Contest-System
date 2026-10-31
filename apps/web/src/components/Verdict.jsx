const LABELS = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  MLE: 'Memory Limit Exceeded',
  RE: 'Runtime Error',
  OLE: 'Output Limit Exceeded',
  CE: 'Compilation Error',
  SE: 'System Error',
};

const ICONS = {
  AC: '✓',
  WA: '✗',
  TLE: '⏱',
  MLE: '💾',
  RE: '⚡',
  OLE: '📄',
  CE: '⚙',
  SE: '⚠',
};

export const verdictLabel = (v) => LABELS[v] || v;

export function Verdict({ verdict, status, short }) {
  if (!verdict) {
    const isJudging = status === 'judging';
    return (
      <span className="badge pending" title={isJudging ? 'Submission is running in sandbox container' : 'Queued in BullMQ worker queue'}>
        <span className="pulse-dot" style={{ width: 6, height: 6 }} />
        {isJudging ? 'Judging...' : 'In queue'}
      </span>
    );
  }
  const icon = ICONS[verdict] || '•';
  return (
    <span className={`badge ${verdict}`} title={`${verdictLabel(verdict)} (${verdict})`}>
      <span style={{ fontWeight: 800 }}>{icon}</span> {short ? verdict : verdictLabel(verdict)}
    </span>
  );
}

/** Visual 95% Confidence Interval Bar vs CPU Time Limit (C1) */
export function BorderlineBar({ ciLow, ciHigh, median, limitMs }) {
  if (ciLow == null || ciHigh == null || !limitMs) return null;
  const maxScale = Math.max(limitMs * 1.3, ciHigh * 1.1);
  const leftPct = Math.max(0, Math.min(100, (ciLow / maxScale) * 100));
  const rightPct = Math.max(0, Math.min(100, (ciHigh / maxScale) * 100));
  const widthPct = Math.max(2, rightPct - leftPct);
  const limitPct = Math.min(100, (limitMs / maxScale) * 100);
  const medianPct = Math.max(0, Math.min(100, (median / maxScale) * 100));

  return (
    <div style={{ margin: '0.4rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 2 }}>
        <span>0 ms</span>
        <span style={{ color: 'var(--bad)', fontWeight: 600 }}>Limit: {fmtMs(limitMs)}</span>
        <span>{fmtMs(maxScale)}</span>
      </div>
      <div className="ci-meter" title={`95% Bootstrap CI: ${fmtMs(ciLow)} to ${fmtMs(ciHigh)} | Normalized Median: ${fmtMs(median)}`}>
        <div className="ci-bar" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${medianPct}%`, width: 2, background: 'var(--text)', zIndex: 3 }} title={`Median: ${fmtMs(median)}`} />
        <div className="ci-limit-line" style={{ left: `${limitPct}%` }} title={`Time limit line (${fmtMs(limitMs)})`} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>CI: [{fmtMs(ciLow)} — {fmtMs(ciHigh)}]</span>
        <span>Median: {fmtMs(median)}</span>
      </div>
    </div>
  );
}

export const fmtMs = (v) => (v == null ? '-' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v * 10) / 10} ms`);
export const fmtMem = (kb) => (kb == null ? '-' : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
export const fmtDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
