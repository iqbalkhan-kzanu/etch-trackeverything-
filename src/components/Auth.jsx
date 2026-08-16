import { useState } from 'react'
import { supabase } from '../supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const TEAM_META = {
  FMCS: { color: '#2B6CB0' },
  HVAC: { color: '#D9A824' },
  UPW: { color: '#1F9E9E' },
  ELECTRICAL: { color: '#C1443C' },
  'GAS & CHEMICAL': { color: '#7C5CBF' },
  HR: { color: '#C15A9E' },
  SAFETY: { color: '#E07B39' },
  MODULE: { color: '#5C6670' },
}
const TEAMS = Object.keys(TEAM_META)

const STAGES = [
  { label: 'Open', color: 'bg-white/30' },
  { label: 'In Progress', color: 'bg-accent-blue' },
  { label: 'Ready to Close', color: 'bg-accent-amber' },
  { label: 'Closed', color: 'bg-accent-green' },
]

// Screen -> accent + flow-step metadata. This is what lets every card borrow
// the landing page's "stage" language instead of inventing a new pattern.
const FLOWS = {
  login:          { accent: '#2B6CB0', steps: null },
  'signup-details':{ accent: '#2F8F5B', steps: ['Details', 'Verify', 'Password'], step: 0 },
  'signup-otp':    { accent: '#2B6CB0', steps: ['Details', 'Verify', 'Password'], step: 1 },
  'signup-password':{ accent: '#2F8F5B', steps: ['Details', 'Verify', 'Password'], step: 2 },
  'reset-email':   { accent: '#2B6CB0', steps: ['Email', 'Verify', 'New Password'], step: 0 },
  'reset-otp':     { accent: '#2B6CB0', steps: ['Email', 'Verify', 'New Password'], step: 1 },
  'reset-password':{ accent: '#2F8F5B', steps: ['Email', 'Verify', 'New Password'], step: 2 },
  choice: { accent: '#2B6CB0', steps: null },
}

function WaferGrid({ className = '', dot = '#FFFFFF', opacity = 'opacity-[0.08]' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${opacity} ${className}`}
      style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: '18px 18px' }} />
  )
}

// Small die-grid wafer icon, echoing the hero visual on the landing page.
// Doubles as the loading indicator: the beam sweeps while `spinning` is true.
function WaferBadge({ size = 40, spinning = false, accent = '#2B6CB0' }) {
  const dies = [
    [1, 0, '#2F8F5B'], [3, 0, '#D9A824'],
    [0, 1, '#2B6CB0'], [2, 1, '#1F9E9E'],
    [1, 2, '#D9A824'], [3, 2, '#2F8F5B'],
    [0, 3, '#1F9E9E'], [2, 3, '#2B6CB0'],
  ]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="20" r="19" fill="none" stroke="#E1E5EA" strokeWidth="1" />
        {dies.map(([x, y, c], i) => (
          <rect key={i} x={7 + x * 6.2} y={7 + y * 6.2} width="4.4" height="4.4" rx="0.6" fill={c} opacity="0.9" />
        ))}
      </svg>
      {spinning && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${accent}55 40deg, transparent 90deg)`,
            animation: 'etch-spin 1.1s linear infinite',
          }}
        />
      )}
    </div>
  )
}

function FlowSteps({ steps, step, accent }) {
  if (!steps) return null
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-sm bg-line overflow-hidden">
            <div
              className="h-full rounded-sm transition-all duration-500"
              style={{ width: i <= step ? '100%' : '0%', backgroundColor: accent }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center mt-2">
        {steps.map((label, i) => (
          <p key={label} className="flex-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: i <= step ? accent : '#9AA3AD' }}>
            {label}
          </p>
        ))}
      </div>
    </div>
  )
}

function MailIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>)
}
function UserIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 6-6 8-6s6.5 2 8 6" /></svg>)
}
function IdIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M13 10h6M13 14h4" /></svg>)
}
function KeyIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M10.5 12.5 20 3M17 6l3 3M14 9l2 2" /></svg>)
}
function LockIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>)
}
function ArrowIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>)
}
function ShieldIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>)
}

export default function Auth({ onAuthenticated, onBack }) {
  // screens: choice | login | signup-details | signup-otp | signup-password | reset-email | reset-otp | reset-password
  const [screen, setScreen] = useState('choice')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [team, setTeam] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [pendingUserId, setPendingUserId] = useState(null)
  const [pendingMeta, setPendingMeta] = useState(null)

  async function callFunction(fnName, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Something went wrong.')
    return data
  }

  function goTo(s) { setScreen(s); setError(''); setCode(''); setResendMsg('') }

  // ---- LOGIN (email + password) ----
  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
      if (!profile) throw new Error('Account found but profile is incomplete. Contact an admin.')
      onAuthenticated({ id: data.user.id, name: profile.name, team: profile.team, email: email.trim() })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ---- SIGNUP: details -> otp -> set password ----
  async function handleSignupDetails(e) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !employeeId.trim() || !team || !email.trim()) {
      setError('Please fill in every field.')
      return
    }
    setLoading(true)
    try {
      await callFunction('request-otp', { email: email.trim(), mode: 'signup', name, employeeId, team })
      goTo('signup-otp')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleSignupVerify(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
      if (error) throw error
      setPendingUserId(data.user.id)
      setPendingMeta(data.user.user_metadata || {})
      goTo('signup-password')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleSetSignupPassword(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password })
      if (pwError) throw pwError
      const meta = pendingMeta || {}
      await supabase.from('profiles').insert([{
        id: pendingUserId, name: meta.name, team: meta.team, employee_id: meta.employee_id, email: email.trim(),
      }])
      onAuthenticated({ id: pendingUserId, name: meta.name, team: meta.team, email: email.trim() })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ---- FORGOT PASSWORD: email -> otp -> new password ----
  async function handleResetRequest(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your email.'); return }
    setLoading(true)
    try {
      await callFunction('request-otp', { email: email.trim(), mode: 'reset' })
      goTo('reset-otp')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleResetVerify(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
      if (error) throw error
      setPendingUserId(data.user.id)
      goTo('reset-password')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleSetNewPassword(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password })
      if (pwError) throw pwError
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', pendingUserId).maybeSingle()
      onAuthenticated({ id: pendingUserId, name: profile?.name, team: profile?.team, email: email.trim() })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ---- Resend code (reuses request-otp, no new backend surface) ----
  async function handleResend() {
    setResendMsg('')
    setError('')
    setResending(true)
    try {
      if (screen === 'signup-otp') {
        await callFunction('request-otp', { email: email.trim(), mode: 'signup', name, employeeId, team })
      } else {
        await callFunction('request-otp', { email: email.trim(), mode: 'reset' })
      }
      setResendMsg('New code sent.')
    } catch (err) {
      setError(err.message)
    }
    setResending(false)
  }

  const flow = FLOWS[screen] || FLOWS.choice

  const cardHeader = (icon, eyebrow, title, subtitle) => (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${flow.accent}1A`, color: flow.accent }}>{icon}</div>
        <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: flow.accent }}>{eyebrow}</p>
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted mt-1.5">{subtitle}</p>}
      </div>
      <WaferBadge spinning={loading} accent={flow.accent} />
    </div>
  )

  const submitBtn = (label, loadingLabel, colorClass) => (
    <button type="submit" disabled={loading}
      className={`w-full ${colorClass} text-white rounded-md p-3 font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group`}>
      {loading ? loadingLabel : (
        <>
          {label}
          <ArrowIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  )

  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-sans">
      <style>{`@keyframes etch-spin { to { transform: rotate(360deg); } }`}</style>

      {/* LEFT — brand / fab identity panel, same language as the landing hero */}
      <div className="relative bg-ink text-white hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <WaferGrid />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #2B6CB0 0%, transparent 70%)' }} />

        <div className="relative flex items-center justify-between">
          <button onClick={onBack} className="font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1 w-fit transition-colors">← Back</button>
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 flex items-center gap-1.5">
            <ShieldIcon className="w-3.5 h-3.5" /> Secure Channel
          </p>
        </div>

        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-3">Tata Electronics · Dholera Fab</p>
          <h1 className="text-6xl font-bold tracking-tight">ETCH<span className="text-accent-blue">.</span></h1>
          <p className="text-white/60 text-lg mt-4 max-w-sm">
            {screen === 'choice' && 'Nothing logged here fades or gets forgotten.'}
            {screen === 'login' && 'One identity, every bay on the floor.'}
            {(screen === 'signup-details' || screen === 'signup-otp' || screen === 'signup-password') && 'Get provisioned once. Traced ever after.'}
            {(screen === 'reset-email' || screen === 'reset-otp' || screen === 'reset-password') && 'Access recovery, verified line by line.'}
          </p>

          <div className="mt-10 flex items-center gap-3">
            <WaferBadge size={44} spinning={loading} accent={flow.accent} />
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 leading-relaxed">
              Identity Gateway<br />Session · {screen === 'choice' ? 'Idle' : loading ? 'Verifying' : 'Awaiting Input'}
            </p>
          </div>

          <div className="mt-10 flex items-center gap-2 max-w-sm">
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
        <p className="relative font-mono text-[11px] text-white/40">New Joinee Pilot · 8 Teams</p>
      </div>

      {/* RIGHT — auth card */}
      <div className="relative bg-canvas flex items-center justify-center px-6 py-16 overflow-hidden">
        <WaferGrid dot="#14181C" opacity="opacity-[0.04]" />
        <div className="lg:hidden absolute top-6 left-6 z-10">
          <button onClick={onBack} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink flex items-center gap-1">← Back</button>
        </div>

        <div className="relative w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-ink">ETCH<span style={{ color: flow.accent }}>.</span></h1>
          </div>

          <div className="relative bg-surface border border-line rounded-2xl p-8 shadow-lg overflow-hidden transition-colors"
            style={{ boxShadow: `0 20px 40px -20px ${flow.accent}33` }}>
            <div className="absolute top-0 left-0 right-0 h-1 transition-colors duration-500" style={{ backgroundColor: flow.accent }} />

            {screen === 'choice' && (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">Welcome</p>
                <h2 className="text-2xl font-semibold text-ink mb-1">Do you already have an account?</h2>
                <p className="text-sm text-ink-muted mb-6">Every login is tied to your employee ID and team.</p>
                <div className="space-y-3">
                  <button onClick={() => goTo('login')} className="w-full flex items-center justify-between border border-line rounded-xl p-4 hover:border-accent-blue hover:bg-accent-blue/5 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0"><MailIcon className="w-4 h-4" /></div>
                      <div><p className="font-medium text-ink">I have an account</p><p className="text-xs text-ink-muted mt-0.5">Sign in with email and password</p></div>
                    </div>
                    <ArrowIcon className="w-4 h-4 text-ink-muted group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button onClick={() => goTo('signup-details')} className="w-full flex items-center justify-between border border-line rounded-xl p-4 hover:border-accent-green hover:bg-accent-green/5 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0"><UserIcon className="w-4 h-4" /></div>
                      <div><p className="font-medium text-ink">Create a new account</p><p className="text-xs text-ink-muted mt-0.5">First time here — set up your profile</p></div>
                    </div>
                    <ArrowIcon className="w-4 h-4 text-ink-muted group-hover:text-accent-green group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </>
            )}

            {screen === 'login' && (
              <>
                <button onClick={() => goTo('choice')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<MailIcon className="w-5 h-5" />, 'Sign In', 'Welcome back', null)}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Email</label>
                    <div className="relative mt-1.5">
                      <MailIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required type="email" autoFocus className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Password</label>
                    <div className="relative mt-1.5">
                      <LockIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required type="password" className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {submitBtn('Sign In', 'Signing in…', 'bg-accent-blue hover:bg-accent-blue/90')}
                  <button type="button" onClick={() => goTo('reset-email')} className="w-full text-sm text-ink-muted hover:text-ink">
                    Forgot password?
                  </button>
                </form>
              </>
            )}

            {screen === 'signup-details' && (
              <>
                <button onClick={() => goTo('choice')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<UserIcon className="w-5 h-5" />, 'Create Account', 'Set up your profile', null)}
                <form onSubmit={handleSignupDetails} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Full Name</label>
                    <div className="relative mt-1.5">
                      <UserIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required autoFocus className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                        value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aniket Singh" />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Employee ID</label>
                    <div className="relative mt-1.5">
                      <IdIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                        value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. TE-04521" />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Team</label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {TEAMS.map((t) => (
                        <button type="button" key={t} onClick={() => setTeam(t)} className="flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-md border transition-colors text-left"
                          style={team === t ? { borderColor: TEAM_META[t].color, backgroundColor: `${TEAM_META[t].color}15`, color: TEAM_META[t].color } : { borderColor: '#E1E5EA', color: '#14181C' }}>
                          <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: TEAM_META[t].color }} />
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Email</label>
                    <div className="relative mt-1.5">
                      <MailIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required type="email" className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {submitBtn('Send Verification Code', 'Sending code…', 'bg-accent-green hover:bg-accent-green/90')}
                </form>
              </>
            )}

            {screen === 'signup-otp' && (
              <>
                <button onClick={() => goTo('signup-details')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<KeyIcon className="w-5 h-5" />, 'Verify', 'Enter the code', `Sent to ${email}. Check your inbox.`)}
                <form onSubmit={handleSignupVerify} className="space-y-4">
                  <input required autoFocus inputMode="numeric" maxLength={10}
                    className="w-full border border-line rounded-md p-3 bg-canvas text-center text-xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="00000000" />
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {resendMsg && <p className="text-sm text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-md px-3 py-2">{resendMsg}</p>}
                  {submitBtn('Verify & Continue', 'Verifying…', 'bg-accent-blue hover:bg-accent-blue/90')}
                  <button type="button" onClick={handleResend} disabled={resending} className="w-full text-sm text-ink-muted hover:text-ink disabled:opacity-60">
                    {resending ? 'Resending…' : "Didn't get it? Resend code"}
                  </button>
                </form>
              </>
            )}

            {screen === 'signup-password' && (
              <>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<LockIcon className="w-5 h-5" />, 'Last Step', 'Create a password', null)}
                <form onSubmit={handleSetSignupPassword} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Password</label>
                    <input required autoFocus type="password" minLength={6} className="w-full border border-line rounded-md p-3 mt-1.5 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Confirm Password</label>
                    <input required type="password" className="w-full border border-line rounded-md p-3 mt-1.5 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {submitBtn('Finish & Enter ETCH', 'Saving…', 'bg-accent-green hover:bg-accent-green/90')}
                </form>
              </>
            )}

            {screen === 'reset-email' && (
              <>
                <button onClick={() => goTo('login')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<MailIcon className="w-5 h-5" />, 'Reset Password', 'Enter your email', null)}
                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Email</label>
                    <div className="relative mt-1.5">
                      <MailIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input required type="email" autoFocus className="w-full border border-line rounded-md p-3 pl-10 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {submitBtn('Send Verification Code', 'Sending code…', 'bg-accent-blue hover:bg-accent-blue/90')}
                </form>
              </>
            )}

            {screen === 'reset-otp' && (
              <>
                <button onClick={() => goTo('reset-email')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<KeyIcon className="w-5 h-5" />, 'Verify', 'Enter the code', `Sent to ${email}. Check your inbox.`)}
                <form onSubmit={handleResetVerify} className="space-y-4">
                  <input required autoFocus inputMode="numeric" maxLength={10}
                    className="w-full border border-line rounded-md p-3 bg-canvas text-center text-xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="00000000" />
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {resendMsg && <p className="text-sm text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-md px-3 py-2">{resendMsg}</p>}
                  {submitBtn('Verify & Continue', 'Verifying…', 'bg-accent-blue hover:bg-accent-blue/90')}
                  <button type="button" onClick={handleResend} disabled={resending} className="w-full text-sm text-ink-muted hover:text-ink disabled:opacity-60">
                    {resending ? 'Resending…' : "Didn't get it? Resend code"}
                  </button>
                </form>
              </>
            )}

            {screen === 'reset-password' && (
              <>
                <FlowSteps steps={flow.steps} step={flow.step} accent={flow.accent} />
                {cardHeader(<LockIcon className="w-5 h-5" />, 'Last Step', 'Set a new password', null)}
                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">New Password</label>
                    <input required autoFocus type="password" minLength={6} className="w-full border border-line rounded-md p-3 mt-1.5 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Confirm New Password</label>
                    <input required type="password" className="w-full border border-line rounded-md p-3 mt-1.5 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  {submitBtn('Save & Enter ETCH', 'Saving…', 'bg-accent-green hover:bg-accent-green/90')}
                </form>
              </>
            )}
          </div>

          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-ink-muted/60 mt-5 flex items-center justify-center gap-1.5">
            <ShieldIcon className="w-3 h-3" /> Encrypted Session · ETCH Identity Gateway
          </p>
        </div>
      </div>
    </div>
  )
}      