import { useState } from 'react'

const ROSTER = {
  FMCS: ['Vaibhav', 'Tulsi', 'Aniket', 'Ishika', 'Tanish'],
  HVAC: ['Googli', 'Rutin', 'Danish', 'Doremi', 'Shubham'],
  'GAS-CHEM': ['Dev', 'Mohjeet'],
  UPW: ['Ajeeth', 'Manisha'],
  ELECTRICAL: ['Akhilesh', 'Nitikesh', 'Prany'],
}
const TEAMS = Object.keys(ROSTER)

const TEAM_META = {
  FMCS: { sub: 'Facility Monitoring & Control', icon: 'gauge', color: '#2B6CB0' },
  HVAC: { sub: 'Heating, Ventilation & AC', icon: 'wind', color: '#D9A824' },
  'GAS-CHEM': { sub: 'Gas & Chemical Delivery', icon: 'flask', color: '#7C5CBF' },
  UPW: { sub: 'Ultra-Pure Water', icon: 'droplet', color: '#1F9E9E' },
  ELECTRICAL: { sub: 'Electrical Systems', icon: 'bolt', color: '#C1443C' },
}

const STAGES = [
  { label: 'Open', color: 'bg-white/30' },
  { label: 'In Progress', color: 'bg-accent-blue' },
  { label: 'Ready to Close', color: 'bg-accent-amber' },
  { label: 'Closed', color: 'bg-accent-green' },
]

function WaferGrid({ className = '', dot = '#FFFFFF', opacity = 'opacity-[0.08]' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${opacity} ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`,
        backgroundSize: '18px 18px',
      }}
    />
  )
}

function TeamIcon({ type, className }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'gauge') return (
    <svg {...common}><path d="M12 12l4-3" /><circle cx="12" cy="12" r="8" /><path d="M8 15a5 5 0 0 1 8 0" /></svg>
  )
  if (type === 'wind') return (
    <svg {...common}><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 18h8" /></svg>
  )
  if (type === 'flask') return (
    <svg {...common}><path d="M9 3h6" /><path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" /><path d="M8 15h8" /></svg>
  )
  if (type === 'droplet') return (
    <svg {...common}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
  )
  if (type === 'bolt') return (
    <svg {...common}><path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" /></svg>
  )
  return null
}

export default function Login({ onLogin, onBack }) {
  const [step, setStep] = useState('team') // 'team' | 'name'
  const [team, setTeam] = useState(null)

  function pickTeam(t) {
    setTeam(t)
    setStep('name')
  }

  function pickName(n) {
    onLogin({ name: n, team })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-sans">
      {/* Left branding panel */}
      <div className="relative bg-ink text-white hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <WaferGrid />
        <button
          onClick={onBack}
          className="relative font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1 w-fit"
        >
          ← Back
        </button>

        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-3">
            Tata Electronics · Dholera Fab
          </p>
          <h1 className="text-6xl font-bold tracking-tight">
            ETCH<span className="text-accent-blue">.</span>
          </h1>
          <p className="text-white/60 text-lg mt-4 max-w-sm">
            Nothing logged here fades or gets forgotten.
          </p>

          <div className="mt-12 flex items-center gap-2 max-w-sm">
            {STAGES.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <div className={`h-1.5 rounded-sm ${s.color}`} />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mt-2">
                    {s.label}
                  </p>
                </div>
                {i < STAGES.length - 1 && <span className="text-white/20 pb-4">→</span>}
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[11px] text-white/40">
          One Team · One Dream  · One Semi   
        </p>
      </div>

      {/* Right panel */}
      <div className="relative bg-canvas flex items-center justify-center px-6 py-16 overflow-hidden">
        <WaferGrid dot="#14181C" opacity="opacity-[0.04]" />
        <div className="lg:hidden absolute top-6 left-6">
          <button
            onClick={onBack}
            className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink flex items-center gap-1"
          >
            ← Back
          </button>
        </div>

        <div className="relative w-full max-w-md">
          {step === 'team' && (
            <>
              <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-2">Sign In</p>
              <h2 className="text-3xl font-semibold text-ink mb-1">Select your system</h2>
              <p className="text-sm text-ink-muted mb-8">Choose the utility team you're part of.</p>
              <div className="grid grid-cols-2 gap-3">
                {TEAMS.map((t) => {
                  const meta = TEAM_META[t]
                  return (
                    <button
                      key={t}
                      onClick={() => pickTeam(t)}
                      className="group relative border rounded-xl bg-surface p-4 text-left transition-colors overflow-hidden"
                      style={{ borderColor: '#E1E5EA' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = meta.color)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E1E5EA')}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                        style={{ backgroundColor: meta.color, color: '#FFFFFF' }}
                      >
                        <TeamIcon type={meta.icon} className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                        {ROSTER[t].length} members
                      </p>
                      <p className="font-semibold" style={{ color: meta.color }}>{t}</p>
                      <p className="text-xs text-ink-muted mt-0.5 leading-snug">{meta.sub}</p>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 'name' && (
            <>
              <button
                onClick={() => setStep('team')}
                className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1"
              >
                ← Change team
              </button>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: TEAM_META[team].color, color: '#FFFFFF' }}
                >
                  <TeamIcon type={TEAM_META[team].icon} className="w-4 h-4" />
                </div>
                <p className="font-mono text-xs uppercase tracking-wider" style={{ color: TEAM_META[team].color }}>{team}</p>
              </div>
              <h2 className="text-3xl font-semibold text-ink mb-8">Who's logging in?</h2>
              <div className="grid grid-cols-2 gap-3">
                {ROSTER[team].map((n) => (
                  <button
                    key={n}
                    onClick={() => pickName(n)}
                    className="border rounded-xl bg-surface p-4 text-left transition-colors font-medium text-ink"
                    style={{ borderColor: '#E1E5EA' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = TEAM_META[team].color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E1E5EA')}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}          