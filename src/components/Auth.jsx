import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const TEAMS = ['FMCS', 'HVAC', 'GAS-CHEM', 'UPW', 'ELECTRICAL']

const STAGES = [
  { label: 'Open', color: 'bg-white/30' },
  { label: 'In Progress', color: 'bg-accent-blue' },
  { label: 'Ready to Close', color: 'bg-accent-amber' },
  { label: 'Closed', color: 'bg-accent-green' },
]

function WaferGrid({ className = '', dot = '#FFFFFF' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 opacity-[0.08] ${className}`}
      style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: '18px 18px' }}
    />
  )
}

function MailIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function UserIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 6-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export default function Auth({ onAuthenticated, onBack }) {
  const [step, setStep] = useState('email') // 'email' | 'sent' | 'profile'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [team, setTeam] = useState(TEAMS[0])
  const [pendingId, setPendingId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If we land here after clicking the magic link (session exists but no profile yet),
  // skip straight to the profile step instead of asking for an email again.
  useEffect(() => {
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        if (profile) {
          onAuthenticated({ id: session.user.id, name: profile.name, team: profile.team, email: session.user.email })
        } else {
          setEmail(session.user.email)
          setPendingId(session.user.id)
          setStep('profile')
        }
      }
    }
    checkExisting()
  }, [])

  async function handleSendLink(e) {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('sent')
  }

  async function handleProfile(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase.from('profiles').insert([{ id: pendingId, name: name.trim(), team, email }])
    setLoading(false)
    if (error) { setError(error.message); return }
    onAuthenticated({ id: pendingId, name: name.trim(), team, email })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-sans">
      <div className="relative bg-ink text-white hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <WaferGrid />
        <button onClick={onBack} className="relative font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1 w-fit">← Back</button>
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-3">Tata Electronics · Dholera Fab</p>
          <h1 className="text-6xl font-bold tracking-tight">ETCH<span className="text-accent-blue">.</span></h1>
          <p className="text-white/60 text-lg mt-4 max-w-sm">Nothing logged here fades or gets forgotten.</p>
          <div className="mt-12 flex items-center gap-2 max-w-sm">
            {STAGES.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <div className={`h-1.5 rounded-sm ${s.color}`} />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mt-2">{s.label}</p>
                </div>
                {i < STAGES.length - 1 && <span className="text-white/20 pb-4">→</span>}
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-[11px] text-white/40">Open to the New Joinee Pilot</p>
      </div>

      <div className="relative bg-canvas flex items-center justify-center px-6 py-16 overflow-hidden">
        <WaferGrid dot="#14181C" />
        <div className="lg:hidden absolute top-6 left-6 z-10">
          <button onClick={onBack} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink flex items-center gap-1">← Back</button>
        </div>

        <div className="relative w-full max-w-sm">
          <div className="relative bg-surface border border-line rounded-2xl p-8 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-accent-blue" />

            {step === 'email' && (
              <>
                <div className="w-11 h-11 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-5">
                  <MailIcon className="w-5 h-5" />
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">Sign In</p>
                <h2 className="text-2xl font-semibold text-ink mb-1">Enter your email</h2>
                <p className="text-sm text-ink-muted mb-6">We'll email you a sign-in link — no password needed.</p>
                <form onSubmit={handleSendLink} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Email</label>
                    <div className="relative mt-1.5">
                      <MailIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required type="email" autoFocus className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-accent-blue text-white rounded-md p-3 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
                    {loading ? 'Sending link…' : 'Send Sign-In Link'}
                  </button>
                </form>
              </>
            )}

            {step === 'sent' && (
              <>
                <div className="w-11 h-11 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-5">
                  <MailIcon className="w-5 h-5" />
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">Check Your Inbox</p>
                <h2 className="text-2xl font-semibold text-ink mb-1">Link sent</h2>
                <p className="text-sm text-ink-muted mb-6">
                  We sent a sign-in link to <span className="text-ink font-medium">{email}</span>. Open your email and click it to continue — this tab will pick it up automatically.
                </p>
                <button onClick={() => { setStep('email'); setError('') }} className="w-full text-sm text-ink-muted hover:text-ink border border-line rounded-md p-2.5">
                  Use a different email
                </button>
              </>
            )}

            {step === 'profile' && (
              <>
                <div className="w-11 h-11 rounded-xl bg-accent-green/10 text-accent-green flex items-center justify-center mb-5">
                  <UserIcon className="w-5 h-5" />
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-accent-green mb-1">One More Step</p>
                <h2 className="text-2xl font-semibold text-ink mb-6">Complete your profile</h2>
                <form onSubmit={handleProfile} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Your Name</label>
                    <div className="relative mt-1.5">
                      <UserIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required autoFocus className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aniket Singh" />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Team</label>
                    <select className="w-full border border-line rounded-md p-3 mt-1.5 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={team} onChange={(e) => setTeam(e.target.value)}>
                      {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-accent-green text-white rounded-md p-3 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
                    {loading ? 'Saving…' : 'Enter ETCH'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}    