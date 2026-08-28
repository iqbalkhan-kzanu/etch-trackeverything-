import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Safety from './SafetySection'
import Directory from './Directory' 
import ChatModal from './ChatModal'   
import AssignWorkModal from './AssignWorkModal'
import SendBackModal from './SendBackModal'
import SubmitForApprovalModal from './SubmitForApprovalModal'
import GroupsList from './GroupsList'
import SemiconductorPulse from './SemiconductorPulse'
import GovernanceAnalytics from './GovernanceAnalytics'
import { exportGovernanceReportCSV, exportGovernanceReportPDF } from './governanceReport'

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
const MENTOR_DARK = '#4A3572'
const STUCK_DARK = '#7A4E14'
const OVERDUE_COLOR = '#E8702A'
const CRITICAL_COLOR = '#C1443C'
const NAV_STORAGE_KEY = 'etch_last_nav'
const ACTION_META = {
  created: { label: 'Logged', color: '#5C6670' },
  advanced_to_in_progress: { label: 'Started progress', color: '#2B6CB0' },
  advanced_to_ready_to_close: { label: 'Marked ready to close', color: '#D98C2B' },
  submitted_for_approval: { label: 'Submitted for approval', color: '#7C5CBF' },
  approved_closed: { label: 'Approved & closed', color: '#2F8F5B' },
  sent_back: { label: 'Sent back for re-examination', color: '#C1443C' },
  mentor_comment: { label: 'Mentor commented', color: MENTOR_COLOR },
  flagged_blocked: { label: 'Flagged as blocked', color: '#C1443C' },
  unblocked: { label: 'Unblocked', color: '#2F8F5B' },
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

const AVATAR_PALETTE = ['#2B6CB0', '#7C5CBF', '#2F8F5B', '#D98C2B', '#C1443C', '#1F9E9E', '#C15A9E']
function personColor(name) {
  let hash = 0
  const str = name || ''
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function extractMentions(text) {
  const names = new Set()
  const quoted = text.matchAll(/@"([^"]+)"/g)
  for (const m of quoted) names.add(m[1].trim())
  const bare = text.matchAll(/@([A-Za-z][A-Za-z.'-]*)/g)
  for (const m of bare) names.add(m[1].trim())
  return Array.from(names)
}

function renderWithMentions(text) {
  const parts = text.split(/(@"[^"]+"|@[A-Za-z][A-Za-z.'-]*)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium" style={{ color: MENTOR_COLOR }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function isOverdue(item) {
  return item.status !== 'closed' && new Date(item.deadline) < new Date(new Date().toDateString())
}

function nextActionLabel(status) {
  if (status === 'open') return 'Start Progress'
  if (status === 'in_progress') return 'Mark Ready to Close'
  return null
}

function nextActionMeta(status) {
  if (status === 'open') return { next: 'in_progress', actionKey: 'advanced_to_in_progress' }
  if (status === 'in_progress') return { next: 'ready_to_close', actionKey: 'advanced_to_ready_to_close' }
  return null
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Scope filter used both for the currently-selected nav tab (My Tasks / My
// Team / General) AND for the sidebar "Tasks Overview" breakdown, which
// needs all three scopes computed independently of whichever tab is active.
function computeScopedItems(navKey, items, user) {
  return items.filter((i) => {
    const participants = Array.isArray(i.participants) ? i.participants : []
    const isCrossTeamParticipant = participants.some((p) => p.id === user?.id && p.team !== i.team)

    if (navKey === 'mine') return i.owner_name === user?.name || isCrossTeamParticipant
    if (navKey === 'general') return i.visibility === 'general'
    if (navKey === 'team') {
      const visibleToTeam = i.visibility === 'team' && i.team === user?.team
      const pendingForManager =
        i.status === 'pending_approval' &&
        i.team === user?.team &&
        user?.role === 'MANAGER'
      // Anything assigned by a manager/mentor to someone on this team should
      // always surface under "My Team" — for the assignee AND for the
      // manager — regardless of what visibility it was created with.
      const assignedWithinTeam = !!i.assigned_by_mentor && i.team === user?.team
      return visibleToTeam || pendingForManager || assignedWithinTeam
    }
    return true
  })
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

function StatCard({ icon, label, value, percent, color }) {
  return (
    <div className="relative overflow-hidden border border-line rounded-xl bg-surface px-5 py-4">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}18`, color }}>
        {icon}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color }}>{percent}</p>
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
        let files = []
        try { files = e.files ? (typeof e.files === 'string' ? JSON.parse(e.files) : e.files) : [] } catch { files = [] }
        return (
          <div key={e.id} className="relative pl-6 pb-4 last:pb-0">
            {!isLast && <div className="absolute left-[5px] top-3 bottom-0 w-px bg-line" />}
            <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-surface" style={{ backgroundColor: meta.color }} />
            <p className="text-sm font-medium text-ink">{meta.label}</p>
            <p className="font-mono text-[11px] text-ink-muted mt-0.5">{e.actor} · {formatTime(e.created_at)}</p>
            {e.note && <p className="text-xs text-ink-muted mt-1 italic">"{e.note}"</p>}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {files.map((f, fi) => (
                  <a key={fi} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono bg-line/60 text-ink-muted hover:text-accent-blue rounded px-1.5 py-0.5 transition-colors">
                    📎 <span className="truncate max-w-[100px]">{f.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
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
    <div className="lg:sticky lg:top-6 border border-line rounded-xl bg-surface p-5 h-fit">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
        <div className="w-10 h-10 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0">
          <ClipboardIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-0.5">Team Status</p>
          <h3 className="text-base font-semibold text-ink">On Time vs Late</h3>
        </div>
        <p className="font-mono text-xs shrink-0">
          <span className="text-ink">{totalOnTime}</span>
          <span className="text-ink-muted">/{totalOnTime + totalLate}</span>
        </p>
      </div>

      {ownerStats.length === 0 ? (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-20 h-20 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-4">
            <ClipboardIcon className="w-8 h-8" />
          </div>
          <p className="text-sm text-ink-muted">No active items yet.</p>
        </div>
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
          announcements.map((a) => {
            const isHazard = a.type === 'hazard_alert'
            return (
              <div key={a.id} className={`px-5 py-3.5 flex gap-3 ${isHazard ? 'bg-accent-red/5' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${isHazard ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-blue/10 text-accent-blue'}`}>
                  {isHazard ? '⚠️' : getInitials(a.author_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-ink">{isHazard ? 'Safety Alert' : a.author_name}</span>
                    {isHazard && a.severity && (
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: '#C1443C15', color: '#C1443C' }}>
                        {a.severity}
                      </span>
                    )}
                    {a.author_team && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{a.author_team}</span>}
                    <span className="font-mono text-[10px] text-ink-muted">· {formatTime(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink mt-0.5 leading-snug">{a.body}</p>
                  {isHazard && (
                    <p className="text-xs text-ink-muted mt-1">Reported by {a.author_name}{a.location ? ` · ${a.location}` : ''}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ClipboardIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="4" width="10" height="4" rx="1" /><path d="M7 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" /><path d="M9 12h6M9 16h4" /></svg>)
}
function MegaphoneIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>)
}
function TeamIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M2 21c1-3.5 4-5.5 7-5.5s6 2 7 5.5" /><circle cx="17" cy="8" r="2.5" /><path d="M16 15.2c2.4.4 4.2 2.1 5 5.8" /></svg>)
}
function ShieldNavIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>)
}
function BookIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="10" cy="10" r="2" /><path d="M6 17c.6-1.8 2-2.7 4-2.7s3.4.9 4 2.7M14 8h4M14 12h4" /></svg>)
}
function GroupsNavIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
}
function NewsIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></svg>)
}
function PaperclipIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" /></svg>)
}

function ClockStatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>)
}
function CheckCircleStatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>)
}
function PersonStatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>)
}
function AlarmStatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="m5 3-2 2M19 3l2 2" /></svg>)
}
function AlertTriangleStatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>)
}

// Shows a fixed breakdown by SCOPE (My Tasks / My Team / General), computed
// independently of which nav tab is currently selected — so the numbers no
// longer change depending on which tab you're viewing.
//
// NOTE: this replaces the old donut-chart version with a simple segmented
// bar + count list. This is a placeholder swap — happy to change the shape
// of this (sparkline, trend, list of just overdue/critical, etc.) once you
// tell me what you'd actually like to see here instead.
function TasksOverviewCard({ scopeCounts }) {
  const segments = [
    { key: 'mine', label: 'My Tasks', color: '#2B6CB0', value: scopeCounts.mine.total },
    { key: 'team', label: 'My Team', color: '#7C5CBF', value: scopeCounts.team.total },
    { key: 'general', label: 'General', color: '#D98C2B', value: scopeCounts.general.total },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-white">Tasks Overview</p>
        <span className="text-xs text-white/40">{total} total</span>
      </div>

      <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/10 mb-4">
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full"
            style={{
              width: total > 0 ? `${(s.value / total) * 100}%` : 0,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>

      <div className="space-y-2.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-white/70">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-white">
              {scopeCounts[s.key].open} open <span className="text-white/40">/ {s.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Compact, collapsed-by-default note + attachment panel used when advancing
// an item's stage. Nothing is shown until the stage button is clicked; then
// a small textarea + attach icon appear, and Confirm performs the actual
// status change along with the optional note/files.
function StageNotePanel({ label, note, onNoteChange, files, onAddFiles, onRemoveFile, onCancel, onConfirm, submitting }) {
  return (
    <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: '#14181C0A', border: '1px solid #14181C22' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{label} — optional note</p>
        <label className="cursor-pointer w-6 h-6 rounded-md border border-line flex items-center justify-center text-ink-muted hover:text-accent-blue hover:border-accent-blue transition-colors shrink-0" title="Attach files">
          <PaperclipIcon className="w-3.5 h-3.5" />
          <input type="file" multiple className="hidden" onChange={(e) => onAddFiles(Array.from(e.target.files || []))} />
        </label>
      </div>
      <textarea
        autoFocus
        rows={1}
        placeholder="Add a short note (optional)…"
        className="w-full bg-surface border border-line rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] font-mono bg-line/60 text-ink-muted rounded px-1.5 py-0.5">
              📎 <span className="truncate max-w-[100px]">{f.name}</span>
              <button type="button" onClick={() => onRemoveFile(i)} className="text-ink-muted hover:text-accent-red ml-0.5">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2 justify-end">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="text-xs px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-60"
          style={{ backgroundColor: '#14181C' }}
        >
          {submitting ? 'Saving…' : 'Confirm'}
        </button>
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
  const [blockEditing, setBlockEditing] = useState({})
  const [blockDraft, setBlockDraft] = useState({})
  const [profiles, setProfiles] = useState([])
  const [mentionState, setMentionState] = useState(null)
  const mentionInputRefs = useRef({})
  const lastSeenHazardIdRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nav, setNav] = useState(() => localStorage.getItem(NAV_STORAGE_KEY) || 'mine')
  const [chatUser, setChatUser] = useState(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterDeadline, setFilterDeadline] = useState('')
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
  const [groupUnread, setGroupUnread] = useState(0)
  const [hazardUnseen, setHazardUnseen] = useState(0)
  const [hazardToast, setHazardToast] = useState(null)
  const [focusedItemId, setFocusedItemId] = useState(null)
  const [exportingReport, setExportingReport] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team', severity: 'medium',
  })
  const [taskType, setTaskType] = useState('personal')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])

  // Stage-advance compact note/attachment panel state
  const [stagePanelItemId, setStagePanelItemId] = useState(null)
  const [stageNote, setStageNote] = useState('')
  const [stageFiles, setStageFiles] = useState([])
  const [stageSubmitting, setStageSubmitting] = useState(false)

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

  async function loadAnnouncements({ silent = false } = {}) {
    if (!silent) setLoadingAnnouncements(true)
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error) setAnnouncements(data || [])
    if (!silent) setLoadingAnnouncements(false)
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

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('id, name, team')
    if (!error) setProfiles(data || [])
  }

  async function ensureTeamMembership() {
    if (!user?.id || !user?.team) return

    let { data: group } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('is_team_group', true)
      .eq('team', user.team)
      .maybeSingle()

    if (!group) {
      const { data: created, error: createError } = await supabase
        .from('chat_groups')
        .insert([{ name: `${user.team} Team`, is_team_group: true, team: user.team, created_by: user.id }])
        .select()
        .single()
      if (createError) { console.error('team channel create failed:', createError.message); return }
      group = created
    }

    const { data: existing } = await supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      const { error: joinError } = await supabase
        .from('chat_group_members')
        .insert([{ group_id: group.id, user_id: user.id }])
      if (joinError) console.error('team channel auto-join failed:', joinError.message)
    }
  }

  useEffect(() => { loadItems(); loadProfiles(); ensureTeamMembership() }, [user?.id, user?.team])

  useEffect(() => {
    loadAnnouncements()
    const interval = setInterval(() => loadAnnouncements({ silent: true }), 7000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const hazards = announcements.filter((a) => a.type === 'hazard_alert')
    if (hazards.length === 0) return

    const newest = hazards[0]
    if (newest.id !== lastSeenHazardIdRef.current) {
      if (lastSeenHazardIdRef.current !== null) {
        setHazardToast(newest)
        setTimeout(() => setHazardToast((t) => (t?.id === newest.id ? null : t)), 8000)
      }
      lastSeenHazardIdRef.current = newest.id
    }

    const lastViewedKey = `etch_general_last_viewed_${user?.id}`
    const lastViewed = localStorage.getItem(lastViewedKey)
    const unseen = hazards.filter((h) => !lastViewed || new Date(h.created_at) > new Date(lastViewed)).length
    setHazardUnseen(unseen)
  }, [announcements, user?.id])

  useEffect(() => {
    loadUnreadMessages()
    const interval = setInterval(loadUnreadMessages, 5000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Realtime: unread inbox badge updates instantly on new/read messages,
  // no need to wait for the 5s poll above (kept as a safety-net fallback).
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`tracker-inbox-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        () => loadUnreadMessages()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  function goTo(key) {
    if (key === 'analytics' && user?.role !== 'MANAGER') return
    setNav(key)
    localStorage.setItem(NAV_STORAGE_KEY, key)
    setMobileNavOpen(false)
    if (key === 'general') {
      localStorage.setItem(`etch_general_last_viewed_${user?.id}`, new Date().toISOString())
      setHazardUnseen(0)
    }
  }

  // Called when a message in ChatModal is tied to an action item — jumps
  // straight to the right nav tab and focuses that item's detail card.
  function openMessageTarget(itemId, targetNav) {
    setChatUser(null)
    if (targetNav) goTo(targetNav)
    setFocusedItemId(itemId)
  }

  // Governance report exports — query every item directly (open AND closed)
  // regardless of which nav scope is currently loaded into `items`, so the
  // report is always complete rather than limited to whatever's on screen.
  async function fetchAllItemsForReport() {
    const { data, error } = await supabase.from('action_items').select('*')
    if (error) { setError(error.message); return null }
    return data || []
  }

  async function handleExportCSV() {
    setExportingReport('csv')
    const all = await fetchAllItemsForReport()
    if (all) exportGovernanceReportCSV(all)
    setExportingReport(null)
  }

  async function handleExportPDF() {
    setExportingReport('pdf')
    const all = await fetchAllItemsForReport()
    if (all) exportGovernanceReportPDF(all)
    setExportingReport(null)
  }

  async function handleCreate(e) {
    e.preventDefault()

    const participants = taskType === 'group'
      ? selectedParticipantIds
          .map((id) => profiles.find((p) => p.id === id))
          .filter(Boolean)
          .map((p) => ({ id: p.id, name: p.name, team: p.team }))
      : []

    const payload = { ...form, participants }
    const { data, error } = await supabase.from('action_items').insert([payload]).select()
    if (error) { setError(error.message); return }

    if (data && data[0]) {
      const participantNote = participants.length > 0 ? ` · group task with ${participants.map((p) => p.name).join(', ')}` : ''
      await supabase.from('item_activity').insert([{
        item_id: data[0].id, actor: user?.name || 'Unknown', action: 'created',
        note: `Logged from ${form.source.replace('_', ' ')} · ${form.severity} severity${participantNote}`,
      }])

      for (const p of participants) {
        if (p.id === user?.id) continue
        const { error: msgError } = await supabase.from('messages').insert([{
          sender_id: user?.id,
          recipient_id: p.id,
          body: `${user?.name} added you to the task "${form.title}" (due ${form.deadline}).`,
          item_id: data[0].id,
          target_nav: p.team === form.team ? 'team' : 'mine',
        }])
        if (msgError) console.error('participant notify failed:', msgError.message)
      }
    }

    setForm({ title: '', description: '', owner_name: user?.name || '', team: user?.team || '', source: 'project', deadline: '', visibility: 'team', severity: 'medium' })
    setTaskType('personal')
    setSelectedParticipantIds([])
    setShowForm(false)
    loadItems()
  }

  // Opens the compact note/attachment panel for a stage-advance action,
  // instead of firing the transition immediately.
  function openStagePanel(itemId) {
    if (stagePanelItemId === itemId) {
      setStagePanelItemId(null)
      return
    }
    setStagePanelItemId(itemId)
    setStageNote('')
    setStageFiles([])
  }

  function addStageFiles(newFiles) {
    setStageFiles((prev) => [...prev, ...newFiles])
  }

  function removeStageFile(idx) {
    setStageFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // Confirms a stage transition (open->in_progress or in_progress->ready_to_close),
  // uploading any attached files and recording the note + files on the timeline.
  async function confirmStageAdvance(item) {
    const meta = nextActionMeta(item.status)
    if (!meta) return
    setStageSubmitting(true)

    try {
      let uploadedFiles = []
      for (const file of stageFiles) {
        const path = `${item.id}/stage/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file)
        if (uploadError) throw uploadError
        const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(path)
        uploadedFiles.push({ name: file.name, url: publicUrlData.publicUrl })
      }

      const { error } = await supabase.from('action_items').update({ status: meta.next }).eq('id', item.id)
      if (error) throw error

      await supabase.from('item_activity').insert([{
        item_id: item.id, actor: user?.name || 'Unknown', action: meta.actionKey,
        note: stageNote.trim() || null, files: uploadedFiles,
      }])

      setStagePanelItemId(null)
      setStageNote('')
      setStageFiles([])
      loadItems()
    } catch (err) {
      setError(err.message)
    }
    setStageSubmitting(false)
  }

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

    if (!mgrError && managerProfile && managerProfile.id !== user?.id) {
      const { error: msgError } = await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: managerProfile.id,
        body: `${user?.name} submitted "${item.title}" for your approval (due ${item.deadline}).`,
        item_id: item.id,
        target_nav: 'team',
      }])
      if (msgError) console.error('notify manager failed:', msgError.message)
    } else if (mgrError || !managerProfile) {
      setError(`Submitted, but no manager is set up for team "${item.team}" — they weren't notified.`)
    }

    setSubmittingItem(null)
    loadItems()
  }

  async function approveItem(item) {
    const closeSnapshot = {
      completion_note: item.completion_note || null,
      completion_images: item.completion_images || [],
      completion_files: item.completion_files || [],
      timeline: (activity[item.id] || []).map((e) => ({
        action: e.action, actor: e.actor, note: e.note || null, created_at: e.created_at,
      })),
      closed_by: user?.name || 'Unknown',
      closed_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('action_items').update({
      status: 'closed', verified_by: user?.name || 'Unknown', verified_at: new Date().toISOString(), closure_note: null,
      close_snapshot: closeSnapshot,
    }).eq('id', item.id)
    if (error) { setError(error.message); return }

    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'approved_closed' }])

    const { data: ownerProfile } = await supabase.from('profiles').select('id').eq('name', item.owner_name).maybeSingle()
    if (ownerProfile && ownerProfile.id !== user?.id) {
      const { error: msgError } = await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: ownerProfile.id,
        body: `${user?.name} approved and closed "${item.title}".`,
        item_id: item.id,
        target_nav: 'mine',
      }])
      if (msgError) console.error('notify owner failed:', msgError.message)
    }
    loadItems()
  }

  async function handleSendBack({ note }) {
    const item = sendingBackItem
    const { error } = await supabase.from('action_items').update({
      status: 'ready_to_close', closure_note: note,
    }).eq('id', item.id)
    if (error) { setError(error.message); setSendingBackItem(null); return }

    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'sent_back', note }])

    const { data: ownerProfile } = await supabase.from('profiles').select('id').eq('name', item.owner_name).maybeSingle()
    if (ownerProfile && ownerProfile.id !== user?.id) {
      const { error: msgError } = await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: ownerProfile.id,
        body: `${user?.name} sent "${item.title}" back for re-examination: ${note}`,
        item_id: item.id,
        target_nav: 'mine',
      }])
      if (msgError) console.error('notify owner failed:', msgError.message)
    }
    setSendingBackItem(null)
    loadItems()
  }

  function openBlockEditor(item) {
    setBlockDraft((prev) => ({ ...prev, [item.id]: '' }))
    setBlockEditing((prev) => ({ ...prev, [item.id]: true }))
  }

  async function flagBlocked(item) {
    const reason = (blockDraft[item.id] || '').trim()
    if (!reason) return
    const { error } = await supabase.from('action_items').update({
      blocked: true, blocked_reason: reason, blocked_by: user?.name || 'Unknown', blocked_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (error) { setError(error.message); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'flagged_blocked', note: reason }])

    const { data: managerProfile } = await supabase.from('profiles').select('id').eq('team', item.team).eq('role', 'MANAGER').maybeSingle()
    if (managerProfile && managerProfile.id !== user?.id) {
      const { error: msgError } = await supabase.from('messages').insert([{
        sender_id: user?.id,
        recipient_id: managerProfile.id,
        body: `${user?.name} flagged "${item.title}" as blocked: ${reason}`,
        item_id: item.id,
        target_nav: 'team',
      }])
      if (msgError) console.error('notify manager failed:', msgError.message)
    }
    setBlockEditing((prev) => ({ ...prev, [item.id]: false }))
    loadItems()
  }

  async function clearBlocked(item) {
    const { error } = await supabase.from('action_items').update({
      blocked: false, blocked_reason: null,
    }).eq('id', item.id)
    if (error) { setError(error.message); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'unblocked' }])
    loadItems()
  }

  function toggleExpanded(id) { setExpanded((prev) => ({ ...prev, [id]: !prev[id] })) }

  function openMentorEditor(item) {
    setMentorDraft((prev) => ({ ...prev, [item.id]: item.mentor_comment || '' }))
    setMentorEditing((prev) => ({ ...prev, [item.id]: true }))
    setMentionState(null)
  }

  function handleMentorDraftChange(item, e) {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setMentorDraft((p) => ({ ...p, [item.id]: value }))

    const uptoCursor = value.slice(0, cursor)
    const match = uptoCursor.match(/@([A-Za-z][A-Za-z.'-]*)$/)
    if (match) {
      setMentionState({ itemId: item.id, query: match[1], start: cursor - match[0].length, end: cursor })
    } else {
      setMentionState((prev) => (prev && prev.itemId === item.id ? null : prev))
    }
  }

  function selectMention(item, profile) {
    const draft = mentorDraft[item.id] || ''
    const { start, end } = mentionState
    const insertion = profile.name.includes(' ') ? `@"${profile.name}"` : `@${profile.name}`
    const newText = draft.slice(0, start) + insertion + ' ' + draft.slice(end)
    setMentorDraft((p) => ({ ...p, [item.id]: newText }))
    setMentionState(null)
    requestAnimationFrame(() => {
      const el = mentionInputRefs.current[item.id]
      if (el) {
        const pos = start + insertion.length + 1
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    })
  }

  async function saveMentorComment(item) {
    const text = (mentorDraft[item.id] || '').trim()
    if (!text) return
    const { error } = await supabase.from('action_items').update({
      mentor_comment: text, mentor_by: user?.name || 'Unknown', mentor_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (error) { setError(error.message); return }
    await supabase.from('item_activity').insert([{ item_id: item.id, actor: user?.name || 'Unknown', action: 'mentor_comment', note: text }])

    const mentioned = extractMentions(text)
    for (const name of mentioned) {
      const { data: matches, error: lookupError } = await supabase
        .from('profiles')
        .select('id, name')
        .ilike('name', `%${name}%`)
        .limit(1)
      if (lookupError) { console.error('mention lookup failed:', lookupError.message); continue }
      const profile = matches && matches[0]
      if (profile && profile.id !== user?.id) {
        const { error: msgError } = await supabase.from('messages').insert([{
          sender_id: user?.id,
          recipient_id: profile.id,
          body: `${user?.name} mentioned you on "${item.title}": ${text}`,
          item_id: item.id,
          target_nav: profile.name === item.owner_name ? 'mine' : 'team',
        }])
        if (msgError) console.error('mention notify failed:', msgError.message)
      }
    }

    setMentorEditing((prev) => ({ ...prev, [item.id]: false }))
    setMentionState(null)
    loadItems()
  }

  const scopedItems = computeScopedItems(nav, items, user)

  // Independent, per-scope item sets used only for the sidebar "Tasks
  // Overview" card, so its numbers stay fixed regardless of which nav tab
  // is currently active.
  const mineItems = computeScopedItems('mine', items, user)
  const teamItems = computeScopedItems('team', items, user)
  const generalItems = computeScopedItems('general', items, user)
  const scopeCounts = {
    mine: { open: mineItems.filter((i) => i.status !== 'closed').length, total: mineItems.length },
    team: { open: teamItems.filter((i) => i.status !== 'closed').length, total: teamItems.length },
    general: { open: generalItems.filter((i) => i.status !== 'closed').length, total: generalItems.length },
  }

  const filtered = scopedItems.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false
    if (filterOwner && !i.owner_name.toLowerCase().includes(filterOwner.toLowerCase())) return false
    if (filterDeadline && i.deadline !== filterDeadline) return false
    return true
  })

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
  const totalScoped = scopedItems.length
  function pct(n) {
    if (totalScoped === 0) return '—'
    return `${((n / totalScoped) * 100).toFixed(1)}%`
  }

  useEffect(() => {
    if (sortedFiltered.length === 0) { setFocusedItemId(null); return }
    if (!sortedFiltered.find((i) => i.id === focusedItemId)) {
      setFocusedItemId(sortedFiltered[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, filterStatus, filterSeverity, filterOwner, filterDeadline, sortBySeverity, items])

  const focusedItem = sortedFiltered.find((i) => i.id === focusedItemId) || null

  const navTitle = { mine: 'My Tasks', general: 'General', team: 'My Team', safety: 'Safety at Site', directory: 'Team Directory', groups: 'Groups', pulse: 'Industry Pulse', analytics: 'Governance Analytics' }[nav]

  const navItem = (key, label, icon) => (
    <button
      onClick={() => goTo(key)}
      className={`w-full flex items-center gap-3 text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        nav === key ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">{label}</span>
    </button>
  )         

  function renderItemCard(item) {
    const style = STATUS_STYLES[item.status]
    const sevStyle = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.medium
    const overdue = isOverdue(item)
    const label = nextActionLabel(item.status)
    const isOpen = !!expanded[item.id]
    const entries = activity[item.id] || []
    const isEditingMentor = !!mentorEditing[item.id]
    const isBlockEditing = !!blockEditing[item.id]
    const isOwner = item.owner_name === user?.name
    const isTeamManager = user?.role === 'MANAGER' && user?.team === item.team
    const isStagePanelOpen = stagePanelItemId === item.id
    return (
      <div key={item.id} className={`bg-surface border rounded-xl p-5 shadow-sm border-l-4 ${overdue ? 'border-l-[#E8702A] border-line' : item.blocked ? 'border-l-accent-amber border-line' : 'border-l-transparent border-line'}`}>
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
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: MENTOR_DARK }}>
                  Assigned by {item.assigned_by_mentor}
                </span>
              )}
              {Array.isArray(item.participants) && item.participants.length > 0 && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: '#2B6CB015', color: '#2B6CB0' }}>
                  👥 Group Task · {item.participants.map((p) => p.name).join(', ')}
                </span>
              )}
              {overdue && <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: OVERDUE_COLOR }}>Overdue</span>}
              {item.blocked && <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: STUCK_DARK }}>🚧 Blocked</span>}
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
              <button onClick={() => openStagePanel(item.id)} className="text-sm bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap">{label}</button>
            )}

            {isOwner && item.status !== 'closed' && (
              item.blocked ? (
                <button
                  onClick={() => clearBlocked(item)}
                  className="font-mono text-[11px] uppercase tracking-wider rounded-md px-2.5 py-1.5 whitespace-nowrap text-white transition-colors"
                  style={{ backgroundColor: STUCK_DARK }}
                >
                  Unblock
                </button>
              ) : (
                <button
                  onClick={() => (isBlockEditing ? setBlockEditing((p) => ({ ...p, [item.id]: false })) : openBlockEditor(item))}
                  className="font-mono text-[11px] uppercase tracking-wider rounded-md px-2.5 py-1.5 whitespace-nowrap text-white transition-colors"
                  style={{ backgroundColor: isBlockEditing ? '#5C3C0D' : STUCK_DARK }}
                >
                  🚧 I'm Stuck
                </button>
              )
            )}
            <button
              onClick={() => (isEditingMentor ? setMentorEditing((p) => ({ ...p, [item.id]: false })) : openMentorEditor(item))}
              className="font-mono text-[11px] uppercase tracking-wider rounded-md px-2.5 py-1.5 whitespace-nowrap text-white transition-colors"
              style={{ backgroundColor: isEditingMentor ? '#382854' : MENTOR_DARK }}
            >
              Mentor {item.mentor_comment ? '💬' : ''}
            </button>
            <button onClick={() => toggleExpanded(item.id)} className="font-mono text-[11px] uppercase tracking-wider text-white rounded-md px-2.5 py-1.5 whitespace-nowrap bg-ink hover:bg-ink/90 transition-colors">
              {isOpen ? 'Hide' : 'Timeline'} ({entries.length})
            </button>
          </div>
        </div>

        {isStagePanelOpen && label && (
          <StageNotePanel
            label={label}
            note={stageNote}
            onNoteChange={setStageNote}
            files={stageFiles}
            onAddFiles={addStageFiles}
            onRemoveFile={removeStageFile}
            onCancel={() => setStagePanelItemId(null)}
            onConfirm={() => confirmStageAdvance(item)}
            submitting={stageSubmitting}
          />
        )}

        {item.status === 'ready_to_close' && item.closure_note && (
          <div className="mt-3 rounded-lg px-3 py-2 text-sm bg-accent-red/10" style={{ borderLeft: '3px solid #C1443C' }}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent-red mb-0.5">Sent back by manager</p>
            <p className="text-ink">{item.closure_note}</p>
          </div>
        )}

        {item.blocked && item.blocked_reason && (
          <div className="mt-3 rounded-lg px-3 py-2 text-sm bg-accent-amber/10" style={{ borderLeft: '3px solid #D98C2B' }}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent-amber mb-0.5">🚧 Blocked — {item.blocked_by}</p>
            <p className="text-ink">{item.blocked_reason}</p>
          </div>
        )}

        {isBlockEditing && (
          <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: '#D98C2B0D', border: '1px solid #D98C2B40' }}>
            <textarea autoFocus rows={2} placeholder="What's blocking you? (waiting on approval, missing data, dependency, etc.)"
              className="w-full bg-surface border border-line rounded-md p-2 text-sm focus:outline-none focus:ring-2"
              value={blockDraft[item.id] || ''} onChange={(e) => setBlockDraft((p) => ({ ...p, [item.id]: e.target.value }))} />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => setBlockEditing((p) => ({ ...p, [item.id]: false }))} className="text-xs px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
              <button onClick={() => flagBlocked(item)} className="text-xs px-3 py-1.5 rounded-md text-white font-medium" style={{ backgroundColor: STUCK_DARK }}>Flag as Blocked</button>
            </div>
          </div>
        )}

        {(() => {
          const snap = item.status === 'closed' ? item.close_snapshot : null
          const note = snap ? snap.completion_note : item.completion_note
          const images = snap ? snap.completion_images : item.completion_images
          const files = snap ? snap.completion_files : item.completion_files
          if (!note && !(images && images.length > 0) && !(files && files.length > 0)) return null
          return (
            <div className="mt-3 rounded-lg px-3 py-2.5 text-sm bg-line/40" style={{ borderLeft: '3px solid #14181C' }}>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">Work Summary</p>
                {snap && (
                  <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green">
                    🔒 Locked at close · {snap.closed_by} · {formatTime(snap.closed_at)}
                  </span>
                )}
              </div>
              {note && <p className="text-ink mb-2">{note}</p>}
              {images && images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-md overflow-hidden border border-line block">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {files && files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs border border-line rounded-md px-2 py-1.5 text-ink-muted hover:text-accent-blue hover:border-accent-blue transition-colors">
                      📎 <span className="truncate max-w-[140px]">{f.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {item.mentor_comment && !isEditingMentor && (
          <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: `${MENTOR_DARK}18`, borderLeft: `3px solid ${MENTOR_DARK}` }}>
            <p className="font-mono text-[10px] uppercase tracking-wider mb-0.5" style={{ color: MENTOR_DARK }}>Mentor Comment — {item.mentor_by}</p>
            <p className="text-ink">{renderWithMentions(item.mentor_comment)}</p>
          </div>
        )}

        {isEditingMentor && (
          <div className="mt-3 rounded-lg p-3 relative" style={{ backgroundColor: `${MENTOR_DARK}0D`, border: `1px solid ${MENTOR_DARK}40` }}>
            <textarea autoFocus rows={2} placeholder="Leave a comment on this item's progress… use @Name to notify someone"
              ref={(el) => (mentionInputRefs.current[item.id] = el)}
              className="w-full bg-surface border border-line rounded-md p-2 text-sm focus:outline-none focus:ring-2"
              value={mentorDraft[item.id] || ''}
              onChange={(e) => handleMentorDraftChange(item, e)}
              onKeyDown={(e) => { if (e.key === 'Escape') setMentionState(null) }}
              onBlur={() => setTimeout(() => setMentionState((prev) => (prev && prev.itemId === item.id ? null : prev)), 150)}
            />
            {mentionState && mentionState.itemId === item.id && (() => {
              const q = mentionState.query.toLowerCase()
              const matches = profiles.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5)
              if (matches.length === 0) return null
              return (
                <div className="absolute left-3 right-3 z-10 mt-1 bg-surface border border-line rounded-md shadow-lg overflow-hidden">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectMention(item, p) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-line/60 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )
            })()}
            <p className="font-mono text-[10px] text-ink-muted mt-1">Tip: type @ then a name to notify someone</p>
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => { setMentorEditing((p) => ({ ...p, [item.id]: false })); setMentionState(null) }} className="text-xs px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
              <button onClick={() => saveMentorComment(item)} className="text-xs px-3 py-1.5 rounded-md text-white font-medium" style={{ backgroundColor: MENTOR_DARK }}>Post Comment</button>
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
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#F5F6F7] via-[#EFF1F2] to-[#E4E7EA] font-sans text-ink relative">        
      <WaferGrid />

{hazardToast && (
  <div className="fixed top-6 right-6 z-[60] max-w-sm">
    <div className="bg-surface border-l-4 border-accent-red rounded-lg shadow-xl p-4 flex gap-3">
      <span className="text-xl shrink-0">⚠️</span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent-red mb-0.5">Hazard Reported</p>
        <p className="text-sm text-ink">{hazardToast.body}</p>
        <button
          onClick={() => { setNav('general'); setHazardToast(null) }}
          className="text-xs font-medium text-accent-blue mt-1.5 hover:underline"
        >
          View in General →
        </button>
      </div>
      <button onClick={() => setHazardToast(null)} className="text-ink-muted hover:text-ink shrink-0 text-sm">✕</button>
    </div>
  </div>
)}

{chatUser && (  
  <ChatModal 
    currentUser={user}
    recipient={chatUser}
    onClose={() => {
      setChatUser(null)
      loadUnreadMessages()
    }}
    onMessagesRead={loadUnreadMessages}
    onOpenItem={openMessageTarget}
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
      <aside className={`w-64 shrink-0 bg-ink text-white flex-col justify-between p-6 fixed md:sticky top-0 left-0 h-screen z-50 md:z-auto overflow-y-auto ${mobileNavOpen ? 'flex' : 'hidden'} md:flex`}>
        <div>
          <button onClick={() => setMobileNavOpen(false)} className="md:hidden font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white mb-6">✕ Close</button>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center font-bold text-sm shrink-0">E</div>
            <span className="text-lg font-bold tracking-tight">ETCH<span className="text-accent-blue">.</span></span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2 px-3.5">Navigate</p>
          <nav className="space-y-1">
            {navItem('mine', 'My Tasks', <ClipboardIcon className="w-4 h-4" />)}
            {navItem(
              'general',
              <span className="flex items-center gap-2">
                General
                {hazardUnseen > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {hazardUnseen > 99 ? '99+' : hazardUnseen}
                  </span>
                )}
              </span>,
              <MegaphoneIcon className="w-4 h-4" />
            )}
            {navItem('team', 'My Team', <TeamIcon className="w-4 h-4" />)}
            {navItem('safety', 'Safety at Site', <ShieldNavIcon className="w-4 h-4" />)}
            {user?.role === 'MANAGER' && navItem('analytics', 'Governance Analytics', <AlertTriangleStatIcon className="w-4 h-4" />)}
            {navItem(
              'directory',
              <span className="flex items-center gap-2">
                Team Directory
                {unreadMessages > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </span>,
              <BookIcon className="w-4 h-4" />
            )}  
            {navItem(
              'groups',
              <span className="flex items-center gap-2">
                Groups
                {groupUnread > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {groupUnread > 99 ? '99+' : groupUnread}
                  </span>
                )}
              </span>,
              <GroupsNavIcon className="w-4 h-4" />
            )}
            {navItem('pulse', 'Industry Pulse', <NewsIcon className="w-4 h-4" />)}
          </nav>

          <div className="mt-6">
            <TasksOverviewCard scopeCounts={scopeCounts} />
          </div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">{user?.team}</p>
          <button onClick={onLogout} className="mt-3 font-mono text-[11px] uppercase tracking-wider text-white/50 hover:text-white transition-colors">Log Out</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 relative">
        <div className="border-b border-line bg-surface/95 backdrop-blur-sm px-6 md:px-10 py-6 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10">
          <div className="min-w-0 flex items-center gap-3">
            <img src="/one-team-dream-logo.png" alt="1 Team, 1 Dream" className="h-9 sm:h-11 w-auto shrink-0" />
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setMobileNavOpen(true)} className="border border-line rounded-md px-3 py-2 text-ink bg-surface">☰</button>
            <span className="text-sm font-medium text-ink">{user?.name}</span>
            <button onClick={onLogout} className="font-mono text-[11px] uppercase tracking-wider text-ink-muted border border-line rounded-md px-3 py-2">Log Out</button>
          </div>
          {nav !== 'safety' && nav !== 'directory' && nav !== 'groups' && nav !== 'pulse' && nav !== 'analytics' && (     
            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={exportingReport !== null}
                  className="border border-line text-sm px-3 py-2.5 rounded-lg hover:bg-line/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {exportingReport === 'csv' ? 'Exporting…' : 'Export CSV'}
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exportingReport !== null}
                  className="border border-line text-sm px-3 py-2.5 rounded-lg hover:bg-line/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {exportingReport === 'pdf' ? 'Exporting…' : 'Governance Report (PDF)'}
                </button>
              </div>
              <button onClick={() => setShowForm((s) => !s)} className="bg-accent-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-blue/90 transition-colors whitespace-nowrap">
                {showForm ? 'Cancel' : '+ New Action Item'}
              </button>
            </div>
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
          ) : nav === 'groups' ? (
            <GroupsList user={user} profiles={profiles} onUnreadChange={setGroupUnread} />
          ) : nav === 'pulse' ? (
            <SemiconductorPulse />
          ) : nav === 'analytics' ? (
            user?.role === 'MANAGER' ? (
              <GovernanceAnalytics
                items={items.filter((i) => i.team === user?.team)}
                activity={activity}
              />
            ) : (
              <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
                <p className="text-ink font-medium">Governance Analytics is only available to managers.</p>
              </div>
            )
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
                <StatCard icon={<ClipboardIcon className="w-4.5 h-4.5" />} label="Open" value={counts.open} percent={pct(counts.open)} color="#5C6670" />
                <StatCard icon={<ClockStatIcon className="w-4.5 h-4.5" />} label="In Progress" value={counts.in_progress} percent={pct(counts.in_progress)} color="#2B6CB0" />
                <StatCard icon={<CheckCircleStatIcon className="w-4.5 h-4.5" />} label="Ready to Close" value={counts.ready_to_close} percent={pct(counts.ready_to_close)} color="#D98C2B" />
                <StatCard icon={<PersonStatIcon className="w-4.5 h-4.5" />} label="Pending Approval" value={counts.pending_approval} percent={pct(counts.pending_approval)} color="#7C5CBF" />
                <StatCard icon={<CheckCircleStatIcon className="w-4.5 h-4.5" />} label="Closed" value={counts.closed} percent={pct(counts.closed)} color="#2F8F5B" />
                <StatCard icon={<AlarmStatIcon className="w-4.5 h-4.5" />} label="Overdue" value={counts.overdue} percent={pct(counts.overdue)} color={OVERDUE_COLOR} />
                <StatCard icon={<AlertTriangleStatIcon className="w-4.5 h-4.5" />} label="Critical" value={counts.critical} percent={pct(counts.critical)} color={CRITICAL_COLOR} />
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

                  <div className="col-span-1 sm:col-span-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Task Type</label>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setTaskType('personal')}
                        className={`flex-1 text-sm font-medium rounded-md px-3 py-2 border transition-colors ${
                          taskType === 'personal' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-line text-ink-muted hover:text-ink'
                        }`}
                      >
                        Personal Task
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTaskType('group'); setForm((f) => ({ ...f, visibility: 'team' })) }}
                        className={`flex-1 text-sm font-medium rounded-md px-3 py-2 border transition-colors ${
                          taskType === 'group' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-line text-ink-muted hover:text-ink'
                        }`}
                      >
                        Group Task
                      </button>
                    </div>
                  </div>

                  {taskType === 'group' && (
                    <div className="col-span-1 sm:col-span-2 border border-line rounded-md p-3 bg-canvas">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted mb-2">
                        Add people to this task
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {profiles.filter((p) => p.id !== user?.id).map((p) => (
                          <label key={p.id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-line/40 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedParticipantIds.includes(p.id)}
                              onChange={() => setSelectedParticipantIds((prev) =>
                                prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              )}
                            />
                            <span className="text-sm text-ink truncate">{p.name}</span>
                            <span className="font-mono text-[10px] text-ink-muted ml-auto shrink-0">{p.team}</span>
                          </label>
                        ))}
                      </div>
                      <p className="font-mono text-[10px] text-ink-muted mt-2">
                        Same-team people see this under "My Team". People from other teams see it under "My Tasks", and everyone added gets notified.
                      </p>
                    </div>
                  )}

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
                <input placeholder="Filter by owner..." className="border border-line rounded-lg p-2.5 text-sm flex-1 min-w-[180px] bg-surface shadow-sm"
                  value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} />
                <input type="date" title="Filter by due date" className="border border-line rounded-lg p-2.5 text-sm bg-surface shadow-sm"
                  value={filterDeadline} onChange={(e) => setFilterDeadline(e.target.value)} />
                {filterDeadline && (
                  <button onClick={() => setFilterDeadline('')} className="font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-ink border border-line rounded-lg px-2.5 py-2.5">
                    Clear date
                  </button>
                )}
                <label className="flex items-center gap-2 text-sm text-ink-muted font-mono text-[11px] uppercase tracking-wider cursor-pointer select-none">
                  <input type="checkbox" checked={sortBySeverity} onChange={(e) => setSortBySeverity(e.target.checked)} />
                  Sort by severity
                </label>
              </div>

              <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
                <div className="space-y-6">
                  {loading ? (
                    <p className="text-ink-muted font-mono text-sm">Loading action items…</p>
                  ) : scopedItems.length === 0 ? (
                    <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
                      <p className="text-ink font-medium">
                        {nav === 'general' ? 'No general items yet.' : nav === 'team' ? 'No team items yet.' : 'No action items logged yet.'}
                      </p>
                      <p className="text-ink-muted text-sm mt-1">Start by logging the first one from a review, audit, or project discussion.</p>
                    </div>
                  ) : sortedFiltered.length === 0 ? (
                    <p className="text-ink-muted text-sm py-6 text-center">No items match these filters.</p>
                  ) : (
                    <>
                      {focusedItem && renderItemCard(focusedItem)}

                      <div className="border border-line rounded-xl bg-surface shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                          <h3 className="text-base font-semibold text-ink">Recent Tasks</h3>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{sortedFiltered.length} item{sortedFiltered.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-line">
                                <th className="text-left font-mono text-[11px] uppercase tracking-wider text-ink font-bold px-5 py-2.5">Task</th>
                                <th className="text-left font-mono text-[11px] uppercase tracking-wider text-ink font-bold px-3 py-2.5">Status</th>
                                <th className="text-left font-mono text-[11px] uppercase tracking-wider text-ink font-bold px-3 py-2.5">Severity</th>
                                <th className="text-left font-mono text-[11px] uppercase tracking-wider text-ink font-bold px-3 py-2.5">Due Date</th>
                                <th className="text-left font-mono text-[11px] uppercase tracking-wider text-ink font-bold px-3 py-2.5">Assignee</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {sortedFiltered.map((item) => {
                                const style = STATUS_STYLES[item.status]
                                const sevStyle = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.medium
                                const isFocused = item.id === focusedItemId
                                return (
                                  <tr
                                    key={item.id}
                                    onClick={() => setFocusedItemId(item.id)}
                                    className={`cursor-pointer transition-colors ${isFocused ? 'bg-accent-blue/5' : 'hover:bg-line/30'}`}
                                  >
                                    <td className="px-5 py-3 min-w-[220px] max-w-xs">
                                      <p className="font-medium text-ink truncate">{item.title}</p>
                                      <p className="font-mono text-[10px] text-ink-muted truncate">{item.owner_name}{item.team && ` · ${item.team}`}</p>
                                    </td>
                                    <td className="px-3 py-3">
                                      <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${style.badge}`}>{STATUS_LABELS[item.status]}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                      <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${sevStyle.badge}`}>{SEVERITY_LABELS[item.severity] || item.severity}</span>
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{item.deadline}</td>
                                    <td className="px-3 py-3">
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                        style={{ backgroundColor: personColor(item.owner_name) }}
                                        title={item.owner_name}
                                      >
                                        {getInitials(item.owner_name)}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
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