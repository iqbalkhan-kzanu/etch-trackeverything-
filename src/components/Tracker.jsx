import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Safety from './SafetySection'
import Directory from './Directory' 
import ChatModal from './ChatModal'   
import AssignWorkModal from './AssignWorkModal'
import SendBackModal from './SendBackModal'
import SubmitForApprovalModal from './SubmitForApprovalModal'

const SOURCES = ['governance', 'audit', 'project', 'leadership_review', 'other']
const STAGES = ['open', 'in_progress', 'ready_to_close', 'pending_approval', 'closed']
const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  ready_to_close: 'Ready to Close',
  pending_approval: 'Pending Approval',
  closed: 'Closed',
}
const STATUS_STYLES = {
  open: { bar: 'bg-ink-muted', badge: 'bg-line text-ink-muted', top: '#5C6670' },
  in_progress: { bar: 'bg-accent-blue', badge: 'bg-accent-blue/10 text-accent-blue', top: '#2B6CB0' },
  ready_to_close: { bar: 'bg-accent-amber', badge: 'bg-accent-amber/10 text-accent-amber', top: '#D98C2B' },
  pending_approval: { bar: 'bg-[#7C5CBF]', badge: 'bg-[#7C5CBF]/10 text-[#7C5CBF]', top: '#7C5CBF' },
  closed: { bar: 'bg-accent-green', badge: 'bg-accent-green/10 text-accent-green', top: '#2F8F5B' },
}
const MENTOR_COLOR = '#7C5CBF'
const ACTION_META = {
  created: { label: 'Logged', color: '#5C6670' },
  advanced_to_in_progress: { label: 'Started progress', color: '#2B6CB0' },
  advanced_to_ready_to_close: { label: 'Marked ready to close', color: '#D98C2B' },
  submitted_for_approval: { label: 'Submitted for approval', color: '#7C5CBF' },
  approved_closed: { label: 'Approved & closed', color: '#2F8F5B' },
  sent_back: { label: 'Sent back for re-examination', color: '#C1443C' },
  mentor_comment: { label: 'Mentor commented', color: MENTOR_COLOR },
}

const SEVERITIES = ['low', 'medium', 'high', 'critical']
const SEVERITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
const SEVERITY_STYLES = {
  low: { badge: 'bg-line text-ink-muted', dot: '#5C6670' },
  medium: { badge: 'bg-accent-blue/10 text-accent-blue', dot: '#2B6CB0' },
  high: { badge: 'bg-accent-amber/10 text-accent-amber', dot: '#D98C2B' },
  critical: { badge: 'bg-accent-red/10 text-accent-red', dot: '#C1443C' },
}
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

function isOverdue(item) {
  return item.status !== 'closed' && new Date(item.deadline) < new Date(new Date().toDateString())
}

function nextActionLabel(status) {
  if (status === 'open') return 'Start Progress'
  if (status === 'in_progress') return 'Mark Ready to Close'
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
      className={`pointer-events-none fixed inset-0 ${className}`}
      style={{
        backgroundImage: `
          repeating-linear-gradient(90deg, rgba(43,108,176,0.07) 0px, rgba(43,108,176,0.07) 1px, transparent 1px, transparent 48px),
          repeating-linear-gradient(0deg, rgba(43,108,176,0.07) 0px, rgba(43,108,176,0.07) 1px, transparent 1px, transparent 48px),
          radial-gradient(circle at 24px 24px, rgba(20,24,28,0.10) 1.5px, transparent 0)
        `,
        backgroundSize: '48px 48px, 48px 48px, 48px 48px',
      }}
    />
  )
}      

// Neutral by default; only lights up (accent-red) when it's carrying an alert
// (currently: Overdue). Every other tile stays mono so the one that matters
// actually stands out instead of competing with five other hues.
function StatTile({ label, value, alert = false }) {
  const isAlert = alert && value > 0
  return (
    <div className="border border-line rounded-md bg-surface px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        {isAlert && <div className="w-1.5 h-1.5 rounded-full bg-accent-red" />}
      </div>
      <p className={`font-mono text-3xl font-semibold tabular-nums ${isAlert ? 'text-accent-red' : 'text-ink'}`}>
        {String(value).padStart(2, '0')}
      </p>
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

// Segmented indicator instead of a rounded pill split — reuses the same
// visual language as StageBar so the sidebar reads as part of the same
// system rather than a bolted-on widget.
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
    <div className="lg:sticky lg:top-6 border border-line rounded-md bg-surface p-5 h-fit">
      <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-line">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-1">Team Status</p>
          <h3 className="text-base font-semibold text-ink">On Time vs Late</h3>
        </div>
        <p className="font-mono text-xs">
          <span className="text-ink">{totalOnTime}</span>
          <span className="text-ink-muted">/{totalOnTime + totalLate}</span>
        </p>
      </div>

      {ownerStats.length === 0 ? (
        <p className="text-sm text-ink-muted">No active items yet.</p>
      ) : (
        <div className="space-y-4">
          {ownerStats.map((o) => {
            const total = o.onTime + o.late
            const segments = 8
            const lateSeg = Math.round((o.late / total) * segments)
            const onSeg = segments - lateSeg
            return (
              <div key={o.owner}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-ink truncate">{o.owner}</span>
                  <span className="font-mono text-[10px] text-ink-muted shrink-0">{total} active</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: segments }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1"
                      style={{ backgroundColor: i < onSeg ? '#2F8F5B' : '#C1443C' }}
                    />
                  ))}
                </div>
                {o.late > 0 && (
                  <p className="font-mono text-[10px] text-accent-red mt-1">{o.late} late</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function AnnouncementsPanel({ announcements, loading, user, draft, onDraftChange, onSubmit, posting }) {
  return (
    <div className="relative w-full border border-line rounded-xl bg-surface shadow-sm overflow-hidden mb-6">
      <div className="absolute top-0 left-0 right-0 h-1 bg-accent-blue" />

      <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">Announcements</h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted bg-line rounded px-2 py-0.5">
          {announcements.length} posted
        </span>
      </div>

      <form onSubmit={onSubmit} className="px-5 py-3.5 border-b border-line flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center text-[11px] font-semibold shrink-0">
          {getInitials(user?.name)}
        </div>
        <input
          type="text"
          placeholder="Share something with everyone…"
          className="flex-1 min-w-0 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
        />
        <button
          type="submit"
          disabled={posting || !draft.trim()}
          className="shrink-0 bg-accent-blue text-white text-sm px-4 py-2 rounded-md font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </form>

      <div className="max-h-56 overflow-y-auto divide-y divide-line">
        {loading ? (
          <p className="text-ink-muted font-mono text-xs px-5 py-4">Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <p className="text-ink-muted text-sm px-5 py-5 text-center">No announcements yet. Be the first to post one.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="px-5 py-3.5 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center text-[11px] font-semibold shrink-0">
                {getInitials(a.author_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink">{a.author_name}</span>
                  {a.author_team && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{a.author_team}</span>}
                  <span className="font-mono text-[10px] text-ink-muted">· {formatTime(a.created_at)}</span>
                </div>
                <p className="text-sm text-ink mt-0.5 leading-snug">{a.body}</p>
              </div>
            </div>
          ))
        )}
      </div>
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
  const [chatUser, setChatUser] = useState(null)    
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [sortBySeverity, setSortBySeverity] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sendingBackItem, setSendingBackItem] = useState(null)
  const [submittingItem, setSubmittingItem] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [assigningTo, setAssigningTo] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team', severity: 'medium',
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

  async function loadUnreadMessages() {
    if (!user?.id) return
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)
    if (!error) setUnreadMessages(count || 0)
  }

  async function loadAnnouncements() {
    setLoadingAnnouncements(true)
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error) setAnnouncements(data || [])
    setLoadingAnnouncements(false)
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault()
    const text = announcementDraft.trim()
    if (!text) return
    setPostingAnnouncement(true)
    const { error } = await supabase.from('announcements').insert([{
      author_id: user?.id, author_name: user?.name || 'Unknown', author_team: user?.team || null, body: text,
    }])
    if (error) setError(error.message)
    setAnnouncementDraft('')
    setPostingAnnouncement(false)
    loadAnnouncements()
  }

  useEffect(() => { loadItems(); loadAnnouncements() }, [])

  useEffect(() => {
    loadUnreadMessages()
    const interval = setInterval(loadUnreadMessages, 5000)
    return () => clearInterval(interval)
  }, [user?.id])

  function goTo(key) { setNav(key); setMobileNavOpen(false) }

  async function handleCreate(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('action_items').insert([form]).select()
    if (error) { setError(error.message); return }
    if (data && data[0]) {
      await supabase.from('item_activity').insert([{ item_id: data[0].id, actor: user?.name || 'Unknown', action: 'created', note: `Logged from ${form.source.replace('_', ' ')} · ${form.severity} severity` }])
    }
    setForm({ title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team', severity: 'medium' })
    setShowForm(false)
    loadItems()
  }

  async function advanceStatus(item) {
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

  // Owner submits a "ready to close" item for their team manager's approval,
  // attaching a completion note and any pictures/evidence.
  async function handleSubmitForApproval({ note, images }) {
    const item = submittingItem
    if (!item) return

    const { data: managerProfile, error: mgrError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('team', item.team)
      .eq('role', 'MANAGER')
      .maybeSingle()

    const { error } = await supabase.from('action_items')
      .update({
        status: 'pending_approval',
        closure_note: null,
        completion_note: note,
        completion_images: images,
      })
      .eq('id', item.id)
    if (error) { setError(error.message); setSubmittingItem(null); return }

    await supabase.from('item_activity').insert([{
      item_id: item.id, actor: user?.name || 'Unknown', action: 'submitted_for_approval', note,
    }])

    if (!mgrError && managerProfile) {
      await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: managerProfile.id,
        body: `${user?.name} submitted "${item.title}" for your approval (due ${item.deadline}).`,
      }])
    } else {
      setError(`Submitted, but no manager is set up for team "${item.team}" — they weren't notified.`)
    }

    setSubmittingItem(null)
    loadItems()
  }

  // Manager approves a pending item — closes it and notifies the owner.
  async function approveItem(item) {
    const { error } = await supabase.from('action_items').update({
      status: 'closed', verified_by: user?.name || 'Unknown', verified_at: new Date().toISOString(), closure_note: null,
    }).eq('id', item.id)
    if (error) { setError(error.message); return }

    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'approved_closed' }])

    const { data: ownerProfile } = await supabase.from('profiles').select('id').eq('name', item.owner_name).maybeSingle()
    if (ownerProfile) {
      await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: ownerProfile.id,
        body: `${user?.name} approved and closed "${item.title}".`,
      }])
    }
    loadItems()
  }

  // Manager sends a pending item back to "Ready to Close" with a comment.
  async function handleSendBack({ note }) {
    const item = sendingBackItem
    const { error } = await supabase.from('action_items').update({
      status: 'ready_to_close', closure_note: note,
    }).eq('id', item.id)
    if (error) { setError(error.message); setSendingBackItem(null); return }

    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'sent_back', note }])

    const { data: ownerProfile } = await supabase.from('profiles').select('id').eq('name', item.owner_name).maybeSingle()
    if (ownerProfile) {
      await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: ownerProfile.id,
        body: `${user?.name} sent "${item.title}" back for re-examination: ${note}`,
      }])
    }
    setSendingBackItem(null)
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

  // "team" scope also surfaces items that are PRIVATE but currently
  // pending_approval, so a manager can still see and act on them even
  // though the owner never made the item team-visible. Without this, a
  // private item submitted for approval was invisible to the approving
  // manager on every tab.
  const scopedItems = items.filter((i) => {
    if (nav === 'mine') return i.owner_name === user?.name
    if (nav === 'general') return i.visibility === 'general'
    if (nav === 'team') {
      const visibleToTeam = i.visibility === 'team' && i.team === user?.team
      const pendingForManager =
        i.status === 'pending_approval' &&
        i.team === user?.team &&
        user?.role === 'MANAGER'
      return visibleToTeam || pendingForManager
    }
    return true
  })

  const filtered = scopedItems.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false
    if (filterOwner && !i.owner_name.toLowerCase().includes(filterOwner.toLowerCase())) return false
    return true
  })

  // Severity (critical first) takes priority over deadline when sorting is
  // enabled, so the most urgent work always surfaces to the top of the list
  // regardless of how far out its deadline sits.
  const sortedFiltered = sortBySeverity
    ? [...filtered].sort((a, b) => {
        const sevDiff = (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2)
        if (sevDiff !== 0) return sevDiff
        return new Date(a.deadline) - new Date(b.deadline)
      })
    : filtered

  const counts = {
    open: scopedItems.filter((i) => i.status === 'open').length,
    in_progress: scopedItems.filter((i) => i.status === 'in_progress').length,
    ready_to_close: scopedItems.filter((i) => i.status === 'ready_to_close').length,
    pending_approval: scopedItems.filter((i) => i.status === 'pending_approval').length,
    closed: scopedItems.filter((i) => i.status === 'closed').length,
    overdue: scopedItems.filter(isOverdue).length,
    critical: scopedItems.filter((i) => i.status !== 'closed' && i.severity === 'critical').length,
  }

  const navTitle = { mine: 'My Tasks', general: 'General', team: 'My Team', safety: 'Safety at Site', directory: 'Team Directory' }[nav]       

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
    <div className="min-h-screen flex bg-gradient-to-br from-[#F5F6F7] via-[#EFF1F2] to-[#E4E7EA] font-sans text-ink relative">        
      <WaferGrid />

{chatUser && (  
  <ChatModal 
    currentUser={user}
    recipient={chatUser}
    onClose={() => {
      setChatUser(null)
      loadUnreadMessages()
    }}
    onMessagesRead={loadUnreadMessages}
  />
)}

{submittingItem && (
  <SubmitForApprovalModal
    item={submittingItem}
    user={user}
    onCancel={() => setSubmittingItem(null)}
    onConfirm={handleSubmitForApproval}
  />
)}

{sendingBackItem && (
  <SendBackModal
    item={sendingBackItem}
    onCancel={() => setSendingBackItem(null)}
    onConfirm={handleSendBack}
  />
)}

{assigningTo && (
  <AssignWorkModal
    mentor={user}
    assignee={assigningTo}
    onCancel={() => setAssigningTo(null)}
    onAssigned={() => { setAssigningTo(null); loadItems() }}
  />
)}

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
            {navItem(
              'directory',
              <span className="flex items-center gap-2">
                Team Directory
                {unreadMessages > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </span>
            )}  
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
          {nav !== 'safety' && nav !== 'directory' && (     
            <button onClick={() => setShowForm((s) => !s)} className="bg-accent-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-blue/90 transition-colors">
              {showForm ? 'Cancel' : '+ New Action Item'}
            </button>
          )}
        </div>

        <div className="px-6 md:px-10 py-8 relative">
          {nav === 'safety' ? (
            <Safety user={user} /> 
          ) : nav === 'directory' ? (
            <Directory
              user={user}
              onMessage={(person) => setChatUser(person)}
              onAssign={(person) => setAssigningTo(person)}
            />    
          ) : (      
            <>
              {nav === 'general' && (
                <AnnouncementsPanel
                  announcements={announcements}
                  loading={loadingAnnouncements}
                  user={user}
                  draft={announcementDraft}
                  onDraftChange={setAnnouncementDraft}
                  onSubmit={handlePostAnnouncement}
                  posting={postingAnnouncement}
                />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
                <StatTile label="Open" value={counts.open} />
                <StatTile label="In Progress" value={counts.in_progress} />
                <StatTile label="Ready to Close" value={counts.ready_to_close} />
                <StatTile label="Pending Approval" value={counts.pending_approval} />
                <StatTile label="Closed" value={counts.closed} />
                <StatTile label="Overdue" value={counts.overdue} alert />
                <StatTile label="Critical" value={counts.critical} alert />
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
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Severity</label>
                    <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Visibility</label>
                    <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                      value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                      <option value="private">Only Me — Private</option>
                      <option value="team">My Team Only</option>
                      <option value="general">General — Visible to Everyone</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-accent-blue text-white rounded-md p-2.5 col-span-1 sm:col-span-2 font-medium hover:bg-accent-blue/90 transition-colors">
                    Log Action Item
                  </button>
                </form>
              )}

              <div className="flex gap-3 mb-5 flex-wrap items-center">
                <select className="border border-line rounded-lg p-2.5 text-sm bg-surface shadow-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STAGES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <select className="border border-line rounded-lg p-2.5 text-sm bg-surface shadow-sm" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                  <option value="all">All severities</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
                </select>
                <input placeholder="Filter by owner..." className="border border-line rounded-lg p-2.5 text-sm flex-1 min-w-[200px] bg-surface shadow-sm"
                  value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} />
                <label className="flex items-center gap-2 text-sm text-ink-muted font-mono text-[11px] uppercase tracking-wider cursor-pointer select-none">
                  <input type="checkbox" checked={sortBySeverity} onChange={(e) => setSortBySeverity(e.target.checked)} />
                  Sort by severity
                </label>
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
                      {scopedItems.length > 0 && sortedFiltered.length === 0 && (
                        <p className="text-ink-muted text-sm py-6 text-center">No items match these filters.</p>
                      )}
                      {sortedFiltered.map((item) => {
                        const style = STATUS_STYLES[item.status]
                        const sevStyle = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.medium
                        const overdue = isOverdue(item)
                        const label = nextActionLabel(item.status)
                        const isOpen = !!expanded[item.id]
                        const entries = activity[item.id] || []
                        const isEditingMentor = !!mentorEditing[item.id]
                        const isTeamManager = user?.role === 'MANAGER' && user?.team === item.team
                        return (
                          <div key={item.id} className={`bg-surface border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 ${overdue ? 'border-l-accent-red border-line' : 'border-l-transparent border-line'}`}>
                            <div className="flex justify-between items-center gap-4 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-ink">{item.title}</span>
                                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-line text-ink-muted">{item.source.replace('_', ' ')}</span>
                                  {item.severity && (
                                    <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${sevStyle.badge}`}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sevStyle.dot }} />
                                      {SEVERITY_LABELS[item.severity] || item.severity}
                                    </span>
                                  )}
                                  {item.visibility === 'general' && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue">General</span>
                                  )}
                                  {item.visibility === 'private' && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-ink/5 text-ink-muted">Private</span>
                                  )}
                                  {item.assigned_by_mentor && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: '#7C5CBF15', color: '#7C5CBF' }}>
                                      Assigned by {item.assigned_by_mentor}
                                    </span>
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

                                {item.status === 'ready_to_close' && (
                                  <button onClick={() => setSubmittingItem(item)} className="text-sm bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap">
                                    Submit for Approval
                                  </button>
                                )}

                                {item.status === 'pending_approval' && (
                                  isTeamManager ? (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => approveItem(item)} className="text-sm bg-accent-green text-white px-3 py-1.5 rounded-md hover:bg-accent-green/90 transition-colors whitespace-nowrap">
                                        Approve & Close
                                      </button>
                                      <button onClick={() => setSendingBackItem(item)} className="text-sm bg-accent-red text-white px-3 py-1.5 rounded-md hover:bg-accent-red/90 transition-colors whitespace-nowrap">
                                        Send Back
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-[11px] text-ink-muted italic whitespace-nowrap">Awaiting manager approval</span>
                                  )
                                )}

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

                            {item.status === 'ready_to_close' && item.closure_note && (
                              <div className="mt-3 rounded-lg px-3 py-2 text-sm bg-accent-red/10" style={{ borderLeft: '3px solid #C1443C' }}>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-accent-red mb-0.5">Sent back by manager</p>
                                <p className="text-ink">{item.closure_note}</p>
                              </div>
                            )}

                            {(item.completion_note || (item.completion_images && item.completion_images.length > 0)) && (
                              <div className="mt-3 rounded-lg px-3 py-2.5 text-sm bg-line/40" style={{ borderLeft: '3px solid #14181C' }}>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mb-1">Work Summary</p>
                                {item.completion_note && <p className="text-ink mb-2">{item.completion_note}</p>}
                                {item.completion_images && item.completion_images.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {item.completion_images.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-md overflow-hidden border border-line block">
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

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