import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Safety from './SafetySection'

const SOURCES = ['governance', 'audit', 'project', 'leadership_review', 'other']
const STAGES = ['open', 'in_progress', 'ready_to_close', 'closed']
const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  ready_to_close: 'Ready to Close',
  closed: 'Closed',
}
const STATUS_STYLES = {
  open: { bar: 'bg-ink-muted', badge: 'bg-line text-ink-muted', top: '#5C6670' },
  in_progress: { bar: 'bg-accent-blue', badge: 'bg-accent-blue/10 text-accent-blue', top: '#2B6CB0' },
  ready_to_close: { bar: 'bg-accent-amber', badge: 'bg-accent-amber/10 text-accent-amber', top: '#D98C2B' },
  closed: { bar: 'bg-accent-green', badge: 'bg-accent-green/10 text-accent-green', top: '#2F8F5B' },
}
const MENTOR_COLOR = '#7C5CBF'
const ACTION_META = {
  created: { label: 'Logged', color: '#5C6670' },
  advanced_to_in_progress: { label: 'Started progress', color: '#2B6CB0' },
  advanced_to_ready_to_close: { label: 'Marked ready to close', color: '#D98C2B' },
  verified_closed: { label: 'Verified & closed', color: '#2F8F5B' },
  mentor_comment: { label: 'Mentor commented', color: MENTOR_COLOR },
}
const VERIFIERS = {
  'Ramkumar': '12345',
  'Pramod Patil': '23451',
  'Dhanesh': 'abcde',
  'Ravi': '09090',
  'Cahal Smith': '898989',
}

function isOverdue(item) {
  return item.status !== 'closed' && new Date(item.deadline) < new Date(new Date().toDateString())
}

function nextActionLabel(status) {
  if (status === 'open') return 'Start Progress'
  if (status === 'in_progress') return 'Mark Ready to Close'
  if (status === 'ready_to_close') return 'Verify & Close'
  return null
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StageBar({ status }) {
  const idx = STAGES.indexOf(status)
  const color = STATUS_STYLES[status].bar
  return (
    <div className="flex gap-1 w-24 shrink-0">
      {STAGES.map((s, i) => (
        <div key={s} className={`h-1.5 flex-1 rounded-sm ${i <= idx ? color : 'bg-line'}`} />
      ))}
    </div>
  )
}

function WaferGrid({ className = '', dot = '#14181C', opacity = 'opacity-[0.05]' }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 ${opacity} ${className}`}
      style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: '20px 20px' }}
    />
  )
}

function StatTile({ label, value, topColor }) {
  return (
    <div className="relative border border-line rounded-xl bg-surface px-6 py-5 shadow-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: topColor }} />
      <p className="font-mono text-xs uppercase tracking-wider text-ink-muted mb-2">{label}</p>
      <p className="font-mono text-4xl font-semibold" style={{ color: topColor }}>{value}</p>
    </div>
  )
}

function Timeline({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-ink-muted font-mono py-2">No activity yet.</p>
  }
  return (
    <div className="pl-1 pt-3 pb-1">
      {entries.map((e, i) => {
        const meta = ACTION_META[e.action] || { label: e.action, color: '#5C6670' }
        const isLast = i === entries.length - 1
        return (
          <div key={e.id} className="relative pl-6 pb-4 last:pb-0">
            {!isLast && <div className="absolute left-[5px] top-3 bottom-0 w-px bg-line" />}
            <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-surface" style={{ backgroundColor: meta.color }} />
            <p className="text-sm font-medium text-ink">{meta.label}</p>
            <p className="font-mono text-[11px] text-ink-muted mt-0.5">{e.actor} · {formatTime(e.created_at)}</p>
            {e.note && <p className="text-xs text-ink-muted mt-1 italic">"{e.note}"</p>}
          </div>
        )
      })}
    </div>
  )
}

function ClosureModal({ item, onCancel, onConfirm }) {
  const [verifier, setVerifier] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!verifier) { setError('Select who is verifying this closure.'); return }
    if (VERIFIERS[verifier] !== password) { setError('Incorrect password for the selected verifier.'); return }
    setSubmitting(true)
    await onConfirm({ verifier, note })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-green" />
        <p className="font-mono text-xs uppercase tracking-wider text-accent-green mb-1">Authorized Closure</p>
        <h2 className="text-xl font-semibold text-ink mb-1">Verify & Close</h2>
        <p className="text-sm text-ink-muted mb-5">"{item.title}" — only designated verifiers can close this item.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Verifier</label>
            <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              value={verifier} onChange={(e) => setVerifier(e.target.value)}>
              <option value="">Select verifier…</option>
              {Object.keys(VERIFIERS).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Password</label>
            <input type="password" className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Closure note / evidence</label>
            <textarea className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="What confirms this is actually done?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-accent-green text-white rounded-md p-2.5 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
              {submitting ? 'Verifying…' : 'Confirm & Close'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OwnerStatusPanel({ items }) {
  const active = items.filter((i) => i.status !== 'closed')
  const byOwner = {}
  active.forEach((i) => {
    const key = i.owner_name || 'Unassigned'
    if (!byOwner[key]) byOwner[key] = { owner: key, onTime: 0, late: 0 }
    if (isOverdue(i)) byOwner[key].late += 1
    else byOwner[key].onTime += 1
  })
  const ownerStats = Object.values(byOwner).sort((a, b) => b.late - a.late || (b.onTime + b.late) - (a.onTime + a.late))
  const totalLate = ownerStats.reduce((sum, o) => sum + o.late, 0)
  const totalOnTime = ownerStats.reduce((sum, o) => sum + o.onTime, 0)

  return (
    <div className="lg:sticky lg:top-6 border border-line rounded-xl bg-surface p-5 shadow-sm h-fit">
      <p className="font-mono text-xs uppercase tracking-wider text-ink-muted mb-1">Team Status</p>
      <h3 className="text-lg font-semibold text-ink mb-1">On Time vs Late</h3>
      <div className="flex gap-3 mb-5">
        <span className="font-mono text-[11px] text-accent-green">{totalOnTime} on time</span>
        <span className="font-mono text-[11px] text-accent-red">{totalLate} late</span>
      </div>
      {ownerStats.length === 0 ? (
        <p className="text-sm text-ink-muted">No active items yet.</p>
      ) : (
        <div className="space-y-4">
          {ownerStats.map((o) => {
            const total = o.onTime + o.late
            return (
              <div key={o.owner}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium text-ink truncate">{o.owner}</span>
                  <span className="font-mono text-[10px] text-ink-muted shrink-0">{total} active</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-line">
                  {o.onTime > 0 && <div className="bg-accent-green" style={{ width: `${(o.onTime / total) * 100}%` }} />}
                  {o.late > 0 && <div className="bg-accent-red" style={{ width: `${(o.late / total) * 100}%` }} />}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono text-[10px] text-accent-green">{o.onTime} on time</span>
                  {o.late > 0 && <span className="font-mono text-[10px] text-accent-red">{o.late} late</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Tracker({ user, onLogout }) {
  const [items, setItems] = useState([])
  const [activity, setActivity] = useState({})
  const [expanded, setExpanded] = useState({})
  const [mentorEditing, setMentorEditing] = useState({})
  const [mentorDraft, setMentorDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nav, setNav] = useState('mine') // 'mine' | 'general' | 'team' | 'safety'
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [closingItem, setClosingItem] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team',
  })

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase.from('action_items').select('*').order('deadline', { ascending: true })
    if (error) setError(error.message)
    else setItems(data)

    const { data: logData, error: logError } = await supabase.from('item_activity').select('*').order('created_at', { ascending: true })
    if (!logError && logData) {
      const grouped = {}
      logData.forEach((row) => {
        if (!grouped[row.item_id]) grouped[row.item_id] = []
        grouped[row.item_id].push(row)
      })
      setActivity(grouped)
    }
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  function goTo(key) { setNav(key); setMobileNavOpen(false) }

  async function handleCreate(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('action_items').insert([form]).select()
    if (error) { setError(error.message); return }
    if (data && data[0]) {
      await supabase.from('item_activity').insert([{ item_id: data[0].id, actor: user?.name || 'Unknown', action: 'created', note: `Logged from ${form.source.replace('_', ' ')}` }])
    }
    setForm({ title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team' })
    setShowForm(false)
    loadItems()
  }

  async function advanceStatus(item) {
    if (item.status === 'ready_to_close') { setClosingItem(item); return }
    let next = item.status
    let actionKey = null
    if (item.status === 'open') { next = 'in_progress'; actionKey = 'advanced_to_in_progress' }
    else if (item.status === 'in_progress') { next = 'ready_to_close'; actionKey = 'advanced_to_ready_to_close' }
    else return
    const { error } = await supabase.from('action_items').update({ status: next }).eq('id', item.id)
    if (error) { setError(error.message); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: actionKey }])
    loadItems()
  }

  async function handleConfirmClosure({ verifier, note }) {
    const item = closingItem
    const { error } = await supabase.from('action_items').update({ status: 'closed', verified_by: verifier, verified_at: new Date().toISOString(), closure_note: note }).eq('id', item.id)
    if (error) { setError(error.message); setClosingItem(null); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: verifier, action: 'verified_closed', note }])
    setClosingItem(null)
    loadItems()
  }

  function toggleExpanded(id) { setExpanded((prev) => ({ ...prev, [id]: !prev[id] })) }

  function openMentorEditor(item) {
    setMentorDraft((prev) => ({ ...prev, [item.id]: item.mentor_comment || '' }))
    setMentorEditing((prev) => ({ ...prev, [item.id]: true }))
  }

  async function saveMentorComment(item) {
    const text = (mentorDraft[item.id] || '').trim()
    if (!text) return
    const { error } = await supabase.from('action_items').update({
      mentor_comment: text, mentor_by: user?.name || 'Unknown', mentor_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (error) { setError(error.message); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'mentor_comment', note: text }])
    setMentorEditing((prev) => ({ ...prev, [item.id]: false }))
    loadItems()
  }

  const scopedItems = items.filter((i) => {
    if (nav === 'mine') return i.owner_name === user?.name
    if (nav === 'general') return i.visibility === 'general'
    if (nav === 'team') return i.visibility !== 'general' && i.team === user?.team
    return true
  })

  const filtered = scopedItems.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterOwner && !i.owner_name.toLowerCase().includes(filterOwner.toLowerCase())) return false
    return true
  })

  const counts = {
    open: scopedItems.filter((i) => i.status === 'open').length,
    in_progress: scopedItems.filter((i) => i.status === 'in_progress').length,
    ready_to_close: scopedItems.filter((i) => i.status === 'ready_to_close').length,
    closed: scopedItems.filter((i) => i.status === 'closed').length,
    overdue: scopedItems.filter(isOverdue).length,
  }

  const navTitle = { mine: 'My Tasks', general: 'General', team: 'My Team', safety: 'Safety at Site' }[nav]

  const navItem = (key, label) => (
    <button
      onClick={() => goTo(key)}
      className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        nav === key ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen flex bg-canvas font-sans text-ink relative">
      <WaferGrid />
      {closingItem && <ClosureModal item={closingItem} onCancel={() => setClosingItem(null)} onConfirm={handleConfirmClosure} />}

      {mobileNavOpen && <div className="fixed inset-0 bg-ink/60 z-40 md:hidden" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`w-64 shrink-0 bg-ink text-white flex-col justify-between p-6 fixed md:sticky top-0 left-0 h-screen z-50 md:z-auto ${mobileNavOpen ? 'flex' : 'hidden'} md:flex`}>
        <div>
          <button onClick={() => setMobileNavOpen(false)} className="md:hidden font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white mb-6">✕ Close</button>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center font-bold text-sm shrink-0">E</div>
            <span className="text-lg font-bold tracking-tight">ETCH<span className="text-accent-blue">.</span></span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2 px-3.5">Navigate</p>
          <nav className="space-y-1">
            {navItem('mine', 'My Tasks')}
            {navItem('general', 'General')}
            {navItem('team', 'My Team')}
            {navItem('safety', 'Safety at Site')}
          </nav>
        </div>
        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">{user?.team}</p>
          <button onClick={onLogout} className="mt-3 font-mono text-[11px] uppercase tracking-wider text-white/50 hover:text-white transition-colors">Log Out</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 relative">
        <div className="border-b border-line bg-surface/95 backdrop-blur-sm px-6 md:px-10 py-6 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">ONE TEAM ONE DREAM ONE SEMI</p>   
            <h1 className="text-xl font-semibold text-ink">{navTitle}</h1>
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setMobileNavOpen(true)} className="border border-line rounded-md px-3 py-2 text-ink bg-surface">☰</button>
            <span className="text-sm font-medium text-ink">{user?.name}</span>
            <button onClick={onLogout} className="font-mono text-[11px] uppercase tracking-wider text-ink-muted border border-line rounded-md px-3 py-2">Log Out</button>
          </div>
          {nav !== 'safety' && (
            <button onClick={() => setShowForm((s) => !s)} className="bg-accent-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-blue/90 transition-colors">
              {showForm ? 'Cancel' : '+ New Action Item'}
            </button>
          )}
        </div>

        <div className="px-6 md:px-10 py-8 relative">
          {nav === 'safety' ? (
            <Safety user={user} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <StatTile label="Open" value={counts.open} topColor={STATUS_STYLES.open.top} />
                <StatTile label="In Progress" value={counts.in_progress} topColor={STATUS_STYLES.in_progress.top} />
                <StatTile label="Awaiting Verify" value={counts.ready_to_close} topColor={STATUS_STYLES.ready_to_close.top} />
                <StatTile label="Closed" value={counts.closed} topColor={STATUS_STYLES.closed.top} />
                <StatTile label="Overdue" value={counts.overdue} topColor="#C1443C" />
              </div>

              {error && <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 mb-4 text-sm font-mono">{error}</div>}

              {showForm && (
                <form onSubmit={handleCreate} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Title</label>
                    <input required className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Description</label>
                    <textarea className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Owner name</label>
                    <input required className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Team</label>
                    <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Source</label>
                    <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                      {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Deadline</label>
                    <input required type="date" className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Visibility</label>
                    <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                      <option value="team">My Team Only</option>
                      <option value="general">General — Visible to Everyone</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-accent-blue text-white rounded-md p-2.5 col-span-1 sm:col-span-2 font-medium hover:bg-accent-blue/90 transition-colors">
                    Log Action Item
                  </button>
                </form>
              )}

              <div className="flex gap-3 mb-5 flex-wrap">
                <select className="border border-line rounded-lg p-2.5 text-sm bg-surface shadow-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STAGES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <input placeholder="Filter by owner..." className="border border-line rounded-lg p-2.5 text-sm flex-1 min-w-[200px] bg-surface shadow-sm"
                  value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} />
              </div>

              <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
                <div>
                  {loading ? (
                    <p className="text-ink-muted font-mono text-sm">Loading action items…</p>
                  ) : (
                    <div className="space-y-3">
                      {scopedItems.length === 0 && (
                        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
                          <p className="text-ink font-medium">
                            {nav === 'general' ? 'No general items yet.' : nav === 'team' ? 'No team items yet.' : 'No action items logged yet.'}
                          </p>
                          <p className="text-ink-muted text-sm mt-1">Start by logging the first one from a review, audit, or project discussion.</p>
                        </div>
                      )}
                      {scopedItems.length > 0 && filtered.length === 0 && (
                        <p className="text-ink-muted text-sm py-6 text-center">No items match these filters.</p>
                      )}
                      {filtered.map((item) => {
                        const style = STATUS_STYLES[item.status]
                        const overdue = isOverdue(item)
                        const label = nextActionLabel(item.status)
                        const isOpen = !!expanded[item.id]
                        const entries = activity[item.id] || []
                        const isEditingMentor = !!mentorEditing[item.id]
                        return (
                          <div key={item.id} className={`bg-surface border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 ${overdue ? 'border-l-accent-red border-line' : 'border-l-transparent border-line'}`}>
                            <div className="flex justify-between items-center gap-4 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-ink">{item.title}</span>
                                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-line text-ink-muted">{item.source.replace('_', ' ')}</span>
                                  {item.visibility === 'general' && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue">General</span>
                                  )}
                                  {overdue && <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-red/10 text-accent-red">Overdue</span>}
                                </div>
                                <p className="text-sm text-ink-muted mt-0.5 font-mono">
                                  {item.owner_name} {item.team && `· ${item.team}`} · due {item.deadline}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="hidden sm:flex flex-col items-end gap-1">
                                  <span className={`font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${style.badge}`}>{STATUS_LABELS[item.status]}</span>
                                  <StageBar status={item.status} />
                                </div>
                                {label && (
                                  <button onClick={() => advanceStatus(item)} className="text-sm bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap">{label}</button>
                                )}
                                <button
                                  onClick={() => (isEditingMentor ? setMentorEditing((p) => ({ ...p, [item.id]: false })) : openMentorEditor(item))}
                                  className="font-mono text-[11px] uppercase tracking-wider rounded-md px-2.5 py-1.5 whitespace-nowrap border transition-colors"
                                  style={{ borderColor: MENTOR_COLOR, color: MENTOR_COLOR, backgroundColor: isEditingMentor ? `${MENTOR_COLOR}15` : 'transparent' }}
                                >
                                  Mentor {item.mentor_comment ? '💬' : ''}
                                </button>
                                <button onClick={() => toggleExpanded(item.id)} className="font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-accent-blue border border-line rounded-md px-2.5 py-1.5 whitespace-nowrap">
                                  {isOpen ? 'Hide' : 'Timeline'} ({entries.length})
                                </button>
                              </div>
                            </div>

                            {item.mentor_comment && !isEditingMentor && (
                              <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: `${MENTOR_COLOR}12`, borderLeft: `3px solid ${MENTOR_COLOR}` }}>
                                <p className="font-mono text-[10px] uppercase tracking-wider mb-0.5" style={{ color: MENTOR_COLOR }}>Mentor Comment — {item.mentor_by}</p>
                                <p className="text-ink">{item.mentor_comment}</p>
                              </div>
                            )}

                            {isEditingMentor && (
                              <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: `${MENTOR_COLOR}0D`, border: `1px solid ${MENTOR_COLOR}40` }}>
                                <textarea autoFocus rows={2} placeholder="Leave a comment on this item's progress…"
                                  className="w-full bg-surface border border-line rounded-md p-2 text-sm focus:outline-none focus:ring-2"
                                  value={mentorDraft[item.id] || ''} onChange={(e) => setMentorDraft((p) => ({ ...p, [item.id]: e.target.value }))} />
                                <div className="flex gap-2 mt-2 justify-end">
                                  <button onClick={() => setMentorEditing((p) => ({ ...p, [item.id]: false }))} className="text-xs px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
                                  <button onClick={() => saveMentorComment(item)} className="text-xs px-3 py-1.5 rounded-md text-white font-medium" style={{ backgroundColor: MENTOR_COLOR }}>Post Comment</button>
                                </div>
                              </div>
                            )}

                            {isOpen && (
                              <div className="border-t border-line mt-3">
                                <Timeline entries={entries} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <OwnerStatusPanel items={scopedItems} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}       