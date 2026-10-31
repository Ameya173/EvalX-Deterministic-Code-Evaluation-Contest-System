import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSocketEvent } from '../socket.js';
import { Verdict, fmtMs, fmtMem, fmtDate } from '../components/Verdict.jsx';
import TestTable from '../components/TestTable.jsx';
import ComplexityCard from '../components/ComplexityCard.jsx';
import DiffViewer from '../components/DiffViewer.jsx';

const MONACO = { cpp: 'cpp', python: 'python', java: 'java', javascript: 'javascript' };

export default function Problem() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const contestId = params.get('contest') || undefined;
  const { user, token } = useAuth();

  // Problem data
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Editor states
  const [language, setLanguage] = useState(() => localStorage.getItem('jb_lang') || 'cpp');
  const [code, setCode] = useState('');
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem('jb_editor_theme') || 'vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Left panel tab: 'statement' | 'editorial' | 'submissions'
  const [leftTab, setLeftTab] = useState('statement');
  const [mySubmissions, setMySubmissions] = useState([]);

  // Submissions & Run states
  const [sub, setSub] = useState(null); // current submission
  const [runSub, setRunSub] = useState(null); // current "run" execution
  const [busy, setBusy] = useState(false);
  const [runningCustom, setRunningCustom] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [progress, setProgress] = useState(null);

  // Console Drawer states
  const [consoleTab, setConsoleTab] = useState('testcases'); // 'testcases' | 'output' | 'verdict'
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0); // 0 = Sample 1, 1 = Sample 2, etc., -1 = Custom
  const [customInput, setCustomInput] = useState('');
  const [customExpected, setCustomExpected] = useState('');
  const [copyStatus, setCopyStatus] = useState({});

  const pollRef = useRef(null);

  // Load problem
  useEffect(() => {
    setData(null);
    setError(null);
    setSub(null);
    setRunSub(null);
    api.get(`/problems/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  // Load problem submissions
  const loadMySubmissions = useCallback(() => {
    if (!user) return;
    api.get(`/submissions?problem=${slug}`).then((d) => setMySubmissions(d.submissions || [])).catch(() => {});
  }, [user, slug]);

  useEffect(() => {
    if (leftTab === 'submissions') loadMySubmissions();
  }, [leftTab, loadMySubmissions]);

  // Draft persistence
  useEffect(() => {
    if (!data) return;
    const saved = localStorage.getItem(`jb_code_${slug}_${language}`);
    setCode(saved ?? data.languages[language]?.template ?? '');
  }, [data, slug, language]);

  const onCode = (value) => {
    setCode(value || '');
    localStorage.setItem(`jb_code_${slug}_${language}`, value || '');
  };

  const resetTemplate = () => {
    if (!data) return;
    if (window.confirm('Reset code to starter template? Your current changes for this language will be cleared.')) {
      const tmpl = data.languages[language]?.template ?? '';
      setCode(tmpl);
      localStorage.setItem(`jb_code_${slug}_${language}`, tmpl);
    }
  };

  const loadSubmission = useCallback(async (id, isRunMode = false) => {
    const d = await api.get(`/submissions/${id}`);
    if (isRunMode) {
      setRunSub(d.submission);
      return d.submission;
    }
    setSub(d.submission);
    return d.submission;
  }, []);

  // WebSockets live updates
  useSocketEvent(token, 'submission:update', (evt) => {
    if (sub && evt.submissionId === sub.id) {
      if (evt.status === 'judging') setProgress({ done: evt.progress ?? 0, total: evt.total ?? 0 });
      if (evt.status === 'done' || evt.analysisStatus) {
        loadSubmission(sub.id, false).catch(() => {});
        loadMySubmissions();
      }
    }
    if (runSub && evt.submissionId === runSub.id) {
      if (evt.status === 'done') {
        loadSubmission(runSub.id, true).catch(() => {});
        setRunningCustom(false);
      }
    }
  });

  // Polling fallback
  useEffect(() => {
    clearInterval(pollRef.current);
    if ((sub && sub.status !== 'done') || (runSub && runSub.status !== 'done')) {
      pollRef.current = setInterval(() => {
        if (sub && sub.status !== 'done') loadSubmission(sub.id, false).catch(() => {});
        if (runSub && runSub.status !== 'done') {
          loadSubmission(runSub.id, true).then((s) => {
            if (s.status === 'done') setRunningCustom(false);
          }).catch(() => {});
        }
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [sub?.id, sub?.status, runSub?.id, runSub?.status, loadSubmission]);

  // Execute Submission to Online Judge Queue
  async function submit() {
    if (!user) return;
    setBusy(true);
    setSubmitError(null);
    setProgress(null);
    setConsoleTab('verdict');
    try {
      const d = await api.post('/submissions', { problemSlug: slug, language, source: code, contestId });
      setSub({ ...d.submission, tests: [] });
      loadMySubmissions();
    } catch (e) {
      setSubmitError([e.message, ...(e.details || [])].join(' | '));
    } finally {
      setBusy(false);
    }
  }

  // Execute Custom Testcase Run in Docker Sandbox
  async function runCode() {
    if (!user) return;
    setRunningCustom(true);
    setSubmitError(null);
    setConsoleTab('output');

    let inputToRun = '';
    let expectedToRun = '';

    if (selectedCaseIdx === -1) {
      inputToRun = customInput;
      expectedToRun = customExpected;
    } else if (data?.problem?.samples?.[selectedCaseIdx]) {
      inputToRun = data.problem.samples[selectedCaseIdx].input;
      expectedToRun = data.problem.samples[selectedCaseIdx].output;
    }

    try {
      const d = await api.post('/submissions/run', {
        problemSlug: slug,
        language,
        source: code,
        input: inputToRun,
        expectedOutput: expectedToRun,
      });
      setRunSub({ ...d.submission, status: 'queued' });
    } catch (e) {
      setSubmitError(e.message);
      setRunningCustom(false);
    }
  }

  // Handle keyboard shortcuts (Ctrl+Enter to submit, Ctrl+' to run)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        runCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, language, selectedCaseIdx, customInput, customExpected, user]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopyStatus((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopyStatus((prev) => ({ ...prev, [key]: false })), 1800);
  };

  const loadSampleToCustom = (sample) => {
    setCustomInput(sample.input);
    setCustomExpected(sample.output);
    setSelectedCaseIdx(-1);
    setConsoleTab('testcases');
  };

  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="container muted">Loading problem workspace...</div>;

  const { problem, languages } = data;

  return (
    <div className={`container wide ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <div className="grid2" style={{ gap: '1.25rem', alignItems: 'start' }}>
        {/* =========================================================================
            LEFT COLUMN: PROBLEM WORKSPACE (Statement / Editorial / Submissions)
            ========================================================================= */}
        <div>
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.65rem' }}>{problem.title}</h1>
                <div className="row" style={{ gap: '0.5rem', marginTop: '0.4rem' }}>
                  {problem.difficulty && (
                    <span className="badge neutral" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      Rating {problem.difficulty}
                    </span>
                  )}
                  {problem.tags?.map((t) => (
                    <span key={t} className="badge neutral">{t}</span>
                  ))}
                  {problem.declaredComplexity && (
                    <span className="badge neutral" style={{ color: 'var(--warn)', borderColor: 'var(--warn-border)' }}>
                      Target: O({problem.declaredComplexity})
                    </span>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: '0.5rem' }}>
                {problem.canManage && (
                  <Link to={`/manage/${problem.slug}`} className="btn btn-sm btn-ghost">
                    ✏️ Edit
                  </Link>
                )}
                {contestId && (
                  <Link to={`/contests/${contestId}`} className="btn btn-sm">
                    &larr; Contest
                  </Link>
                )}
              </div>
            </div>

            {/* Problem Constraints pill */}
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--surface-elevated)', padding: '0.5rem 0.85rem', borderRadius: 8, margin: '0.75rem 0 1rem' }}>
              <span>⏱ Limit: <strong className="mono" style={{ color: 'var(--text)' }}>{problem.timeLimitMs} ms</strong></span>
              <span>💾 Memory: <strong className="mono" style={{ color: 'var(--text)' }}>{Math.round(problem.memoryKb / 1024)} MB</strong></span>
              <span>🔍 Checker: <strong className="mono" style={{ color: 'var(--text)' }}>{problem.checkerType}</strong></span>
            </div>

            {/* Left Workspace Tabs */}
            <div className="tabs" style={{ marginBottom: '1.25rem' }}>
              <button className={leftTab === 'statement' ? 'on' : ''} onClick={() => setLeftTab('statement')}>
                📄 Statement
              </button>
              <button className={leftTab === 'editorial' ? 'on' : ''} onClick={() => setLeftTab('editorial')}>
                💡 Editorial & Complexity
              </button>
              {user && (
                <button className={leftTab === 'submissions' ? 'on' : ''} onClick={() => setLeftTab('submissions')}>
                  📜 My Submissions ({mySubmissions.length})
                </button>
              )}
            </div>

            {/* TAB 1: Statement */}
            {leftTab === 'statement' && (
              <div className="statement">
                <ReactMarkdown>{problem.statementMd}</ReactMarkdown>

                {problem.samples?.map((s, i) => (
                  <div key={i} style={{ marginTop: '1.5rem', background: 'var(--surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Sample #{i + 1}</h3>
                      <button className="btn-sm btn-ghost" onClick={() => loadSampleToCustom(s)} title="Load into Custom Testcase console">
                        🧪 Test in Console
                      </button>
                    </div>

                    <div className="grid2" style={{ gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span className="small muted">Input</span>
                          <button className="btn-sm btn-ghost" style={{ padding: '0 4px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(s.input, `in-${i}`)}>
                            {copyStatus[`in-${i}`] ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre style={{ margin: 0 }}>{s.input}</pre>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span className="small muted">Output</span>
                          <button className="btn-sm btn-ghost" style={{ padding: '0 4px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(s.output, `out-${i}`)}>
                            {copyStatus[`out-${i}`] ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre style={{ margin: 0 }}>{s.output}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Editorial & Complexity Guide */}
            {leftTab === 'editorial' && (
              <div>
                <h3 style={{ marginTop: 0 }}>Algorithmic Complexity & Constraints</h3>
                <div className="alert info">
                  <div>
                    <strong>Optimal Asymptotic Bound:</strong> For this problem, reference implementations operate in{' '}
                    <span className="badge neutral mono" style={{ color: 'var(--accent)' }}>
                      O({problem.declaredComplexity || 'n log n'})
                    </span>{' '}
                    time. Solutions exceeding this complexity (e.g. O(n²) or O(n³)) will trigger a C2 TLE analysis report.
                  </div>
                </div>

                <h4>Input Bounds</h4>
                <p className="muted small">
                  The test suite scales up to n = {problem.scaling?.maxN?.toLocaleString() || '256,000'}. Ensure your algorithm avoids nested loops over the primary input size.
                </p>

                <h4>Common Pitfalls</h4>
                <ul className="muted small" style={{ lineHeight: 1.8 }}>
                  <li>Using slow standard I/O in C++: include <code>ios::sync_with_stdio(false); cin.tie(nullptr);</code></li>
                  <li>Recursion stack overflow: ensure recursive depths stay within 10⁵ frames or implement iterative solutions.</li>
                  <li>Integer overflow: intermediate products or sums may require 64-bit integers (<code>long long</code> in C++, <code>BigInt</code> in JS).</li>
                </ul>
              </div>
            )}

            {/* TAB 3: Submissions History */}
            {leftTab === 'submissions' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Submission History</h3>
                  <button className="btn-sm btn-ghost" onClick={loadMySubmissions}>↻ Refresh</button>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <table>
                    <thead>
                      <tr><th>When</th><th>Verdict</th><th>Time</th><th>Memory</th><th></th></tr>
                    </thead>
                    <tbody>
                      {mySubmissions.map((s) => (
                        <tr key={s.id}>
                          <td className="small muted">{fmtDate(s.createdAt)}</td>
                          <td><Verdict verdict={s.verdict} status={s.status} short /></td>
                          <td className="mono small">{fmtMs(s.maxTimeMs)}</td>
                          <td className="mono small">{fmtMem(s.maxMemKb)}</td>
                          <td>
                            <Link to={`/submissions/${s.id}`} className="small">Inspect &rarr;</Link>
                          </td>
                        </tr>
                      ))}
                      {!mySubmissions.length && (
                        <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No submissions yet for this problem.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: CODE STUDIO & INTERACTIVE CONSOLE
            ========================================================================= */}
        <div>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div className="row" style={{ gap: '0.5rem' }}>
                {/* Language Picker */}
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    localStorage.setItem('jb_lang', e.target.value);
                  }}
                  style={{ width: 175, padding: '0.4rem 0.6rem' }}
                >
                  {Object.entries(languages).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} (×{v.timeMultiplier})
                    </option>
                  ))}
                </select>

                {/* Template Reset */}
                <button className="btn-sm btn-ghost" onClick={resetTemplate} title="Reset to default starter template">
                  ↺ Reset
                </button>
              </div>

              {/* Editor Preferences */}
              <div className="row" style={{ gap: '0.5rem' }}>
                <select
                  value={editorTheme}
                  onChange={(e) => {
                    setEditorTheme(e.target.value);
                    localStorage.setItem('jb_editor_theme', e.target.value);
                  }}
                  style={{ width: 110, padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="vs-dark">Dark</option>
                  <option value="light">Light</option>
                </select>

                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{ width: 80, padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value={13}>13px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                </select>

                <button
                  className="btn-sm btn-ghost"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Editor'}
                >
                  {isFullscreen ? '🗗' : '⛶'}
                </button>
              </div>
            </div>

            {/* Monaco Code Editor */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <Editor
                height={isFullscreen ? '80vh' : '440px'}
                language={MONACO[language]}
                theme={editorTheme}
                value={code}
                onChange={onCode}
                options={{
                  minimap: { enabled: false },
                  fontSize,
                  scrollBeyondLastLine: false,
                  cursorSmoothCaretAnimation: 'on',
                  bracketPairColorization: { enabled: true },
                  fontFamily: 'var(--font-mono)',
                  tabSize: 4,
                  automaticLayout: true,
                }}
              />
            </div>

            {language === 'java' && (
              <p className="help" style={{ margin: '0.4rem 0 0' }}>Java: the public class must be named Main.</p>
            )}

            {submitError && (
              <div className="alert error" style={{ marginTop: '0.75rem' }}>
                {submitError}
              </div>
            )}

            {/* Bottom Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem' }}>
              <div className="small muted" style={{ display: 'flex', gap: '0.75rem' }}>
                <span>Run: <kbd style={{ background: 'var(--surface-elevated)', padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl+'</kbd></span>
                <span>Submit: <kbd style={{ background: 'var(--surface-elevated)', padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl+Enter</kbd></span>
              </div>

              <div className="row" style={{ gap: '0.65rem' }}>
                {user ? (
                  <>
                    <button
                      className="btn btn-run"
                      onClick={runCode}
                      disabled={runningCustom || busy || !code.trim()}
                      title="Run code against custom input or samples in isolated Docker sandbox"
                    >
                      {runningCustom ? (
                        <>
                          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                          Running...
                        </>
                      ) : (
                        '⚡ Run Code'
                      )}
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={submit}
                      disabled={busy || runningCustom || !code.trim()}
                      title="Submit solution to online judge queue"
                    >
                      {busy ? 'Submitting...' : 'Submit Solution'}
                    </button>
                  </>
                ) : (
                  <Link to="/login" state={{ from: `/problems/${slug}` }} className="btn btn-primary">
                    Log in to test & submit
                  </Link>
                )}
              </div>
            </div>

            {/* =========================================================================
                BOTTOM CONSOLE DRAWER (Testcases / Run Output / Full Verdict)
                ========================================================================= */}
            <div className="ide-console-drawer">
              <div className="ide-console-header">
                <div className="ide-tabs">
                  <button
                    className={`ide-tab ${consoleTab === 'testcases' ? 'active' : ''}`}
                    onClick={() => setConsoleTab('testcases')}
                  >
                    🧪 Test Cases
                  </button>
                  <button
                    className={`ide-tab ${consoleTab === 'output' ? 'active' : ''}`}
                    onClick={() => setConsoleTab('output')}
                  >
                    ⚡ Run Output {runSub && <span style={{ marginLeft: 4 }}>({runSub.verdict || 'Running'})</span>}
                  </button>
                  {sub && (
                    <button
                      className={`ide-tab ${consoleTab === 'verdict' ? 'active' : ''}`}
                      onClick={() => setConsoleTab('verdict')}
                    >
                      📊 Submission Verdict ({sub.verdict || 'Judging'})
                    </button>
                  )}
                </div>
              </div>

              <div className="ide-console-body">
                {/* CONSOLE TAB 1: Test Cases */}
                {consoleTab === 'testcases' && (
                  <div>
                    <div className="row" style={{ gap: '0.4rem', marginBottom: '0.75rem' }}>
                      {problem.samples?.map((_, i) => (
                        <button
                          key={i}
                          className={`btn-sm ${selectedCaseIdx === i ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setSelectedCaseIdx(i)}
                        >
                          Sample #{i + 1}
                        </button>
                      ))}
                      <button
                        className={`btn-sm ${selectedCaseIdx === -1 ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSelectedCaseIdx(-1)}
                      >
                        ✏️ Custom Input
                      </button>
                    </div>

                    {selectedCaseIdx >= 0 && problem.samples?.[selectedCaseIdx] && (
                      <div className="grid2" style={{ gap: '0.75rem' }}>
                        <div>
                          <label style={{ margin: 0 }}>Input</label>
                          <pre style={{ margin: '0.3rem 0', maxHeight: 140 }}>{problem.samples[selectedCaseIdx].input}</pre>
                        </div>
                        <div>
                          <label style={{ margin: 0 }}>Expected Output</label>
                          <pre style={{ margin: '0.3rem 0', maxHeight: 140 }}>{problem.samples[selectedCaseIdx].output}</pre>
                        </div>
                      </div>
                    )}

                    {selectedCaseIdx === -1 && (
                      <div className="grid2" style={{ gap: '0.75rem' }}>
                        <div>
                          <label style={{ margin: 0 }}>Custom Stdin</label>
                          <textarea
                            rows={4}
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Type input for your program..."
                          />
                        </div>
                        <div>
                          <label style={{ margin: 0 }}>Expected Output (Optional)</label>
                          <textarea
                            rows={4}
                            value={customExpected}
                            onChange={(e) => setCustomExpected(e.target.value)}
                            placeholder="Type expected output to compare against..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CONSOLE TAB 2: Run Output */}
                {consoleTab === 'output' && (
                  <div>
                    {runningCustom && (
                      <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 0' }}>
                        <span className="pulse-dot" /> Compiling & executing code inside isolated Docker sandbox container...
                      </div>
                    )}

                    {!runningCustom && !runSub && (
                      <p className="muted small" style={{ margin: 0 }}>
                        Click "Run Code" to execute against the active test case without submitting to the contest scoreboard.
                      </p>
                    )}

                    {runSub && runSub.status === 'done' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                          <div className="row" style={{ gap: '0.75rem' }}>
                            <Verdict verdict={runSub.verdict} status={runSub.status} />
                            <span className="mono small">CPU: {fmtMs(runSub.runOutput?.timeMs || runSub.maxTimeMs)}</span>
                            <span className="mono small">Memory: {fmtMem(runSub.runOutput?.memKb || runSub.maxMemKb)}</span>
                          </div>
                        </div>

                        {runSub.compileLog && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div className="small muted" style={{ fontWeight: 600 }}>Compiler Diagnostics</div>
                            <pre style={{ color: 'var(--bad)' }}>{runSub.compileLog}</pre>
                          </div>
                        )}

                        {runSub.runOutput?.stderr && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div className="small muted" style={{ fontWeight: 600 }}>Standard Error (stderr)</div>
                            <pre style={{ color: 'var(--warn)' }}>{runSub.runOutput.stderr}</pre>
                          </div>
                        )}

                        <div>
                          <div className="small muted" style={{ fontWeight: 600 }}>Standard Output (stdout)</div>
                          <pre>{runSub.runOutput?.stdout || '(No output produced)'}</pre>
                        </div>

                        {/* Visual Diff if Expected Output is Available */}
                        {runSub.expectedOutput && (
                          <DiffViewer expected={runSub.expectedOutput} actual={runSub.runOutput?.stdout || ''} />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* CONSOLE TAB 3: Full Submission Verdict */}
                {consoleTab === 'verdict' && sub && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div className="row" style={{ gap: '0.75rem' }}>
                        <Verdict verdict={sub.verdict} status={sub.status} />
                        {sub.verdict && sub.verdict !== 'AC' && sub.failedTest && (
                          <span className="badge WA small">Failed on Test #{sub.failedTest}</span>
                        )}
                        {sub.verdict === 'AC' && (
                          <span className="muted small">Max: {fmtMs(sub.maxTimeMs)} · {fmtMem(sub.maxMemKb)}</span>
                        )}
                      </div>
                      <Link to={`/submissions/${sub.id}`} className="small" style={{ textDecoration: 'underline' }}>
                        Open Full Submission Page &rarr;
                      </Link>
                    </div>

                    {sub.status !== 'done' && progress && progress.total > 0 && (
                      <div style={{ margin: '0.75rem 0' }}>
                        <div className="muted small" style={{ marginBottom: 4 }}>
                          Judging progress: {progress.done} of {progress.total} testcases executed
                        </div>
                        <div className="progress">
                          <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    {sub.verdict === 'CE' && <pre style={{ color: 'var(--bad)' }}>{sub.compileLog}</pre>}
                    {sub.verdict === 'SE' && <div className="alert warn">{sub.compileLog || 'Internal judge error.'}</div>}

                    <TestTable tests={sub.tests} total={sub.testsTotal} limitMs={problem.timeLimitMs} />
                  </div>
                )}
              </div>
            </div>

            {/* C2 Complexity Card if Submission timed out */}
            {sub && sub.verdict === 'TLE' && sub.analysisStatus && sub.analysisStatus !== 'none' && (
              <ComplexityCard key={sub.id} submissionId={sub.id} initialStatus={sub.analysisStatus} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
