import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Inline SVGs (Immune to charset encoding bugs)
const Icons = {
  Terminal: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Trophy: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12a2 2 0 0 1 2 2v4a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  Flame: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  Shield: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Cpu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Zap: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Compass: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  Layers: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  BookOpen: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Code: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Tag: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

function diffLabel(d) {
  if (d <= 1000) return { label: 'Easy', color: 'var(--ok)' };
  if (d <= 1300) return { label: 'Medium', color: 'var(--warn)' };
  if (d <= 1600) return { label: 'Hard', color: '#f97316' };
  return { label: 'Expert', color: 'var(--bad)' };
}

const TOPICS = [
  { name: 'Arrays', color: '#6366f1', count: '65+' },
  { name: 'Strings', color: '#8b5cf6', count: '48+' },
  { name: 'Linked List', color: '#ec4899', count: '32+' },
  { name: 'Trees', color: '#22c55e', count: '54+' },
  { name: 'Graphs', color: '#06b6d4', count: '46+' },
  { name: 'Dynamic Programming', color: '#f59e0b', count: '60+' },
  { name: 'Binary Search', color: '#3b82f6', count: '38+' },
  { name: 'Stacks & Queues', color: '#84cc16', count: '35+' },
  { name: 'Heaps', color: '#f43f5e', count: '28+' },
  { name: 'Backtracking', color: '#a855f7', count: '24+' },
  { name: 'Greedy', color: '#10b981', count: '30+' },
  { name: 'Bit Manipulation', color: '#0ea5e9', count: '22+' },
  { name: 'Math', color: '#f97316', count: '25+' },
];

const SHEETS = [
  {
    name: 'Blind 75',
    desc: 'The 75 definitive DSA questions to crack Google, Meta, Amazon, and top tech interviews.',
    count: 75,
    color: '#6366f1',
    badge: 'Essential',
  },
  {
    name: 'NeetCode 150',
    desc: 'Structured 18-topic roadmap covering every high-yield pattern from Two Pointers to DP.',
    count: 150,
    color: '#8b5cf6',
    badge: 'Popular',
  },
  {
    name: 'Striver SDE',
    desc: 'End-to-end coding interview curriculum trusted by over 1,000,000 engineering students.',
    count: 180,
    color: '#ec4899',
    badge: 'Comprehensive',
  },
  {
    name: 'Top 500 Mastery',
    desc: 'Complete compendium covering foundational patterns up to competitive collegiate level.',
    count: 500,
    color: '#f59e0b',
    badge: 'Complete',
  },
];

const STATS = [
  { value: '500+', label: 'DSA Problems', icon: Icons.Code },
  { value: '13', label: 'Core Categories', icon: Icons.Layers },
  { value: 'Live', label: 'ICPC Contests', icon: Icons.Zap },
  { value: '4', label: 'Study Sheets', icon: Icons.Compass },
  { value: 'Docker', label: 'Secure Sandbox', icon: Icons.Shield },
  { value: 'Real-time', label: 'Scoreboard', icon: Icons.Trophy },
];

const COMPANIES = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Uber', 'Netflix', 'Bloomberg'];

const FEATURES = [
  {
    icon: Icons.Shield,
    title: 'Docker Sandbox',
    desc: 'Every user submission is isolated within lightweight, hardened Docker containers with microsecond-level cgroup telemetry.',
  },
  {
    icon: Icons.Cpu,
    title: 'Noise-Aware Benchmarking',
    desc: 'Continuous hardware calibration normalizes server CPU noise to guarantee fair verdicts with zero erratic TLE penalties.',
  },
  {
    icon: Icons.Trophy,
    title: 'Live ICPC Contests',
    desc: 'Automated scoreboard freeze periods, first-to-solve star awards, penalty tracking, and instant broadcast updates.',
  },
  {
    icon: Icons.TrendingUp,
    title: 'Structured Study Tracks',
    desc: 'Curated Blind 75, NeetCode 150, and Striver sheets with client-side progress checklists and category metrics.',
  },
  {
    icon: Icons.Tag,
    title: 'Company-Tagged Problems',
    desc: 'Real questions categorized by frequency at Google, Meta, Amazon, Microsoft, Apple, and premier tech startups.',
  },
  {
    icon: Icons.BookOpen,
    title: 'Tiered Hints & Editorials',
    desc: 'Multi-stage progressive hints and algorithmic complexity analysis so you learn how to think, not just copy answers.',
  },
];

function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = ['{ }', '=>', '01', '&&', '[]', '//', '<>', '++', '**', 'fn', 'if', '!0', '0x'];
    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      char: chars[Math.floor(Math.random() * chars.length)],
      speed: 0.15 + Math.random() * 0.35,
      opacity: 0.04 + Math.random() * 0.08,
      size: 11 + Math.random() * 10,
      drift: (Math.random() - 0.5) * 0.3,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.font = `${p.size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
        ctx.fillText(p.char, p.x, p.y);
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -30) {
          p.y = canvas.height + 30;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -50 || p.x > canvas.width + 50) {
          p.x = Math.random() * canvas.width;
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

const WORDS_TO_TYPE = [
  'Crack Any Interview',
  'Ace FAANG Coding Rounds',
  'Dominate Timed Contests',
  'Master DSA & Algorithms',
];

function Hero() {
  const navigate = useNavigate();
  const badgeRef = useRef(null);
  const h1Ref = useRef(null);
  const subRef = useRef(null);
  const ctaRef = useRef(null);
  const compRef = useRef(null);

  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [displayText, setDisplayText] = useState(WORDS_TO_TYPE[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentTarget = WORDS_TO_TYPE[currentWordIdx];

    if (!isDeleting) {
      if (displayText.length < currentTarget.length) {
        timer = setTimeout(() => {
          setDisplayText(currentTarget.slice(0, displayText.length + 1));
        }, 55);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2600);
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(currentTarget.slice(0, displayText.length - 1));
        }, 30);
      } else {
        setIsDeleting(false);
        setCurrentWordIdx((prev) => (prev + 1) % WORDS_TO_TYPE.length);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentWordIdx]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(badgeRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6 })
      .fromTo(h1Ref.current, { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.3')
      .fromTo(subRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
      .fromTo(ctaRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
      .fromTo(compRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.2');

    return () => tl.kill();
  }, []);

  return (
    <section className="hero-section">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="hero-bg-image" />

      <div className="hero-inner">
        <div ref={badgeRef} className="hero-live-badge">
          <span className="pulse-dot" style={{ background: 'var(--ok)' }} />
          <span>500+ Curated Problems &bull; Live ICPC Arena</span>
        </div>

        <h1 ref={h1Ref} className="hero-headline">
          Master DSA &amp;<br />
          <span className="hero-gradient-text" style={{ minHeight: '1.2em', display: 'inline-block' }}>
            {displayText}
            <span
              style={{
                display: 'inline-block',
                width: '3px',
                height: '0.85em',
                background: 'var(--primary)',
                marginLeft: '4px',
                verticalAlign: 'baseline',
                animation: 'cursorBlink 1s infinite',
              }}
            />
          </span>
        </h1>

        <p ref={subRef} className="hero-sub">
          Deterministic Code Evaluation &amp; Contest System. Curated DSA roadmaps, live ICPC contests, Docker sandboxing, and noise-aware verdicts designed for serious engineers.
        </p>

        <div ref={ctaRef} className="hero-cta">
          <button className="hero-btn-primary" onClick={() => navigate('/problems')}>
            <Icons.Terminal />
            <span>Start Solving</span>
          </button>
          <button className="hero-btn-ghost" onClick={() => navigate('/study-plan')}>
            <Icons.Compass />
            <span>Explore Study Plan</span>
          </button>
          <button className="hero-btn-ghost" onClick={() => navigate('/contests')}>
            <Icons.Trophy />
            <span>Live Contests</span>
          </button>
        </div>

        <div ref={compRef} className="hero-company-strip">
          <span className="hero-company-label">Problems asked at</span>
          {COMPANIES.map((c) => (
            <span key={c} className="hero-company-tag">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="hero-scroll-hint">
        <div className="scroll-mouse">
          <div className="scroll-wheel" />
        </div>
        <span>Scroll to explore</span>
      </div>
    </section>
  );
}

function StatsBanner() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.querySelectorAll('.stat-item'),
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 85%' },
      }
    );
  }, []);

  return (
    <section ref={ref} className="stats-strip">
      {STATS.map((s) => {
        const IconComponent = s.icon;
        return (
          <div key={s.label} className="stat-item">
            <div className="stat-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <IconComponent />
            </div>
            <div className="stat-item-value">{s.value}</div>
            <div className="stat-item-label">{s.label}</div>
          </div>
        );
      })}
    </section>
  );
}

function ProblemOfDay({ problems }) {
  const ref = useRef(null);
  const today = new Date();
  const idx = (today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()) % (problems.length || 1);
  const p = problems[idx];

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 35 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } }
      );
    }
  }, []);

  if (!p) return null;
  const { label, color } = diffLabel(p.difficulty || 800);
  const todayStr = today.toDateString();
  const last = localStorage.getItem('jb_potd_last');

  const streak = (() => {
    if (last === todayStr) return parseInt(localStorage.getItem('jb_potd_streak') || '1', 10);
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (last === yest.toDateString()) {
      const s = parseInt(localStorage.getItem('jb_potd_streak') || '1', 10) + 1;
      localStorage.setItem('jb_potd_streak', s);
      localStorage.setItem('jb_potd_last', todayStr);
      return s;
    }
    localStorage.setItem('jb_potd_streak', '1');
    localStorage.setItem('jb_potd_last', todayStr);
    return 1;
  })();

  return (
    <section className="section-wrap">
      <div ref={ref} className="potd-card-new">
        <div className="potd-left">
          <div className="potd-chip">
            <span className="pulse-dot" style={{ background: 'var(--ok)' }} />
            <span>Problem of the Day</span>
            <span>&bull;</span>
            <span className="potd-date-str">{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>

          <h2 className="potd-title">{p.title}</h2>
          <p className="potd-statement-preview">
            Master this essential pattern today. Run your solution against all edge cases in our Docker sandbox.
          </p>

          <div className="potd-meta-row">
            <span
              className="diff-badge"
              style={{
                background: `${color}18`,
                color,
                border: `1px solid ${color}44`,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.78rem',
              }}
            >
              {label} ({p.difficulty || 800})
            </span>
            <span className="topic-badge">{p.category || (p.tags && p.tags[0]) || 'Arrays'}</span>
            {(p.companies || []).slice(0, 3).map((c) => (
              <span key={c} className="co-badge">
                {c}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <Link to={`/problems/${p.slug}`} className="potd-solve-btn">
              <span>Solve Problem</span>
              <Icons.ArrowRight />
            </Link>
            <span className="potd-reset-note" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-dim)' }}>
              <span>Resets nightly at 00:00 UTC</span>
            </span>
          </div>
        </div>

        <div className="potd-right">
          <div className="streak-display">
            <div className="streak-fire-big" style={{ color: '#f59e0b', display: 'flex', justifyContent: 'center' }}>
              <Icons.Flame />
            </div>
            <div className="streak-count">{streak}</div>
            <div className="streak-text">Day Coding Streak</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DifficultySlider({ problems }) {
  const [range, setRange] = useState([800, 2000]);
  const ref = useRef(null);

  const filtered = problems.filter((p) => {
    const d = p.difficulty || 800;
    return d >= range[0] && d <= range[1];
  });

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } }
      );
    }
  }, []);

  return (
    <section className="section-wrap">
      <div className="section-head">
        <h2 className="section-title">Difficulty Explorer</h2>
        <p className="section-sub">Filter instantly by Elo rating to find challenges tuned to your exact skill level</p>
      </div>

      <div ref={ref} className="slider-glass-card">
        <div className="slider-legend">
          <span style={{ color: 'var(--ok)' }}>&bull; Easy (&le; 1000)</span>
          <span style={{ color: 'var(--warn)' }}>&bull; Medium (1001 - 1300)</span>
          <span style={{ color: '#f97316' }}>&bull; Hard (1301 - 1600)</span>
          <span style={{ color: 'var(--bad)' }}>&bull; Expert (&gt; 1600)</span>
        </div>

        <div className="dual-slider-wrap">
          <div className="range-display">
            <span className="range-num">{range[0]}</span>
            <div className="range-track-bg">
              <div
                className="range-track-fill"
                style={{
                  left: `${((range[0] - 800) / 1600) * 100}%`,
                  width: `${((range[1] - range[0]) / 1600) * 100}%`,
                }}
              />
            </div>
            <span className="range-num">{range[1]}</span>
          </div>

          <div style={{ position: 'relative', height: 20 }}>
            <input
              type="range"
              min={800}
              max={2400}
              step={50}
              value={range[0]}
              onChange={(e) => {
                const v = +e.target.value;
                if (v < range[1] - 100) setRange([v, range[1]]);
              }}
              className="range-input range-lower"
            />
            <input
              type="range"
              min={800}
              max={2400}
              step={50}
              value={range[1]}
              onChange={(e) => {
                const v = +e.target.value;
                if (v > range[0] + 100) setRange([range[0], v]);
              }}
              className="range-input range-upper"
            />
          </div>
        </div>

        <div className="slider-result-meta">
          <span className="muted">{filtered.length} problems matching range</span>
          <Link to={`/problems?minDiff=${range[0]}&maxDiff=${range[1]}`} className="btn btn-sm btn-primary">
            <span>Explore All in Archive</span>
            <Icons.ArrowRight />
          </Link>
        </div>

        <div className="preview-grid">
          {filtered.slice(0, 6).map((p) => {
            const { label, color } = diffLabel(p.difficulty || 800);
            return (
              <Link key={p.slug} to={`/problems/${p.slug}`} className="preview-card">
                <span className="preview-title">{p.title}</span>
                <span
                  className="diff-badge"
                  style={{
                    background: `${color}18`,
                    color,
                    border: `1px solid ${color}44`,
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  {label} &bull; {p.difficulty || 800}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
              No problems found in this range.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TopicsCarousel({ problems }) {
  const [active, setActive] = useState(null);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.querySelectorAll('.topic-pill-new'),
      { opacity: 0, scale: 0.85 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        stagger: 0.04,
        ease: 'back.out(1.5)',
        scrollTrigger: { trigger: ref.current, start: 'top 85%' },
      }
    );
  }, []);

  const topicProblems = active
    ? problems.filter((p) => p.category === active || (p.tags || []).some((t) => t.toLowerCase().includes(active.toLowerCase())))
    : [];

  return (
    <section className="section-wrap">
      <div className="section-head">
        <h2 className="section-title">Core Algorithmic Topics</h2>
        <p className="section-sub">Master DSA module-by-module across 13 core computer science foundations</p>
      </div>

      <div ref={ref} className="topics-pill-grid">
        {TOPICS.map((t) => (
          <button
            key={t.name}
            className={`topic-pill-new${active === t.name ? ' tpn-active' : ''}`}
            style={{ '--tc': t.color }}
            onClick={() => setActive(active === t.name ? null : t.name)}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: t.color,
                display: 'inline-block',
                marginRight: 6,
              }}
            />
            <span className="tpn-name">{t.name}</span>
            <span
              style={{
                fontSize: '0.7rem',
                opacity: 0.7,
                marginLeft: 4,
                background: `${t.color}20`,
                padding: '0.1rem 0.4rem',
                borderRadius: 4,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="topic-reveal">
          <div className="topic-reveal-header">
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{active} Collection</h3>
            <button className="btn btn-sm" onClick={() => navigate('/problems')}>
              View in Archive
            </button>
          </div>

          <div className="preview-grid">
            {topicProblems.slice(0, 6).map((p) => {
              const { label, color } = diffLabel(p.difficulty || 800);
              return (
                <Link key={p.slug} to={`/problems/${p.slug}`} className="preview-card">
                  <span className="preview-title">{p.title}</span>
                  <span
                    className="diff-badge"
                    style={{
                      background: `${color}18`,
                      color,
                      border: `1px solid ${color}44`,
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    {label} &bull; {p.difficulty || 800}
                  </span>
                </Link>
              );
            })}
            {topicProblems.length === 0 && (
              <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
                No problems currently tagged under {active}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CuratedSheets({ problems }) {
  const [active, setActive] = useState(SHEETS[0].name);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 35 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } }
      );
    }
  }, []);

  const sheetProblems = problems.filter((p) => (p.sheet || []).includes(active));
  const activeSheet = SHEETS.find((s) => s.name === active);

  return (
    <section className="section-wrap">
      <div className="section-head">
        <h2 className="section-title">Curated Study Roadmaps</h2>
        <p className="section-sub">Follow proven roadmaps used by thousands of engineers who landed high-impact roles</p>
      </div>

      <div ref={ref} className="sheets-wrapper">
        <div className="sheets-tab-row">
          {SHEETS.map((s) => (
            <button
              key={s.name}
              className={`sheet-tab-new${active === s.name ? ' stn-active' : ''}`}
              style={{ '--sc': s.color }}
              onClick={() => setActive(s.name)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span className="stn-name">{s.name}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: 999,
                    background: `${s.color}20`,
                    color: s.color,
                  }}
                >
                  {s.badge}
                </span>
              </div>
              <div className="stn-count">{s.count} problems target</div>
            </button>
          ))}
        </div>

        {activeSheet && (
          <div className="sheet-body">
            <div className="sheet-body-header">
              <p className="sheet-desc-text">{activeSheet.desc}</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/study-plan?track=${activeSheet.name.toLowerCase().replace(/\s+/g, '')}`)}>
                <span>Open in Study Plan</span>
                <Icons.ArrowRight />
              </button>
            </div>

            <div className="preview-grid">
              {sheetProblems.slice(0, 6).map((p) => {
                const { label, color } = diffLabel(p.difficulty || 800);
                return (
                  <Link key={p.slug} to={`/problems/${p.slug}`} className="preview-card">
                    <span className="preview-title">{p.title}</span>
                    <span
                      className="diff-badge"
                      style={{
                        background: `${color}18`,
                        color,
                        border: `1px solid ${color}44`,
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      {label} &bull; {p.difficulty || 800}
                    </span>
                  </Link>
                );
              })}
              {sheetProblems.length === 0 && (
                <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
                  Roadmap problems configured. Click &quot;Open in Study Plan&quot; to practice.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturesGrid() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.querySelectorAll('.feature-glass-card'),
      { opacity: 0, y: 40, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 85%' },
      }
    );
  }, []);

  return (
    <section className="section-wrap">
      <div className="section-head">
        <h2 className="section-title">Built for Serious Competitive Programmers</h2>
        <p className="section-sub">Engineered from the ground up for zero noise, fair grading, and production-grade reliability</p>
      </div>

      <div ref={ref} className="features-glass-grid">
        {FEATURES.map((f) => {
          const IconComponent = f.icon;
          return (
            <div key={f.title} className="feature-glass-card">
              <div className="fgc-icon" style={{ color: 'var(--primary)' }}>
                <IconComponent />
              </div>
              <h3 className="fgc-title">{f.title}</h3>
              <p className="fgc-desc">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeaderboardTicker() {
  const ref = useRef(null);
  const [tab, setTab] = useState('global');
  const [leaders, setLeaders] = useState([
    { rank: 1, handle: 'tourkov_91', solved: 348, rating: 2210, badge: 'Grandmaster' },
    { rank: 2, handle: 'ananya_ds', solved: 312, rating: 2045, badge: 'Master' },
    { rank: 3, handle: 'z_algorithm', solved: 289, rating: 1980, badge: 'Candidate Master' },
    { rank: 4, handle: 'bit_master', solved: 264, rating: 1895, badge: 'Expert' },
    { rank: 5, handle: 'siva_codes', solved: 245, rating: 1820, badge: 'Expert' },
    { rank: 6, handle: 'priya_cp', solved: 231, rating: 1765, badge: 'Specialist' },
  ]);

  useEffect(() => {
    api.get('/contests')
      .then(async (d) => {
        const contests = d.contests || [];
        if (contests.length > 0) {
          const first = contests[0];
          try {
            const board = await api.get(`/contests/${first.id}/scoreboard`);
            if (board?.rows && board.rows.length > 0) {
              const mapped = board.rows.slice(0, 6).map((r, i) => ({
                rank: i + 1,
                handle: r.handle || `user_${r.userId.slice(-4)}`,
                solved: r.solvedCount ?? r.solved ?? 0,
                rating: 1800 + (r.solvedCount || 0) * 45,
                badge: i === 0 ? 'Champion' : i < 3 ? 'Top Contender' : 'Competitor',
              }));
              setLeaders(mapped);
            }
          } catch {
            // keep defaults
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, x: 40 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } }
      );
    }
  }, []);

  return (
    <section className="section-wrap leaderboard-section">
      <div className="lboard-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ color: '#f59e0b', display: 'flex' }}>
                <Icons.Trophy />
              </div>
              <h2 className="section-title" style={{ margin: 0 }}>
                Live Leaderboard
              </h2>
            </div>
            <p className="section-sub" style={{ margin: '0.25rem 0 0' }}>
              Top algorithmic competitors ranked by problems solved and live contest Elo
            </p>
          </div>

          <div className="tabs" style={{ margin: 0 }}>
            <button className={tab === 'global' ? 'on' : ''} onClick={() => setTab('global')}>
              Global Rank
            </button>
            <button className={tab === 'weekly' ? 'on' : ''} onClick={() => setTab('weekly')}>
              Weekly Sprint
            </button>
            <button className={tab === 'contest' ? 'on' : ''} onClick={() => setTab('contest')}>
              Contest Arena
            </button>
          </div>
        </div>

        <div ref={ref} className="lboard-table">
          <div className="lboard-header">
            <span style={{ width: 60, textAlign: 'center' }}>Rank</span>
            <span>Handle</span>
            <span style={{ textAlign: 'center' }}>Badge</span>
            <span style={{ textAlign: 'center' }}>Solved</span>
            <span style={{ textAlign: 'right' }}>Rating</span>
          </div>

          {leaders.map((e, i) => {
            const isGold = i === 0;
            const isSilver = i === 1;
            const isBronze = i === 2;

            return (
              <div
                key={e.handle}
                className={`lboard-row${isGold ? ' lboard-gold' : isSilver ? ' lboard-silver' : isBronze ? ' lboard-bronze' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 140px 100px 90px',
                  alignItems: 'center',
                  padding: '0.85rem 1.25rem',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    color: isGold ? '#f59e0b' : isSilver ? '#94a3b8' : isBronze ? '#d97706' : 'var(--text-dim)',
                  }}
                >
                  {isGold ? (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                      #1
                    </span>
                  ) : isSilver ? (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(148, 163, 184, 0.2)', border: '1px solid rgba(148, 163, 184, 0.4)' }}>
                      #2
                    </span>
                  ) : isBronze ? (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(217, 119, 6, 0.2)', border: '1px solid rgba(217, 119, 6, 0.4)' }}>
                      #3
                    </span>
                  ) : (
                    `#${e.rank}`
                  )}
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {e.handle.slice(0, 2).toUpperCase()}
                  </span>
                  <Link
                    to={`/users/${e.handle}`}
                    style={{
                      fontWeight: 600,
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    @{e.handle}
                  </Link>
                </span>

                <span style={{ textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 6,
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      color: isGold ? 'var(--ok)' : 'var(--text-dim)',
                    }}
                  >
                    {e.badge}
                  </span>
                </span>

                <span style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>
                  {e.solved}
                </span>

                <span style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {e.rating}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Link to="/problems" className="btn btn-primary">
            <span>Join the Rankings</span>
            <Icons.ArrowRight />
          </Link>
          <Link to="/contests" className="btn">
            <span>Compete in Next Contest</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } }
      );
    }
  }, []);

  return (
    <section className="cta-wrap">
      <div ref={ref} className="cta-glass">
        <div className="cta-orb" />
        <h2 className="cta-headline">Ready to Elevate Your Problem Solving?</h2>
        <p className="cta-tagline">
          Join thousands of engineering students mastering core algorithms with structured sheets, weekly live contests, and noise-free Docker grading.
        </p>

        <div className="cta-btn-row">
          <Link to="/register" className="cta-primary-btn">
            <span>Create Free Account</span>
            <Icons.ArrowRight />
          </Link>
          <Link to="/study-plan" className="cta-ghost-btn">
            <span>View Study Plan</span>
          </Link>
          <Link to="/problems" className="cta-ghost-btn">
            <span>Browse All Problems</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    api.get('/problems')
      .then((d) => setProblems(d.problems || []))
      .catch(() => {});
  }, []);

  return (
    <div className="landing-root">
      <ParticleCanvas />
      <Hero />
      <StatsBanner />
      {problems.length > 0 && <ProblemOfDay problems={problems} />}
      {problems.length > 0 && <DifficultySlider problems={problems} />}
      {problems.length > 0 && <TopicsCarousel problems={problems} />}
      {problems.length > 0 && <CuratedSheets problems={problems} />}
      <FeaturesGrid />
      <LeaderboardTicker />
      <CTASection />
    </div>
  );
}
