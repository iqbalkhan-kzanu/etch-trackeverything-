import { useMemo } from 'react'

const COLOR = {
  ink: '#14181C', blue: '#2B6CB0', amber: '#D98C2B', green: '#2F8F5B',
  red: '#C1443C', purple: '#7C5CBF', muted: '#5C6670', line: '#E4E7EA', soft: '#F6F8FA',
}
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
const SEVERITY_COLOR = { critical: COLOR.red, high: COLOR.amber, medium: COLOR.blue, low: COLOR.muted }

/* ---------------------------------------------------------------- helpers */

function daysBetween(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86400000)
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const weekLabel = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
// Includes the weekday deliberately — "which day was this closed" is
// exactly what the closure log needs to answer at a glance.
const formatClosedDate = (date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const isOverdueItem = (item, now) => item.status !== 'closed' && item.deadline && new Date(item.deadline) < new Date(now.toDateString())

/* ---------------------------------------------------------------- metrics */

function computeMetrics(items = [], activity = {}) {
  const closed = items.filter((i) => i.status === 'closed')
  const active = items.filter((i) => i.status !== 'closed')
  const now = new Date()

  const closedWithDates = closed.map((item) => {
    const closedAtRaw = item.close_snapshot?.closed_at || item.verified_at
    const closedAt = closedAtRaw ? new Date(closedAtRaw) : null
    const deadline = item.deadline ? new Date(item.deadline) : null
    const onTime = closedAt && deadline
      ? closedAt <= new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59)
      : null

    const createdEntry = (activity[item.id] || []).find((e) => e.action === 'created')
    const startDate = createdEntry ? new Date(createdEntry.created_at) : null
    const daysToClose = startDate && closedAt ? daysBetween(startDate, closedAt) : null

    return { ...item, _closedAt: closedAt, _onTime: onTime, _daysToClose: daysToClose }
  })

  const knownOnTime = closedWithDates.filter((i) => i._onTime !== null)
  const complianceRate = knownOnTime.length
    ? (knownOnTime.filter((i) => i._onTime).length / knownOnTime.length) * 100
    : null

  const knownDuration = closedWithDates.filter((i) => i._daysToClose !== null && i._daysToClose >= 0)
  const avgDaysToClose = knownDuration.length
    ? knownDuration.reduce((sum, i) => sum + i._daysToClose, 0) / knownDuration.length
    : null

  const isOverdue = (item) => isOverdueItem(item, now)

  const teams = Array.from(new Set(items.map((i) => i.team).filter(Boolean)))
  const byTeam = teams
    .map((team) => {
      const teamItems = items.filter((i) => i.team === team)
      const teamClosed = closedWithDates.filter((i) => i.team === team && i._onTime !== null)
      const teamOnTime = teamClosed.filter((i) => i._onTime).length
      return {
        team,
        total: teamItems.length,
        open: teamItems.filter((i) => i.status !== 'closed').length,
        overdue: teamItems.filter(isOverdue).length,
        closed: teamItems.filter((i) => i.status === 'closed').length,
        onTimePct: teamClosed.length ? Math.round((teamOnTime / teamClosed.length) * 100) : null,
      }
    })
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total)

  const bySeverity = SEVERITY_ORDER
    .map((severity) => {
      const severityItems = items.filter((i) => i.severity === severity)
      const severityClosed = closedWithDates.filter((i) => i.severity === severity && i._daysToClose !== null && i._daysToClose >= 0)
      const avgDays = severityClosed.length
        ? severityClosed.reduce((sum, i) => sum + i._daysToClose, 0) / severityClosed.length
        : null
      return {
        severity,
        total: severityItems.length,
        open: severityItems.filter((i) => i.status !== 'closed').length,
        overdue: severityItems.filter(isOverdue).length,
        avgDaysToClose: avgDays,
      }
    })
    .filter((row) => row.total > 0)

  const weeks = []
  for (let w = 7; w >= 0; w--) {
    const weekStart = startOfWeek(new Date(now.getTime() - w * 7 * 86400000))
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const count = closedWithDates.filter((i) => i._closedAt && i._closedAt >= weekStart && i._closedAt < weekEnd).length
    weeks.push({ label: weekLabel(weekStart), count })
  }

  let sentBackCount = 0
  let blockedCount = 0
  Object.values(activity).forEach((entries) => entries.forEach((e) => {
    if (e.action === 'sent_back') sentBackCount++
    if (e.action === 'flagged_blocked') blockedCount++
  }))

  // Full historical record of closures, newest first — every closed item
  // that has a known close date, so "which day was this closed" and "what's
  // the past record" both have a real answer, not just an 8-week rollup.
  const recentClosures = closedWithDates
    .filter((i) => i._closedAt)
    .sort((a, b) => b._closedAt - a._closedAt)

  return {
    totalItems: items.length,
    totalClosed: closed.length,
    totalActive: active.length,
    complianceRate,
    avgDaysToClose,
    overdueCount: active.filter(isOverdue).length,
    criticalOpenCount: active.filter((i) => i.severity === 'critical').length,
    byTeam,
    bySeverity,
    weeks,
    sentBackCount,
    blockedCount,
    recentClosures,
  }
}

/* --------------------------------------------------------------- pieces */

const Card = ({ children, className = '' }) => (
  <section className={`rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(20,24,28,0.04)] ${className}`}>
    {children}
  </section>
)

const SectionHeader = ({ title, right }) => (
  <div className="flex items-center justify-between gap-3">
    <h3 className="text-base font-bold tracking-tight text-ink">{title}</h3>
    {right}
  </div>
)

function Ring({ value, color, label, size = 96 }) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value))
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const dash = (safe / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={COLOR.line} strokeWidth="8" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-ink">{value === null ? '—' : `${Math.round(value)}%`}</span>
        <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      </div>
    </div>
  )
}

const MetricCard = ({ label, value, sublabel, color, icon }) => (
  <Card className="relative overflow-hidden p-5">
    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-ink tabular-nums">{value}</p>
        <p className="mt-1 text-sm text-muted">{sublabel}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: `${color}14`, color }}>
        {icon}
      </div>
    </div>
  </Card>
)

function StatusStack({ total, open, overdue, closed }) {
  if (!total) return <div className="h-2 rounded-full bg-line" />
  const segments = [
    { value: closed, color: COLOR.green },
    { value: overdue, color: COLOR.red },
    { value: Math.max(0, open - overdue), color: COLOR.blue },
  ]
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
      {segments.map((s, i) => (
        <div key={i} className="h-full" style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
      ))}
    </div>
  )
}

function TeamRow({ team }) {
  const health = team.total ? Math.round((team.closed / team.total) * 100) : 0
  return (
    <div className="rounded-xl border border-line bg-soft/60 p-4 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.overdue ? COLOR.red : COLOR.green }} />
            <span className="truncate text-sm font-bold text-ink">{team.team}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
            <span>{team.total} total</span>
            <span className={team.overdue ? 'font-semibold text-red' : ''}>{team.overdue} overdue</span>
            <span>{team.open} open</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden w-28 sm:block"><StatusStack {...team} /></div>
          <div className="text-right">
            <div className="text-xl font-black tabular-nums text-ink">{health}%</div>
            <div className="text-xs uppercase tracking-wide text-muted">closed</div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>{team.onTimePct !== null ? `${team.onTimePct}% on time` : 'No verified closures'}</span>
        <span className="font-semibold text-green">{team.closed} verified</span>
      </div>
    </div>
  )
}

function SeverityMatrix({ rows }) {
  const totalOpen = rows.reduce((sum, r) => sum + r.open, 0)
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdue, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-soft p-4">
          <p className="text-sm font-semibold text-muted">Open exposure</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-ink">{totalOpen}</p>
        </div>
        <div className="rounded-xl border border-red/20 bg-red/5 p-4">
          <p className="text-sm font-semibold text-muted">Past deadline</p>
          <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: COLOR.red }}>{totalOverdue}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-[110px_1fr_70px] items-center border-b border-line bg-soft px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Severity</span><span>Open</span><span className="text-right">Avg close</span>
        </div>
        <div className="divide-y divide-line">
          {rows.map((row) => {
            const color = SEVERITY_COLOR[row.severity]
            const share = totalOpen ? Math.round((row.open / totalOpen) * 100) : 0
            return (
              <div key={row.severity} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 px-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-bold capitalize text-ink">{row.severity}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">{row.overdue} overdue</div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tabular-nums text-ink">{row.open}</span>
                    <span className="text-xs text-muted">{share}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(row.open ? 5 : 0, share)}%`, backgroundColor: color }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums text-ink">{row.avgDaysToClose !== null ? `${row.avgDaysToClose.toFixed(1)}d` : '—'}</div>
                  <div className="text-xs text-muted">avg</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ClosureChart({ weeks }) {
  const max = Math.max(...weeks.map((w) => w.count), 1)
  return (
    <div className="w-full">
      <div className="flex h-52 items-end gap-3 border-b border-line px-2">
        {weeks.map((week, i) => {
          const height = Math.max(7, (week.count / max) * 100)
          const latest = i === weeks.length - 1
          return (
            <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-2 text-sm font-bold text-muted">{week.count}</span>
              <div
                className="w-full max-w-14 rounded-t-lg transition-all duration-200 group-hover:-translate-y-1"
                style={{ height: `${height}%`, background: latest ? `linear-gradient(180deg, ${COLOR.blue}, ${COLOR.purple})` : COLOR.blue }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-3 px-2">
        {weeks.map((week, i) => <span key={i} className="flex-1 truncate text-center text-xs font-medium text-muted">{week.label}</span>)}
      </div>
    </div>
  )
}

function EscalationVisual({ sentBack, blocked }) {
  const total = sentBack + blocked
  const sentBackPct = total ? (sentBack / total) * 100 : 0
  const blockedPct = total ? (blocked / total) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Escalation signals</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-ink">{total}</p>
        </div>
        <span className="text-sm text-muted">total</span>
      </div>

      <div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-soft">
          {sentBack > 0 && <div style={{ width: `${sentBackPct}%`, backgroundColor: COLOR.red }} />}
          {blocked > 0 && <div style={{ width: `${blockedPct}%`, backgroundColor: COLOR.amber }} />}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{Math.round(sentBackPct)}% sent back</span>
          <span>{Math.round(blockedPct)}% blocked</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red/20 bg-red/5 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.red }} />
            <span className="text-sm font-semibold text-muted">Sent back</span>
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums" style={{ color: COLOR.red }}>{sentBack}</p>
          <p className="mt-1 text-sm text-muted">Rework</p>
        </div>
        <div className="rounded-xl border border-amber/20 bg-amber/5 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.amber }} />
            <span className="text-sm font-semibold text-muted">Blocked</span>
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums" style={{ color: COLOR.amber }}>{blocked}</p>
          <p className="mt-1 text-sm text-muted">Intervention</p>
        </div>
      </div>
    </div>
  )
}

// Full closure history — every task that's been closed, newest first, with
// the exact day (including weekday) it closed, how long it took from
// creation, and whether it beat its deadline. This is the "past record"
// view: the 8-week chart shows the trend, this shows the actual log behind it.
function ClosureLog({ items }) {
  if (!items.length) {
    return <p className="rounded-xl bg-soft p-6 text-center text-sm text-muted">No closures yet — this fills in as tasks get closed.</p>
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[1.7fr_0.9fr_0.9fr_1.2fr_0.7fr] items-center border-b border-line bg-soft px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Task</span><span>Team</span><span>Severity</span><span>Closed on</span><span className="text-right">Days open</span>
      </div>
      <div className="max-h-[440px] divide-y divide-line overflow-y-auto">
        {items.map((item) => {
          const color = SEVERITY_COLOR[item.severity] || COLOR.muted
          return (
            <div key={item.id} className="grid grid-cols-[1.7fr_0.9fr_0.9fr_1.2fr_0.7fr] items-center gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.owner_name}</p>
              </div>
              <span className="truncate text-sm text-muted">{item.team || '—'}</span>
              <span className="flex items-center gap-1.5 text-sm capitalize text-ink">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {item.severity || '—'}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{formatClosedDate(item._closedAt)}</p>
                {item._onTime !== null && (
                  <span className={`text-xs font-semibold ${item._onTime ? 'text-green' : 'text-red'}`}>
                    {item._onTime ? 'On time' : 'Late'}
                  </span>
                )}
              </div>
              <span className="text-right text-sm font-black tabular-nums text-ink">
                {item._daysToClose !== null ? `${item._daysToClose}d` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- main */

export default function GovernanceAnalytics({ items = [], activity = {} }) {
  const m = useMemo(() => computeMetrics(items, activity), [items, activity])
  const closurePct = m.totalItems ? Math.round((m.totalClosed / m.totalItems) * 100) : 0
  const activePct = m.totalItems ? Math.round((m.totalActive / m.totalItems) * 100) : 0
  const complianceColor = m.complianceRate === null ? COLOR.muted
    : m.complianceRate >= 80 ? COLOR.green
    : m.complianceRate >= 50 ? COLOR.amber
    : COLOR.red

  return (
    <div className="min-h-full bg-[#F8FAFB] p-4 sm:p-6 lg:p-8" style={{ fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif' }}>
      <div className="mx-auto max-w-7xl space-y-4">

        {/* Header */}
        <div className="relative overflow-hidden rounded-[14px] bg-[#14181C] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute right-[-60px] top-[-80px] h-64 w-64 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${COLOR.blue}, transparent 68%)` }} />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.green }} />
                <span className="text-xs uppercase tracking-[0.18em] text-gray-400">ETCH · TEAM ANALYTICS</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Team Analytics</h2>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-400">Total</div>
                <div className="mt-1 text-xl font-black tabular-nums">{m.totalItems}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-400">Active</div>
                <div className="mt-1 text-xl font-black tabular-nums">{m.totalActive}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Ring value={m.complianceRate} color={complianceColor} label="on-time" size={92} />
              <div>
                <p className="text-sm font-semibold text-muted">Compliance</p>
                <p className="mt-1 text-sm text-muted">On-time closures</p>
              </div>
            </div>
          </Card>
          <MetricCard label="Closure speed" value={m.avgDaysToClose !== null ? `${m.avgDaysToClose.toFixed(1)}d` : '—'} sublabel="Average time to close" color={COLOR.blue} icon="↗" />
          <MetricCard label="Overdue" value={m.overdueCount} sublabel="Needs action" color={COLOR.red} icon="!" />
          <MetricCard label="Critical open" value={m.criticalOpenCount} sublabel="Highest priority" color={COLOR.red} icon="◆" />
          <MetricCard label="Closed" value={m.totalClosed} sublabel={`${closurePct}% complete`} color={COLOR.green} icon="✓" />
        </div>

        {/* Portfolio */}
        <Card className="p-5">
          <SectionHeader title="Portfolio status" />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="flex h-10 overflow-hidden rounded-xl bg-soft">
                {m.totalItems > 0 && (
                  <>
                    <div className="flex items-center justify-center text-sm font-bold text-white" style={{ width: `${closurePct}%`, backgroundColor: COLOR.green }}>
                      {closurePct >= 12 ? `${m.totalClosed} CLOSED` : ''}
                    </div>
                    <div className="flex items-center justify-center text-sm font-bold text-white" style={{ width: `${activePct}%`, backgroundColor: COLOR.blue }}>
                      {activePct >= 12 ? `${m.totalActive} ACTIVE` : ''}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.green }} />Closed</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.blue }} />Active</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.red }} />Overdue {m.overdueCount}</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR.amber }} />Critical {m.criticalOpenCount}</span>
              </div>
            </div>
            <div className="rounded-xl bg-soft p-4">
              <p className="text-sm font-semibold text-muted">Closure ratio</p>
              <div className="mt-1 text-3xl font-black tabular-nums text-ink">{closurePct}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${closurePct}%`, backgroundColor: COLOR.green }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Team + severity */}
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5">
            <SectionHeader title="Team performance" right={
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">{m.byTeam.length} teams</span>
            } />
            <div className="mt-4 space-y-3">
              {m.byTeam.length === 0
                ? <p className="rounded-xl bg-soft p-6 text-center text-sm text-muted">No team data available.</p>
                : m.byTeam.map((team) => <TeamRow key={team.team} team={team} />)}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Risk by severity" />
            <div className="mt-4">
              {m.bySeverity.length
                ? <SeverityMatrix rows={m.bySeverity} />
                : <p className="rounded-xl bg-soft p-6 text-center text-sm text-muted">No severity data available.</p>}
            </div>
          </Card>
        </div>

        {/* Closures + escalations */}
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <SectionHeader title="Closures · 8 weeks" right={
              <span className="rounded-lg bg-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue">Weekly trend</span>
            } />
            <div className="mt-5"><ClosureChart weeks={m.weeks} /></div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Escalations" />
            <div className="mt-5"><EscalationVisual sentBack={m.sentBackCount} blocked={m.blockedCount} /></div>
          </Card>
        </div>

        {/* Closure log — the full past record, one row per closed task */}
        <Card className="p-5">
          <SectionHeader title="Closure log" right={
            <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">{m.recentClosures.length} closed</span>
          } />
          <div className="mt-4">
            <ClosureLog items={m.recentClosures} />
          </div>
        </Card>

      </div>
    </div>
  )
}         