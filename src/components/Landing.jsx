function WaferGrid({ className = '' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 opacity-[0.06] ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #14181C 1px, transparent 0)',
        backgroundSize: '18px 18px',
      }}
    />
  )
}

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
  { label: 'Open', color: 'bg-ink-muted' },
  { label: 'In Progress', color: 'bg-accent-blue' },
  { label: 'Ready to Close', color: 'bg-accent-amber' },
  { label: 'Closed', color: 'bg-accent-green' },
]

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <div className="relative border-b border-line bg-surface overflow-hidden">
        <WaferGrid />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-4">
            Tata Electronics · Dholera Fab
          </p>
          <h1 className="text-7xl sm:text-8xl font-bold tracking-tight text-ink">
            ETCH<span className="text-accent-blue">.</span>
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-ink-muted mt-4 max-w-2xl mx-auto">
            Every action item, traced like a lot on the line. Nothing logged here fades or gets forgotten.
          </p>
          <button
            onClick={onEnter}
            className="mt-8 bg-ink text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            Enter ETCH
          </button>

          <div className="mt-16 flex items-center justify-center gap-2 max-w-xl mx-auto">
            {STAGES.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1 text-left">
                  <div className={`h-1.5 rounded-sm ${s.color}`} />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mt-2">
                    {s.label}
                  </p>
                </div>
                {i < STAGES.length - 1 && <span className="text-line pb-4">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted mb-2 text-center">
          Built for the fab floor
        </p>
        <h2 className="text-2xl font-semibold text-center mb-10">
          Visibility, accountability, escalation, closure.
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="border border-line rounded-xl bg-surface p-5 hover:border-accent-blue/40 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-ink">{f.title}</h3>
                {f.tag && (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-amber/10 text-accent-amber">
                    {f.tag}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line py-8 text-center">
        <p className="font-mono text-xs text-ink-muted">
          Built for the New Joinee Pilot · 5 Teams · 34 Engineers
        </p>
      </div>
    </div>
  )
}     