import { useMemo } from 'react'

/* ---------------------------------------------------------------
   ETCH — Tata Electronics · Dholera Fab
   Theme: Cleanroom / Litho Bay
   - Graphite base (cleanroom steel), amber signature (lithography
     bay lighting is genuinely amber — protects photoresist), cyan
     for active states (etch plasma glow), green/red for bin status.
   - Signature element: live wafer bin-map with inspection sweep.
   --------------------------------------------------------------- */

const TOKENS = `
  .etch-landing {
    --graphite-950: #0B0D0F;
    --graphite-900: #14171A;
    --graphite-800: #1C2024;
    --graphite-700: #262B30;
    --line: #2A2F34;
    --line-soft: #1E2226;
    --silver: #E7EAEC;
    --silver-muted: #8D959B;
    --litho-amber: #F0A83B;
    --litho-amber-dim: #7A5A28;
    --plasma-cyan: #4FD8E8;
    --bin-green: #4ADE80;
    --bin-red: #F2545B;
    --font-display: 'IBM Plex Sans', system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
    background: var(--graphite-950);
    color: var(--silver);
    font-family: var(--font-display);
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  .etch-landing * { box-sizing: border-box; }

  .etch-mono { font-family: var(--font-mono); letter-spacing: 0.06em; }

  /* ---------- ticker ---------- */
  .etch-ticker {
    border-bottom: 1px solid var(--line);
    background: var(--graphite-900);
    overflow: hidden;
    white-space: nowrap;
    position: relative;
  }
  .etch-ticker::before, .etch-ticker::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 48px;
    z-index: 2;
    pointer-events: none;
  }
  .etch-ticker::before { left: 0; background: linear-gradient(90deg, var(--graphite-900), transparent); }
  .etch-ticker::after { right: 0; background: linear-gradient(270deg, var(--graphite-900), transparent); }
  .etch-ticker-track {
    display: inline-flex;
    animation: etch-marquee 32s linear infinite;
  }
  .etch-ticker-item {
    padding: 8px 28px;
    font-size: 11px;
    color: var(--silver-muted);
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .etch-ticker-item b { color: var(--litho-amber); font-weight: 500; }
  .etch-ticker-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--line); }

  @keyframes etch-marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  /* ---------- nav ---------- */
  .etch-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid var(--line);
  }
  .etch-logo { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  .etch-logo span { color: var(--litho-amber); }

  /* ---------- hero ---------- */
  .etch-hero {
    max-width: 1180px;
    margin: 0 auto;
    padding: 64px 32px 40px;
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 40px;
    align-items: center;
  }
  @media (max-width: 860px) {
    .etch-hero { grid-template-columns: 1fr; padding-top: 40px; }
  }
  .etch-eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--litho-amber);
    margin-bottom: 18px;
  }
  .etch-h1 {
    font-size: clamp(46px, 7vw, 78px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.98;
    margin: 0;
  }
  .etch-h1 .dot { color: var(--litho-amber); }
  .etch-sub {
    font-size: 17px;
    line-height: 1.55;
    color: var(--silver-muted);
    max-width: 46ch;
    margin: 20px 0 32px;
  }
  .etch-cta {
    background: var(--litho-amber);
    color: var(--graphite-950);
    border: none;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    padding: 13px 24px;
    border-radius: 3px;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 0 0 rgba(240, 168, 59, 0);
  }
  .etch-cta:hover {
    box-shadow: 0 0 28px 2px rgba(240, 168, 59, 0.35);
    transform: translateY(-1px);
  }
  .etch-cta:focus-visible {
    outline: 2px solid var(--plasma-cyan);
    outline-offset: 3px;
  }

  /* ---------- wafer map ---------- */
  .etch-wafer-wrap {
    display: flex;
    justify-content: center;
    position: relative;
  }
  .etch-wafer-caption {
    position: absolute;
    bottom: -26px;
    font-size: 10px;
    color: var(--line);
    text-align: center;
    width: 100%;
  }
  .etch-die-pulse { animation: etch-pulse 2.6s ease-in-out infinite; }
  @keyframes etch-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .etch-sweep { transform-origin: 150px 150px; animation: etch-sweep 11s linear infinite; }
  @keyframes etch-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .etch-ticker-track, .etch-die-pulse, .etch-sweep { animation: none !important; }
  }

  /* ---------- traveler / stage rail ---------- */
  .etch-rail {
    max-width: 1180px;
    margin: 0 auto;
    padding: 8px 32px 56px;
    display: flex;
    align-items: center;
    gap: 0;
  }
  .etch-rail-seg { flex: 1; position: relative; padding-top: 14px; }
  .etch-rail-line { height: 2px; background: var(--line); position: relative; }
  .etch-rail-dot {
    position: absolute;
    top: -3px; left: 0;
    width: 8px; height: 8px;
    border-radius: 50%;
    transform: translateX(-3px);
  }
  .etch-rail-label {
    margin-top: 10px;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--silver-muted);
  }

  /* ---------- features ---------- */
  .etch-features { max-width: 1180px; margin: 0 auto; padding: 8px 32px 80px; }
  .etch-features-eyebrow {
    text-align: center;
    font-size: 11px;
    color: var(--silver-muted);
    margin-bottom: 8px;
  }
  .etch-features-h2 {
    text-align: center;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 44px;
  }
  .etch-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--line);
    border: 1px solid var(--line);
  }
  @media (max-width: 720px) { .etch-grid { grid-template-columns: 1fr; } }
  .etch-card {
    background: var(--graphite-900);
    padding: 26px 24px;
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }
  .etch-card:hover {
    background: var(--graphite-800);
    box-shadow: inset 2px 0 0 var(--litho-amber);
  }
  .etch-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .etch-card-title { font-size: 15px; font-weight: 600; }
  .etch-card-tag {
    font-size: 9px;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 2px;
    background: rgba(240, 168, 59, 0.12);
    color: var(--litho-amber);
    border: 1px solid rgba(240, 168, 59, 0.3);
  }
  .etch-card-desc { font-size: 13.5px; line-height: 1.6; color: var(--silver-muted); }

  /* ---------- footer ---------- */
  .etch-footer {
    border-top: 1px solid var(--line);
    padding: 22px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--line);
  }
  .etch-footer span { color: var(--silver-muted); }
`

const FEATURES = [
  {
    title: 'Centralized Repository',
    desc: 'Every action item from governance reviews, audits, projects, and leadership meetings lives in one place — not scattered across chats and sheets.',
    tag: null,
  },
  {
    title: 'Ownership & Deadlines',
    desc: 'No item exists without a named owner and a real deadline. Accountability is built into creation, not bolted on after.',
    tag: null,
  },
  {
    title: 'Automated Reminders',
    desc: 'Owners get nudged as deadlines approach, and overdue items escalate automatically — so nothing slips silently.',
    tag: 'In Progress',
  },
  {
    title: 'Closure Verification',
    desc: 'Closing an item requires a separate verifier and evidence note. No self-certified closures, no fake green checkmarks.',
    tag: null,
  },
]

const STAGES = [
  { label: 'Open', color: 'var(--silver-muted)' },
  { label: 'In Progress', color: 'var(--plasma-cyan)' },
  { label: 'Ready to Close', color: 'var(--litho-amber)' },
  { label: 'Closed', color: 'var(--bin-green)' },
]

const TICKER_ITEMS = [
  'LOT TRV-2291 → LITHO BAY 3',
  'AUDIT FINDING #58 — OWNER ASSIGNED',
  'WIP 1,204 LOTS',
  'YIELD 98.2%',
  '12 ITEMS OVERDUE — ESCALATED',
  'GOVERNANCE REVIEW Q3 CLOSED',
  'CD UNIFORMITY WITHIN SPEC',
]

/* deterministic pseudo-random, avoids hydration mismatch */
function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function WaferMap() {
  const dies = useMemo(() => {
    const step = 15
    const size = 12
    const radius = 122
    const cx0 = 150
    const cy0 = 150
    const out = []
    let idx = 0
    for (let row = -9; row <= 9; row++) {
      for (let col = -9; col <= 9; col++) {
        const x = col * step
        const y = row * step
        if (Math.sqrt(x * x + y * y) > radius) continue
        const r = seeded(idx)
        let fill = 'var(--graphite-700)'
        let pulse = false
        if (r > 0.9) { fill = 'var(--bin-green)' }
        else if (r > 0.8) { fill = 'var(--litho-amber)'; pulse = idx % 5 === 0 }
        else if (r > 0.62) { fill = 'var(--plasma-cyan)'; pulse = idx % 4 === 0 }
        out.push({
          key: idx,
          x: cx0 + x - size / 2,
          y: cy0 + y - size / 2,
          fill,
          pulse,
          delay: (seeded(idx + 500) * 2.4).toFixed(2),
        })
        idx++
      }
    }
    return out
  }, [])

  return (
    <div className="etch-wafer-wrap">
      <svg viewBox="0 0 300 300" width="360" height="360" style={{ maxWidth: '100%' }}>
        <defs>
          <radialGradient id="wafer-glow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(240,168,59,0.06)" />
            <stop offset="100%" stopColor="rgba(240,168,59,0)" />
          </radialGradient>
          <linearGradient id="sweep-grad" x1="150" y1="150" x2="150" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(79,216,232,0)" />
            <stop offset="100%" stopColor="rgba(79,216,232,0.55)" />
          </linearGradient>
        </defs>

        <circle cx="150" cy="150" r="140" fill="url(#wafer-glow)" />
        <circle cx="150" cy="150" r="128" fill="none" stroke="var(--line)" strokeWidth="1.5" />

        {dies.map((d) => (
          <rect
            key={d.key}
            x={d.x}
            y={d.y}
            width="12"
            height="12"
            rx="1.5"
            fill={d.fill}
            opacity={d.fill === 'var(--graphite-700)' ? 0.9 : 1}
            className={d.pulse ? 'etch-die-pulse' : ''}
            style={d.pulse ? { animationDelay: `${d.delay}s` } : undefined}
          />
        ))}

        {/* wafer notch */}
        <circle cx="150" cy="278" r="7" fill="var(--graphite-950)" />

        {/* inspection sweep */}
        <g className="etch-sweep">
          <line x1="150" y1="150" x2="150" y2="20" stroke="url(#sweep-grad)" strokeWidth="34" strokeLinecap="round" />
        </g>
      </svg>
      <p className="etch-wafer-caption etch-mono">WAFER MAP · REAL-TIME BIN STATUS</p>
    </div>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="etch-ticker">
      <div className="etch-ticker-track">
        {items.map((t, i) => (
          <span className="etch-ticker-item etch-mono" key={i}>
            <b>›</b> {t}
            <span className="etch-ticker-dot" />
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing({ onEnter }) {
  return (
    <div className="etch-landing">
      <style>{TOKENS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`}</style>

      <Ticker />

      <div className="etch-nav">
        <div className="etch-logo">ETCH<span>.</span></div>
        <button className="etch-cta" onClick={onEnter} style={{ padding: '9px 18px', fontSize: '13px' }}>
          Enter ETCH
        </button>
      </div>

      <div className="etch-hero">
        <div>
          <p className="etch-eyebrow etch-mono">TATA ELECTRONICS · DHOLERA FAB</p>
          <h1 className="etch-h1">
            ETCH<span className="dot">.</span>
          </h1>
          <p className="etch-sub">
            Every action item, traced like a lot on the line. Nothing logged here fades or gets forgotten.
          </p>
          <button className="etch-cta" onClick={onEnter}>
            Enter ETCH →
          </button>
        </div>
        <WaferMap />
      </div>

      <div className="etch-rail">
        {STAGES.map((s, i) => (
          <div className="etch-rail-seg" key={s.label}>
            <div className="etch-rail-line">
              <div className="etch-rail-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            </div>
            <p className="etch-rail-label etch-mono">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="etch-features">
        <p className="etch-features-eyebrow etch-mono">ONE TEAM ONE DREAM ONE SEMI</p>
        <h2 className="etch-features-h2">Visibility, accountability, escalation, closure.</h2>
        <div className="etch-grid">
          {FEATURES.map((f) => (
            <div className="etch-card" key={f.title}>
              <div className="etch-card-head">
                <h3 className="etch-card-title">{f.title}</h3>
                {f.tag && <span className="etch-card-tag etch-mono">{f.tag}</span>}
              </div>
              <p className="etch-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="etch-footer etch-mono">
        <span>DHOLERA · AHMEDABAD · INDIA</span>
        <span>FAB OPS TOOLING</span>
      </div>
    </div>
  )
}   