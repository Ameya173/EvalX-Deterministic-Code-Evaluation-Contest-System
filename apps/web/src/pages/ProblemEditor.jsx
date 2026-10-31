import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

const COMPLEXITIES = ['', '1', 'log n', 'n', 'n log n', 'n^2', 'n^3'];
const LANGS = { cpp: 'C++17', python: 'Python 3', java: 'Java 17', javascript: 'JavaScript' };
const LARGE = 50000;

const empty = {
  slug: '', title: '', statementMd: '', timeLimitMs: 1000, memoryMb: 256, checkerType: 'token', checkerEpsilon: 1e-6,
  visibility: 'public', tags: '', difficulty: '', declaredComplexity: '', minN: 1000, maxN: 256000,
  refLang: 'cpp', refSource: '', genSource: '', tests: [],
};

function StrengthPanel({ slug, onTestsChanged }) {
  const [report, setReport] = useState(undefined);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState({});
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => api.get(`/problems/${slug}/strength`).then((d) => setReport(d.report)).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!report || (report.status !== 'queued' && report.status !== 'running')) return undefined;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [report?.status, load]);

  async function start() {
    setError(null);
    setMsg(null);
    try {
      await api.post(`/problems/${slug}/strength`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function accept() {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    if (!ids.length) return;
    try {
      const d = await api.post(`/problems/${slug}/strength/accept`, { mutantIds: ids });
      setMsg(`Added ${d.added} new test(s). Run the analysis again to see the new score.`);
      setPicked({});
      load();
      onTestsChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  const running = report && (report.status === 'queued' || report.status === 'running');
  const d = report?.status === 'done' ? report.data : null;
  const survivors = d ? d.mutants.filter((m) => m.status === 'survived') : [];

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Test-suite strength (mutation testing)</h2>
      <p className="help">
        The judge mutates your reference solution (changes operators and constants), then checks whether your tests catch each mutant. Bugs the tests miss but
        random inputs expose are proposed as new tests. Needs a C++ or Python reference solution and a generator.
      </p>
      <div className="row">
        <button className="primary" onClick={start} disabled={running}>{running ? 'Analysing...' : 'Analyse test strength'}</button>
        {running && <div className="progress" style={{ width: 200 }}><div style={{ width: `${Math.round((report.progress || 0) * 100)}%` }} /></div>}
      </div>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}
      {report?.status === 'failed' && <div className="alert error">Analysis failed: {report.error}</div>}
      {d && (
        <>
          <h3>
            Score: {d.score == null ? 'n/a' : `${Math.round(d.score * 100)}%`}{' '}
            <span className="muted small">({d.killed} caught, {d.survived} missed, {d.equivalent} likely equivalent, {d.invalid} did not compile; {d.stressInputs} random inputs tried against {d.suiteSize} tests)</span>
          </h3>
          <table>
            <thead><tr><th></th><th>Mutant</th><th>Line</th><th>Change</th><th>Result</th></tr></thead>
            <tbody>
              {d.mutants.map((m) => (
                <tr key={m.id}>
                  <td>{m.status === 'survived' && <input type="checkbox" style={{ width: 'auto' }} checked={!!picked[m.id]} onChange={(e) => setPicked({ ...picked, [m.id]: e.target.checked })} />}</td>
                  <td>{m.id} <span className="badge neutral">{m.operator}</span></td>
                  <td>{m.line}</td>
                  <td className="mono small">{m.original} &rarr; {m.replacement}<div className="muted">{m.snippet}</div></td>
                  <td>
                    <span className={`badge ${m.status === 'killed' || m.status === 'hardened' ? 'AC' : m.status === 'survived' ? 'WA' : 'neutral'}`}>{m.status}</span>
                    {m.status === 'killed' && <span className="muted small"> by test #{m.killedBy}</span>}
                    {m.status === 'survived' && <pre>{m.distinguishingInput.slice(0, 300)}</pre>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {survivors.length > 0 && <p><button onClick={accept}>Add selected survivors as tests</button></p>}
          {survivors.length === 0 && d.score === 1 && <div className="alert ok">Every non-equivalent mutant was caught.</div>}
        </>
      )}
    </div>
  );
}

export default function ProblemEditor() {
  const { slug } = useParams();
  const isNew = slug === 'new';
  const nav = useNavigate();
  const [f, setF] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (isNew) return Promise.resolve();
    return api.get(`/problems/${slug}/manage`).then(({ problem: p, tests }) => {
      setF({
        slug: p.slug, title: p.title, statementMd: p.statementMd || '', timeLimitMs: p.timeLimitMs, memoryMb: Math.round(p.memoryKb / 1024),
        checkerType: p.checkerType, checkerEpsilon: p.checkerEpsilon, visibility: p.visibility, tags: (p.tags || []).join(', '),
        difficulty: p.difficulty ?? '', declaredComplexity: p.declaredComplexity || '', minN: p.scaling?.minN ?? 1000, maxN: p.scaling?.maxN ?? 256000,
        refLang: p.reference?.lang || 'cpp', refSource: p.reference?.source || '', genSource: p.generator?.source || '',
        tests: tests.map((t) => ({ ...t, large: t.input.length + t.output.length > LARGE })),
      });
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [slug, isNew]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });
  const setTest = (i, patch) => setF({ ...f, tests: f.tests.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const body = {
        title: f.title, statementMd: f.statementMd, timeLimitMs: Number(f.timeLimitMs), memoryKb: Math.round(Number(f.memoryMb) * 1024),
        checkerType: f.checkerType, checkerEpsilon: Number(f.checkerEpsilon), visibility: f.visibility,
        tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), declaredComplexity: f.declaredComplexity,
        scaling: { minN: Number(f.minN), maxN: Number(f.maxN) },
        tests: f.tests.map((t) => ({ input: t.input, output: t.output, isSample: !!t.isSample })),
      };
      if (f.difficulty !== '') body.difficulty = Number(f.difficulty);
      if (f.refSource.trim()) body.reference = { lang: f.refLang, source: f.refSource };
      if (f.genSource.trim()) body.generator = { lang: 'python', source: f.genSource };
      if (isNew) {
        await api.post('/problems', { ...body, slug: f.slug });
        nav(`/manage/${f.slug}`, { replace: true });
      } else {
        await api.put(`/problems/${slug}`, body);
        setSaved('Saved.');
        load();
      }
    } catch (e) {
      setError([e.message, ...(e.details || [])].join(' | '));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="container muted">Loading...</div>;
  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{isNew ? 'New problem' : `Edit: ${f.title}`}</h1>
        {!isNew && <Link to={`/problems/${slug}`}>View problem</Link>}
      </div>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert ok">{saved}</div>}

      <div className="card">
        <div className="grid2">
          <div>
            {isNew && (<><label>Slug (lowercase, digits, dashes)</label><input value={f.slug} onChange={set('slug')} placeholder="two-sum" /></>)}
            <label>Title</label><input value={f.title} onChange={set('title')} />
            <label>Statement (Markdown)</label><textarea rows="12" value={f.statementMd} onChange={set('statementMd')} />
          </div>
          <div>
            <div className="grid2">
              <div><label>Time limit (ms, for C++)</label><input type="number" value={f.timeLimitMs} onChange={set('timeLimitMs')} /></div>
              <div><label>Memory (MB)</label><input type="number" value={f.memoryMb} onChange={set('memoryMb')} /></div>
              <div><label>Output checker</label>
                <select value={f.checkerType} onChange={set('checkerType')}><option value="token">Tokens (ignore whitespace)</option><option value="exact">Exact lines</option><option value="float">Floating point</option></select></div>
              <div><label>Float tolerance</label><input type="number" step="any" value={f.checkerEpsilon} onChange={set('checkerEpsilon')} disabled={f.checkerType !== 'float'} /></div>
              <div><label>Visibility</label>
                <select value={f.visibility} onChange={set('visibility')}><option value="public">Public</option><option value="private">Private</option><option value="contest">Contest only</option></select></div>
              <div><label>Rating</label><input type="number" value={f.difficulty} onChange={set('difficulty')} /></div>
            </div>
            <label>Tags (comma separated)</label><input value={f.tags} onChange={set('tags')} />
            <label>Expected complexity of the reference solution (used to explain TLEs)</label>
            <select value={f.declaredComplexity} onChange={set('declaredComplexity')}>{COMPLEXITIES.map((c) => <option key={c} value={c}>{c ? `O(${c})` : 'not set'}</option>)}</select>
            <div className="grid2">
              <div><label>Growth analysis: smallest n</label><input type="number" value={f.minN} onChange={set('minN')} /></div>
              <div><label>Growth analysis: largest n</label><input type="number" value={f.maxN} onChange={set('maxN')} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Reference solution and generator</h2>
        <p className="help">
          The reference solution produces expected behaviour for growth comparison and mutation testing. The generator (Python) reads one line &quot;n seed&quot; from stdin and prints one valid input of size
          n. It powers both the growth analysis (large n) and the stress tests (small n).
        </p>
        <div className="grid2">
          <div>
            <label>Reference solution language</label>
            <select value={f.refLang} onChange={set('refLang')}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label>Reference solution</label>
            <textarea rows="14" value={f.refSource} onChange={set('refSource')} spellCheck="false" />
          </div>
          <div>
            <label>Generator (Python 3)</label>
            <textarea rows="17" value={f.genSource} onChange={set('genSource')} spellCheck="false" placeholder={'import sys, random\nn, seed = map(int, sys.stdin.read().split())\nrandom.seed(seed)\nprint(n)\nprint(*[random.randint(1, 100) for _ in range(n)])'} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Tests ({f.tests.length})</h2>
          <button onClick={() => setF({ ...f, tests: [...f.tests, { input: '', output: '', isSample: false, origin: 'manual' }] })}>Add test</button>
        </div>
        <p className="help">Tests run in order and judging stops at the first failure, so put small tests first. Sample tests are shown in the statement.</p>
        {f.tests.map((t, i) => (
          <div className="testbox" key={i}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>#{i + 1}</strong>
              <span className="row">
                {t.origin === 'hardened' && <span className="badge CE">added by strength analysis</span>}
                <label style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={!!t.isSample} onChange={(e) => setTest(i, { isSample: e.target.checked })} /> sample</label>
                <button className="danger" onClick={() => setF({ ...f, tests: f.tests.filter((_, j) => j !== i) })}>Remove</button>
              </span>
            </div>
            {t.large ? (
              <p className="help">Large test ({Math.round((t.input.length + t.output.length) / 1024)} KB), kept as is. Preview: <span className="mono">{t.input.slice(0, 80)}...</span></p>
            ) : (
              <div className="grid2">
                <div><label>Input</label><textarea rows="4" value={t.input} onChange={(e) => setTest(i, { input: e.target.value })} spellCheck="false" /></div>
                <div><label>Expected output</label><textarea rows="4" value={t.output} onChange={(e) => setTest(i, { output: e.target.value })} spellCheck="false" /></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p><button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : isNew ? 'Create problem' : 'Save changes'}</button></p>
      {!isNew && <StrengthPanel slug={slug} onTestsChanged={load} />}
    </div>
  );
}
