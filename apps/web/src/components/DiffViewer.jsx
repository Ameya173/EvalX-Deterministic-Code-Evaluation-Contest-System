export default function DiffViewer({ expected = '', actual = '' }) {
  const expLines = String(expected || '').trimEnd().split('\n');
  const actLines = String(actual || '').trimEnd().split('\n');
  const maxLines = Math.max(expLines.length, actLines.length);

  const rows = [];
  for (let i = 0; i < maxLines; i++) {
    const e = expLines[i] !== undefined ? expLines[i] : null;
    const a = actLines[i] !== undefined ? actLines[i] : null;
    const match = e === a;
    rows.push({ line: i + 1, expected: e, actual: a, match });
  }

  const hasDifference = rows.some((r) => !r.match);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Output Comparison {hasDifference ? <span style={{ color: 'var(--bad)' }}>(Differences Detected)</span> : <span style={{ color: 'var(--ok)' }}>(Matches Expected)</span>}
        </span>
      </div>
      <div className="diff-container">
        <div className="diff-box">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Expected Output</div>
          <table style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <tbody>
              {rows.map((r) => (
                <tr key={`exp-${r.line}`} className={r.match ? '' : 'diff-match'}>
                  <td style={{ width: 30, color: 'var(--text-dim)', userSelect: 'none', border: 'none', padding: '2px 6px' }}>{r.line}</td>
                  <td style={{ border: 'none', padding: '2px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {r.expected !== null ? r.expected : <span className="muted small">[EOF]</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="diff-box">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Your Output</div>
          <table style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <tbody>
              {rows.map((r) => (
                <tr key={`act-${r.line}`} className={r.match ? '' : 'diff-mismatch'}>
                  <td style={{ width: 30, color: 'var(--text-dim)', userSelect: 'none', border: 'none', padding: '2px 6px' }}>{r.line}</td>
                  <td style={{ border: 'none', padding: '2px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {r.actual !== null ? r.actual : <span className="muted small">[EOF]</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
