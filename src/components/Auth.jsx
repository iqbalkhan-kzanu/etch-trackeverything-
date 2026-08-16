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

function WaferGrid({ className = '', dot = '#FFFFFF', opacity = 'opacity-[0.08]' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${opacity} ${className}`}
      style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: '18px 18px' }} />
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

  function goTo(s) { setScreen(s); setError(''); setCode('') }

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

  const cardHeader = (icon, eyebrow, eyebrowColor, title) => (
    <>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${eyebrowColor}1A`, color: eyebrowColor }}>{icon}</div>
      <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: eyebrowColor }}>{eyebrow}</p>
      <h2 className="text-2xl font-semibold text-ink mb-6">{title}</h2>
    </>
  )

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
        <p className="relative font-mono text-[11px] text-white/40">New Joinee Pilot · 8 Teams</p>
      </div>

      <div className="relative bg-canvas flex items-center justify-center px-6 py-16 overflow-hidden">
        <WaferGrid dot="#14181C" opacity="opacity-[0.04]" />
        <div className="lg:hidden absolute top-6 left-6 z-10">
          <button onClick={onBack} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink flex items-center gap-1">← Back</button>
        </div>

        <div className="relative w-full max-w-md">
          <div className="relative bg-surface border border-line rounded-2xl p-8 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-accent-blue" />

            {screen === 'choice' && (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">Welcome</p>
                <h2 className="text-2xl font-semibold text-ink mb-6">Do you already have an account?</h2>
                <div className="space-y-3">
                  <button onClick={() => goTo('login')} className="w-full flex items-center justify-between border border-line rounded-xl p-4 hover:border-accent-blue hover:bg-accent-blue/5 transition-colors text-left">
                    <div><p className="font-medium text-ink">I have an account</p><p className="text-xs text-ink-muted mt-0.5">Sign in with email and password</p></div>
                    <ArrowIcon className="w-4 h-4 text-ink-muted" />
                  </button>
                  <button onClick={() => goTo('signup-details')} className="w-full flex items-center justify-between border border-line rounded-xl p-4 hover:border-accent-green hover:bg-accent-green/5 transition-colors text-left">
                    <div><p className="font-medium text-ink">Create a new account</p><p className="text-xs text-ink-muted mt-0.5">First time here — set up your profile</p></div>
                    <ArrowIcon className="w-4 h-4 text-ink-muted" />
                  </button>
                </div>
              </>
            )}

            {screen === 'login' && (
              <>
                <button onClick={() => goTo('choice')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<MailIcon className="w-5 h-5" />, 'Sign In', '#2B6CB0', 'Welcome back')}
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
                  <button type="submit" disabled={loading} className="w-full bg-accent-blue text-white rounded-md p-3 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                  <button type="button" onClick={() => goTo('reset-email')} className="w-full text-sm text-ink-muted hover:text-ink">
                    Forgot password?
                  </button>
                </form>
              </>
            )}

            {screen === 'signup-details' && (
              <>
                <button onClick={() => goTo('choice')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<UserIcon className="w-5 h-5" />, 'Create Account', '#2F8F5B', 'Set up your profile')}
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
                        <button type="button" key={t} onClick={() => setTeam(t)} className="text-xs font-medium px-3 py-2.5 rounded-md border transition-colors text-left"
                          style={team === t ? { borderColor: TEAM_META[t].color, backgroundColor: `${TEAM_META[t].color}15`, color: TEAM_META[t].color } : { borderColor: '#E1E5EA', color: '#14181C' }}>
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
                  <button type="submit" disabled={loading} className="w-full bg-accent-green text-white rounded-md p-3 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
                    {loading ? 'Sending code…' : 'Send Verification Code'}
                  </button>
                </form>
              </>
            )}

            {screen === 'signup-otp' && (
              <>
                <button onClick={() => goTo('signup-details')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<KeyIcon className="w-5 h-5" />, 'Verify', '#2B6CB0', 'Enter the code')}
                <p className="text-sm text-ink-muted -mt-4 mb-6">Sent to {email}. Check your inbox.</p>
                <form onSubmit={handleSignupVerify} className="space-y-4">
                  <input required autoFocus inputMode="numeric" maxLength={10}
                    className="w-full border border-line rounded-md p-3 bg-canvas text-center text-xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="00000000" />
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-accent-blue text-white rounded-md p-3 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
                    {loading ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                </form>
              </>
            )}

            {screen === 'signup-password' && (
              <>
                {cardHeader(<LockIcon className="w-5 h-5" />, 'Last Step', '#2F8F5B', 'Create a password')}
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
                  <button type="submit" disabled={loading} className="w-full bg-accent-green text-white rounded-md p-3 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
                    {loading ? 'Saving…' : 'Finish & Enter ETCH'}
                  </button>
                </form>
              </>
            )}

            {screen === 'reset-email' && (
              <>
                <button onClick={() => goTo('login')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<MailIcon className="w-5 h-5" />, 'Reset Password', '#2B6CB0', 'Enter your email')}
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
                  <button type="submit" disabled={loading} className="w-full bg-accent-blue text-white rounded-md p-3 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
                    {loading ? 'Sending code…' : 'Send Verification Code'}
                  </button>
                </form>
              </>
            )}

            {screen === 'reset-otp' && (
              <>
                <button onClick={() => goTo('reset-email')} className="font-mono text-xs uppercase tracking-wider text-ink-muted hover:text-ink mb-4 flex items-center gap-1">← Back</button>
                {cardHeader(<KeyIcon className="w-5 h-5" />, 'Verify', '#2B6CB0', 'Enter the code')}
                <p className="text-sm text-ink-muted -mt-4 mb-6">Sent to {email}. Check your inbox.</p>
                <form onSubmit={handleResetVerify} className="space-y-4">
                  <input required autoFocus inputMode="numeric" maxLength={10}
                    className="w-full border border-line rounded-md p-3 bg-canvas text-center text-xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="00000000" />
                  {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-accent-blue text-white rounded-md p-3 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
                    {loading ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                </form>
              </>
            )}

            {screen === 'reset-password' && (
              <>
                {cardHeader(<LockIcon className="w-5 h-5" />, 'Last Step', '#2F8F5B', 'Set a new password')}
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
                  <button type="submit" disabled={loading} className="w-full bg-accent-green text-white rounded-md p-3 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
                    {loading ? 'Saving…' : 'Save & Enter ETCH'}
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