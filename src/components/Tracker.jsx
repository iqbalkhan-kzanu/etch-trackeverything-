import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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
const ACTION_META = {
  created: { label: 'Logged', color: '#5C6670' },
  advanced_to_in_progress: { label: 'Started progress', color: '#2B6CB0' },
  advanced_to_ready_to_close: { label: 'Marked ready to close', color: '#D98C2B' },
  verified_closed: { label: 'Verified & closed', color: '#2F8F5B' },
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

function StatTile({ label, value, topColor }) {
  return (
    <div className="relative border border-line rounded-xl bg-surface px-6 py-5 overflow-hidden">
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
    if (!verifier) {
      setError('Select who is verifying this closure.')
      return
    }
    if (VERIFIERS[verifier] !== password) {
      setError('Incorrect password for the selected verifier.')
      return
    }
    setSubmitting(true)
    await onConfirm({ verifier, note })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-green" />
        <p className="font-mono text-xs uppercase tracking-wider text-accent-green mb-1">Authorized Closure</p>
        <h2 className="text-xl font-semibold text-ink mb-1">Verify & Close</h2>
        <p className="text-sm text-ink-muted mb-5">
          "{item.title}" — only designated verifiers can close this item.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Verifier</label>
            <select
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              value={verifier}
              onChange={(e) => setVerifier(e.target.value)}
            >
              <option value="">Select verifier…</option>
              {Object.keys(VERIFIERS).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Password</label>
            <input
              type="password"
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Closure note / evidence</label>
            <textarea
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="What confirms this is actually done?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-accent-green text-white rounded-md p-2.5 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Verifying…' : 'Confirm & Close'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Tracker({ user, onLogout }) {
  const [items, setItems] = useState([])
  const [activity, setActivity] = useState({})
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [closingItem, setClosingItem] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    owner_name: user?.name || '',
    team: user?.team || '',
    source: 'project',
    deadline: '',
  })

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('action_items')
      .select('*')
      .order('deadline', { ascending: true })
    if (error) setError(error.message)
    else setItems(data)

    const { data: logData, error: logError } = await supabase
      .from('item_activity')
      .select('*')
      .order('created_at', { ascending: true })
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

  useEffect(() => {
    loadItems()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('action_items').insert([form]).select()
    if (error) {
      setError(error.message)
      return
    }
    if (data && data[0]) {
      await supabase.from('item_activity').insert([{
        item_id: data[0].id,
        actor: user?.name || 'Unknown',
        action: 'created',
        note: `Logged from ${form.source.replace('_', ' ')}`,
      }])
    }
    setForm({ title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '' })
    setShowForm(false)
    loadItems()
  }

  async function advanceStatus(item) {
    if (item.status === 'ready_to_close') {
      setClosingItem(item)
      return
    }
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
    const { error } = await supabase.from('action_items').update({
      status: 'closed',
      verified_by: verifier,
      verified_at: new Date().toISOString(),
      closure_note: note,
    }).eq('id', item.id)
    if (error) { setError(error.message); setClosingItem(null); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: verifier, action: 'verified_closed', note }])
    setClosingItem(null)
    loadItems()
  }

  function toggleExpanded(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filtered = items.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterOwner && !i.owner_name.toLowerCase().includes(filterOwner.toLowerCase())) return false
    return true
  })

  const counts = {
    open: items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    ready_to_close: items.filter((i) => i.status === 'ready_to_close').length,
    closed: items.filter((i) => i.status === 'closed').length,
    overdue: items.filter(isOverdue).length,
  }

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      {closingItem && (
        <ClosureModal
          item={closingItem}
          onCancel={() => setClosingItem(null)}
          onConfirm={handleConfirmClosure}
        />
      )}

      <div className="relative border-b border-line bg-surface overflow-hidden">
        <WaferGrid />
        <div className="relative max-w-[1400px] mx-auto px-8 lg:px-12 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">ONE TEAM ONE DREAM</p>       
              <h1 className="text-2xl font-semibold text-ink">ETCH</h1>
              <p className="text-ink-muted text-sm mt-1">Centralized log for governance, audit, project & leadership review actions</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-ink">{user?.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{user?.team}</p>
              </div>
              <button
                onClick={onLogout}
                className="font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-accent-red border border-line rounded-md px-3 py-2"
              >
                Log Out
              </button>
              <button
                onClick={() => setShowForm((s) => !s)}
                className="bg-ink text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-ink/90 transition-colors"
              >
                {showForm ? 'Cancel' : '+ New Action Item'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
            <StatTile label="Open" value={counts.open} topColor={STATUS_STYLES.open.top} />
            <StatTile label="In Progress" value={counts.in_progress} topColor={STATUS_STYLES.in_progress.top} />
            <StatTile label="Awaiting Verify" value={counts.ready_to_close} topColor={STATUS_STYLES.ready_to_close.top} />
            <StatTile label="Closed" value={counts.closed} topColor={STATUS_STYLES.closed.top} />
            <StatTile label="Overdue" value={counts.overdue} topColor="#C1443C" />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 lg:px-12 py-8">
        {error && (
          <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 mb-4 text-sm font-mono">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-surface border border-line rounded-xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <button type="submit" className="bg-accent-blue text-white rounded-md p-2.5 col-span-1 sm:col-span-2 font-medium hover:bg-accent-blue/90 transition-colors">
              Log Action Item
            </button>
          </form>
        )}

        <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFilterOwner(user?.name || '')}
              className={`font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-md border transition-colors ${
                filterOwner === (user?.name || '') && filterOwner !== ''
                  ? 'bg-accent-blue text-white border-accent-blue'
                  : 'border-line text-ink-muted hover:text-ink'
              }`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setFilterOwner('')}
              className={`font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-md border transition-colors ${
                filterOwner === '' ? 'bg-accent-blue text-white border-accent-blue' : 'border-line text-ink-muted hover:text-ink'
              }`}
            >
              All Items
            </button>
          </div>       

        <div className="flex gap-3 mb-4 flex-wrap">
          <select className="border border-line rounded-md p-2.5 text-sm bg-surface" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STAGES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <input placeholder="Filter by owner..." className="border border-line rounded-md p-2.5 text-sm flex-1 min-w-[200px] bg-surface"
            value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-ink-muted font-mono text-sm">Loading action items…</p>
        ) : (
          <div className="space-y-2">
            {items.length === 0 && (
              <div className="border border-dashed border-line rounded-xl p-10 text-center">
                <p className="text-ink font-medium">No action items logged yet.</p>
                <p className="text-ink-muted text-sm mt-1">Start by logging the first one from a review, audit, or project discussion.</p>
              </div>
            )}
            {items.length > 0 && filtered.length === 0 && (
              <p className="text-ink-muted text-sm py-6 text-center">No items match these filters.</p>
            )}
            {filtered.map((item) => {
              const style = STATUS_STYLES[item.status]
              const overdue = isOverdue(item)
              const label = nextActionLabel(item.status)
              const isOpen = !!expanded[item.id]
              const entries = activity[item.id] || []
              return (
                <div
                  key={item.id}
                  className={`bg-surface border rounded-xl p-4 pl-5 border-l-4 ${
                    overdue ? 'border-l-accent-red border-line' : 'border-l-transparent border-line'
                  }`}
                >
                  <div className="flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-ink">{item.title}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-line text-ink-muted">
                          {item.source.replace('_', ' ')}
                        </span>
                        {overdue && (
                          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-red/10 text-accent-red">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-muted mt-0.5 font-mono">
                        {item.owner_name} {item.team && `· ${item.team}`} · due {item.deadline}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className={`font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${style.badge}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        <StageBar status={item.status} /> 
                      </div>
                      {label && (
                        <button
                          onClick={() => advanceStatus(item)}
                          className="text-sm bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap"
                        >
                          {label}
                        </button>
                      )}
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className="font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-accent-blue border border-line rounded-md px-2.5 py-1.5 whitespace-nowrap"
                      >
                        {isOpen ? 'Hide' : 'Timeline'} ({entries.length})
                      </button>
                    </div>
                  </div>
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
    </div>
  )
}                 