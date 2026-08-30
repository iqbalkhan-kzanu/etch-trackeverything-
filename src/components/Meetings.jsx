import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

// ---------------------------------------------------------------------------
// Design tokens for this page. The rest of the app already defines surface /
// canvas / ink / ink-muted / line / accent-blue / accent-red as Tailwind
// color tokens — those are reused everywhere below for consistency. The two
// "ink" colors here are new and specific to the stamp/ledger motif.
// ---------------------------------------------------------------------------
const STATUS = {
  scheduled: { label: 'Upcoming', ink: '#3B4C8C', wash: '#3B4C8C14', ring: '#3B4C8C40' },
  completed: { label: 'Logged', ink: '#2F6B4F', wash: '#2F6B4F14', ring: '#2F6B4F40' },
}

const AVATAR_INK = ['#3B4C8C', '#2F6B4F', '#9C4B2E', '#6B4C9C', '#2E7C8C', '#8C5A2E']

function fonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .ms-display { font-family: 'Fraunces', ui-serif, serif; letter-spacing: -0.01em; }
      .ms-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      .ms-stamp {
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        border-style: double;
        border-width: 3px;
        transform: rotate(-9deg);
      }
      .ms-notch {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
      }
    `}</style>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatShort(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function monthLabel(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function daysUntil(d) {
  const today = new Date(new Date().toDateString())
  const target = new Date(new Date(d).toDateString())
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}
function inkFor(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_INK.length
  return AVATAR_INK[hash]
}

function StatChip({ value, label }) {
  return (
    <div className="relative rounded-lg border border-line bg-surface px-4 py-2.5 shrink-0">
      <div className="ms-mono text-2xl leading-none text-ink font-semibold">{value}</div>
      <div className="ms-mono text-[10px] uppercase tracking-wider text-ink-muted mt-1">{label}</div>
    </div>
  )
}

function StampZone({ status, meetingDate }) {
  const s = STATUS[status] || STATUS.scheduled
  return (
    <div
      className="relative flex sm:flex-col flex-row items-center justify-center gap-3 py-3 px-4 sm:py-5 sm:px-3
                 sm:w-[104px] w-full shrink-0 border-b sm:border-b-0 sm:border-r border-dashed border-line"
    >
      {/* punch-hole notches on the divider, canvas-colored to read as "cut through" */}
      <span className="ms-notch bg-canvas border border-line hidden sm:block" style={{ right: '-7px', top: '-7px' }} />
      <span className="ms-notch bg-canvas border border-line hidden sm:block" style={{ right: '-7px', bottom: '-7px' }} />

      {status === 'completed' ? (
        <div
          className="ms-stamp rounded-full w-16 h-16 flex flex-col items-center justify-center text-center shrink-0"
          style={{ borderColor: s.ink, color: s.ink }}
        >
          <span className="text-[9px] uppercase tracking-wider font-semibold leading-none">Logged</span>
          <span className="text-[9px] leading-none mt-1">{formatShort(meetingDate)}</span>
        </div>
      ) : (
        <div className="flex sm:flex-col flex-row items-center gap-2 sm:gap-1 text-center">
          <span
            className="ms-mono text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded"
            style={{ color: s.ink, backgroundColor: s.wash }}
          >
            {s.label}
          </span>
          <span className="ms-mono text-xs text-ink-muted">
            {(() => {
              const n = daysUntil(meetingDate)
              if (n === 0) return 'Today'
              if (n === 1) return 'Tomorrow'
              if (n > 1) return `in ${n}d`
              return formatShort(meetingDate)
            })()}
          </span>
        </div>
      )}
    </div>
  )
}

function MeetingCard({ m, currentUserId, isFocused, onEditNotes }) {
  const s = STATUS[m.status] || STATUS.scheduled
  const canEdit = m.created_by === currentUserId || (Array.isArray(m.participants) && m.participants.some((p) => p.id === currentUserId))

  return (
    <div
      id={`meeting-${m.id}`}
      className={`flex flex-col sm:flex-row bg-surface border rounded-xl overflow-hidden shadow-sm transition-shadow ${
        isFocused ? 'border-accent-blue ring-2 ring-accent-blue/30' : 'border-line'
      }`}
    >
      <StampZone status={m.status} meetingDate={m.meeting_date} />

      <div className="flex-1 min-w-0 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="ms-display text-lg font-semibold text-ink truncate">{m.title}</h3>
            <p className="ms-mono text-xs text-ink-muted mt-1">
              {formatDate(m.meeting_date)}{m.location ? ` · ${m.location}` : ''} · logged by {m.created_by_name}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => onEditNotes(m)}
              className="ms-mono text-[11px] uppercase tracking-wide bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap shrink-0"
            >
              {m.notes ? 'Edit notes' : 'Add notes'}
            </button>
          )}
        </div>

        {m.notes ? (
          <p className="text-sm text-ink mt-3 leading-relaxed whitespace-pre-wrap">{m.notes}</p>
        ) : (
          <p className="text-sm text-ink-muted italic mt-3">No discussion notes yet.</p>
        )}

        {Array.isArray(m.participants) && m.participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-line/70">
            {m.participants.map((p, i) => (
              <span
                key={i}
                title={p.name}
                className="ms-mono text-[10px] font-medium w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: inkFor(p.id || p.name || String(i)) }}
              >
                {initials(p.name)}
              </span>
            ))}
            <span className="ms-mono text-[10px] text-ink-muted ml-1">
              {m.participants.length} {m.participants.length === 1 ? 'attendee' : 'attendees'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Meetings({ user, focusMeetingId, onFocusHandled }) {
  const [meetings, setMeetings] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('all')

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [location, setLocation] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [notesEditingId, setNotesEditingId] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')

  async function loadMeetings() {
    setLoading(true)
    const { data, error } = await supabase.from('meetings').select('*').order('meeting_date', { ascending: false })
    if (!error) setMeetings(data || [])
    setLoading(false)
  }

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('id, name, team')
    setProfiles(data || [])
  }

  useEffect(() => { loadMeetings(); loadProfiles() }, [])

  useEffect(() => {
    if (!focusMeetingId) return
    setTab('all')
    const el = document.getElementById(`meeting-${focusMeetingId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (onFocusHandled) onFocusHandled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMeetingId, meetings])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Give the meeting a title.'); return }
    if (!meetingDate) { setError('Pick a date.'); return }
    setSubmitting(true)

    const participants = selectedIds
      .map((id) => profiles.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, team: p.team }))

    const today = new Date(new Date().toDateString())
    const chosen = new Date(meetingDate)
    const status = chosen <= today ? 'completed' : 'scheduled'

    const { data, error: insertError } = await supabase.from('meetings').insert([{
      title: title.trim(),
      notes: notes.trim() || null,
      meeting_date: meetingDate,
      location: location.trim() || null,
      created_by: user?.id,
      created_by_name: user?.name || 'Unknown',
      participants,
      status,
    }]).select()

    if (insertError) { setError(insertError.message); setSubmitting(false); return }

    // Future-dated meetings notify every added participant (except the creator).
    if (status === 'scheduled' && data && data[0]) {
      for (const p of participants) {
        if (p.id === user?.id) continue
        const { error: msgError } = await supabase.from('messages').insert([{
          sender_id: user?.id,
          recipient_id: p.id,
          body: `${user?.name} scheduled a meeting "${title.trim()}" on ${formatDate(meetingDate)}${location.trim() ? ` at ${location.trim()}` : ''}.`,
          meeting_id: data[0].id,
          target_nav: 'meetings',
        }])
        if (msgError) console.error('meeting notify failed:', msgError.message)
      }
    }

    setTitle('')
    setNotes('')
    setMeetingDate('')
    setLocation('')
    setSelectedIds([])
    setShowForm(false)
    setSubmitting(false)
    loadMeetings()
  }

  function isParticipant(m) {
    return m.created_by === user?.id || (Array.isArray(m.participants) && m.participants.some((p) => p.id === user?.id))
  }

  function openNotesEditor(m) {
    if (!isParticipant(m)) return
    setNotesEditingId(m.id)
    setNotesDraft(m.notes || '')
  }

  async function saveNotes(m) {
    if (!isParticipant(m)) return
    const text = notesDraft.trim()
    const { error } = await supabase.from('meetings').update({
      notes: text || null,
      status: 'completed',
    }).eq('id', m.id)
    if (error) { setError(error.message); return }
    setNotesEditingId(null)
    loadMeetings()
  }

  // "Meeting stamps" for this person — every meeting where they're either
  // the one who logged/scheduled it, or one of the added participants.
  const myMeetings = meetings.filter((m) =>
    m.created_by === user?.id || (Array.isArray(m.participants) && m.participants.some((p) => p.id === user?.id))
  )
  const filtered = tab === 'all' ? myMeetings : myMeetings.filter((m) => m.status === tab)

  const upcomingCount = myMeetings.filter((m) => m.status === 'scheduled').length
  const loggedCount = myMeetings.filter((m) => m.status === 'completed').length
  const soonCount = myMeetings.filter((m) => m.status === 'scheduled' && daysUntil(m.meeting_date) <= 7 && daysUntil(m.meeting_date) >= 0).length

  // Group into a real chronological timeline — the list is already sorted
  // by meeting_date desc from the query, so grouping preserves that order.
  const grouped = useMemo(() => {
    const map = new Map()
    for (const m of filtered) {
      const key = monthLabel(m.meeting_date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return Array.from(map.entries())
  }, [filtered])

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === key ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink border border-line bg-surface'
      }`}
    >
      {label}{count !== undefined ? <span className="ms-mono text-xs opacity-70"> ({count})</span> : ''}
    </button>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {fonts()}

      {/* Hero */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
        <div>
          <h1 className="ms-display text-3xl font-semibold text-ink">Meeting Stamps</h1>
          <p className="text-sm text-ink-muted mt-1.5 max-w-md">
            Every sync, logged or scheduled — your team's shared record of who met, when, and what got decided.
          </p>
        </div>
        <div className="flex gap-2">
          <StatChip value={upcomingCount} label="Upcoming" />
          <StatChip value={loggedCount} label="Logged" />
          <StatChip value={soonCount} label="This week" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex gap-2 flex-wrap">
          {tabBtn('all', 'All', myMeetings.length)}
          {tabBtn('scheduled', 'Upcoming', upcomingCount)}
          {tabBtn('completed', 'Logged', loggedCount)}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="ms-mono text-xs uppercase tracking-wide text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          style={{ backgroundColor: STATUS.scheduled.ink }}
        >
          {showForm ? 'Cancel' : '+ Log / schedule meeting'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6 mb-8 shadow-sm space-y-4">
          <p className="text-sm text-ink-muted">
            Pick today or a past date to log a meeting that already happened, or a future date to schedule one —
            everyone you add will see it in their own Meeting Stamps, and future meetings notify them right away.
          </p>
          <div>
            <label className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted">Meeting title</label>
            <input required className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="e.g. Weekly FMCS sync" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted">Date</label>
              <input required type="date" className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <label className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted">Location (optional)</label>
              <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                placeholder="e.g. Conference Room B" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted">What was discussed (leave blank if it hasn't happened yet)</label>
            <textarea rows={3} className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="Key points, decisions, action items…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="border border-line rounded-md p-3 bg-canvas">
            <p className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted mb-2">Add people to this meeting</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {profiles.filter((p) => p.id !== user?.id).map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-line/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                  />
                  <span
                    className="ms-mono text-[10px] font-medium w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: inkFor(p.id) }}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="text-sm text-ink truncate">{p.name}</span>
                  <span className="ms-mono text-[10px] text-ink-muted ml-auto shrink-0">{p.team}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full text-white rounded-md p-2.5 font-medium transition-colors disabled:opacity-60" style={{ backgroundColor: STATUS.scheduled.ink }}>
            {submitting ? 'Saving…' : 'Save meeting'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="ms-mono text-ink-muted text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-12 text-center bg-surface">
          <div className="ms-stamp mx-auto rounded-full w-14 h-14 flex items-center justify-center text-ink-muted border-ink-muted mb-4">
            <span className="text-[9px] uppercase tracking-wider">Empty</span>
          </div>
          <p className="ms-display text-lg text-ink font-medium">No meetings here yet.</p>
          <p className="text-ink-muted text-sm mt-1">Log a past meeting or schedule an upcoming one to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-muted shrink-0" />
                <span className="ms-mono text-[11px] uppercase tracking-wider text-ink-muted whitespace-nowrap">{month}</span>
                <span className="flex-1 border-t border-dashed border-line" />
              </div>
              <div className="space-y-4">
                {items.map((m) => (
                  notesEditingId === m.id ? (
                    <div key={m.id} className="bg-surface border border-line rounded-xl p-5 shadow-sm">
                      <p className="ms-display font-semibold text-ink mb-2">{m.title}</p>
                      <textarea
                        autoFocus
                        rows={3}
                        className="w-full border border-line rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                        placeholder="What was discussed…"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button onClick={() => setNotesEditingId(null)} className="ms-mono text-[11px] uppercase px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
                        <button onClick={() => saveNotes(m)} className="ms-mono text-[11px] uppercase px-3 py-1.5 rounded-md text-white font-medium" style={{ backgroundColor: STATUS.completed.ink }}>
                          Save notes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MeetingCard key={m.id} m={m} currentUserId={user?.id} isFocused={m.id === focusMeetingId} onEditNotes={openNotesEditor} />
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}     