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
  open: { bar: 'bg-ink-muted', badge: 'bg-line text-ink-muted' },
  in_progress: { bar: 'bg-accent-blue', badge: 'bg-accent-blue/10 text-accent-blue' },
  ready_to_close: { bar: 'bg-accent-amber', badge: 'bg-accent-amber/10 text-accent-amber' },
  closed: { bar: 'bg-accent-green', badge: 'bg-accent-green/10 text-accent-green' },
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

function StatTile({ label, value, tone }) {
  return (
    <div className="flex-1 min-w-[110px] border border-line rounded-lg bg-surface px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`font-mono text-2xl font-medium mt-1 ${tone}`}>{value}</p>
    </div>
  )
}

export default function Tracker({ user, onLogout }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [showForm, setShowForm] = useState(false)
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
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    const { error } = await supabase.from('action_items').insert([form])
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '' })
    setShowForm(false)
    loadItems()
  }

  async function advanceStatus(item) {
    let next = item.status
    let extra = {}
    if (item.status === 'open') next = 'in_progress'
    else if (item.status === 'in_progress') next = 'ready_to_close'
    else if (item.status === 'ready_to_close') {
      const verifier = window.prompt('Verifier name (person confirming this is actually done):')
      if (!verifier) return
      const note = window.prompt('Closure note / evidence (what confirms this is complete):') || ''
      next = 'closed'
      extra = { verified_by: verifier, verified_at: new Date().toISOString(), closure_note: note }
    } else return

    const { error } = await supabase.from('action_items').update({ status: next, ...extra }).eq('id', item.id)
    if (error) setError(error.message)
    else loadItems()
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
      <div className="relative border-b border-line bg-surface overflow-hidden">
        <WaferGrid />
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1"> One Team One Dream </p>    
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

          <div className="flex gap-3 mt-6 flex-wrap">
            <StatTile label="Open" value={counts.open} tone="text-ink" />
            <StatTile label="In Progress" value={counts.in_progress} tone="text-accent-blue" />
            <StatTile label="Awaiting Verify" value={counts.ready_to_close} tone="text-accent-amber" />
            <StatTile label="Closed" value={counts.closed} tone="text-accent-green" />
            <StatTile label="Overdue" value={counts.overdue} tone="text-accent-red" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 mb-4 text-sm font-mono">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-surface border border-line rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Title</label>
              <input required className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-2">
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
            <button type="submit" className="bg-accent-blue text-white rounded-md p-2.5 col-span-2 font-medium hover:bg-accent-blue/90 transition-colors">
              Log Action Item
            </button>
          </form>
        )}

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
              return (
                <div
                  key={item.id}
                  className={`bg-surface border rounded-xl p-4 pl-5 flex justify-between items-center gap-4 border-l-4 ${
                    overdue ? 'border-l-accent-red border-line' : 'border-l-transparent border-line'
                  }`}
                >
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
                    {item.status === 'closed' && (
                      <p className="text-xs text-accent-green mt-1">
                        Verified by {item.verified_by} — {item.closure_note}
                      </p>
                    )}
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}           