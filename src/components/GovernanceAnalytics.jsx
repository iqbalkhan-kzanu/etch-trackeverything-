import { useMemo } from 'react'

const COLOR = {
  ink: '#14181C',
  blue: '#2B6CB0',
  amber: '#D98C2B',
  green: '#2F8F5B',
  red: '#C1443C',
  purple: '#7C5CBF',
  muted: '#5C6670',
  line: '#E4E7EA',
  soft: '#F6F8FA',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
const SEVERITY_COLOR = {
  critical: COLOR.red,
  high: COLOR.amber,
  medium: COLOR.blue,
  low: COLOR.muted,
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / msPerDay)
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function weekLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function computeMetrics(items = [], activity = {}) {
  const closed = items.filter((i) => i.status === 'closed')
  const active = items.filter((i) => i.status !== 'closed')
  const now = new Date()

  const closedWithDates = closed.map((i) => {
    const closedAtRaw = i.close_snapshot?.closed_at || i.verified_at
    const closedAt = closedAtRaw ? new Date(closedAtRaw) : null
    const deadline = new Date(i.deadline)
    const onTime = closedAt
      ? closedAt <= new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59)
      : null

    const entries = activity[i.id] || []
    const createdEntry = entries.find((e) => e.action === 'created')
    const startDate = createdEntry ? new Date(createdEntry.created_at) : null
    const daysToClose = startDate && closedAt ? daysBetween(startDate, closedAt) : null

    return { ...i, _closedAt: closedAt, _onTime: onTime, _daysToClose: daysToClose }
  })

  const withKnownOnTime = closedWithDates.filter((i) => i._onTime !== null)
  const onTimeCount = withKnownOnTime.filter((i) => i._onTime).length
  const complianceRate = withKnownOnTime.length
    ? (onTimeCount / withKnownOnTime.length) * 100
    : null

  const withKnownDuration = closedWithDates.filter(
    (i) => i._daysToClose !== null && i._daysToClose >= 0
  )
  const avgDaysToClose = withKnownDuration.length
    ? withKnownDuration.reduce((sum, i) => sum + i._daysToClose, 0) / withKnownDuration.length
    : null

  const isOverdue = (i) =>
    i.status !== 'closed' && i.deadline && new Date(i.deadline) < new Date(now.toDateString())

  const teams = Array.from(new Set(items.map((i) => i.team).filter(Boolean)))
  const byTeam = teams.map((team) => {
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
  }).sort((a, b) => b.overdue - a.overdue || b.total - a.total)

  const bySeverity = SEVERITY_ORDER.map((severity) => {
    const sevItems = items.filter((i) => i.severity === severity)
    const sevClosed = closedWithDates.filter(
      (i) => i.severity === severity && i._daysToClose !== null && i._daysToClose >= 0
    )
    const avgDays = sevClosed.length
      ? sevClosed.reduce((s, i) => s + i._daysToClose, 0) / sevClosed.length
      : null

    return {
      severity,
      total: sevItems.length,
      open: sevItems.filter((i) => i.status !== 'closed').length,
      overdue: sevItems.filter(isOverdue).length,
      avgDaysToClose: avgDays,
    }
  }).filter((s) => s.total > 0)

  const weeks = []
  for (let w = 7; w >= 0; w--) {
    const weekStart = startOfWeek(new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000))
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const count = closedWithDates.filter(
      (i) => i._closedAt && i._closedAt >= weekStart && i._closedAt < weekEnd
    ).length
    weeks.push({ label: weekLabel(weekStart), count })
  }

  let sentBackCount = 0
  let blockedCount = 0
  Object.values(activity).forEach((entries) => {
    entries.forEach((e) => {
      if (e.action === 'sent_back') sentBackCount++
      if (e.action === 'flagged_blocked') blockedCount++
    })
  })

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
  }
}

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(20,24,28,0.04)] ${className}`}>
      {children}
    </section>
  )
}

function SectionHeader({ eyebrow, title, description, right }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-blue mb-1">
            {eyebrow}
          </p>
        )}
        <h3 className="text-base font-bold tracking-tight text-ink">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {right}
    </div>
  )
}

function Ring({ value, color, label, size = 112 }) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value))
  const r = 42
  const circumference = 2 * Math.PI * r
  const dash = (safe / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={COLOR.line} strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-ink">
          {value === null ? '—' : `${Math.round(value)}%`}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted">{label}</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sublabel, color, icon }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-ink tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] text-muted">{sublabel}</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
          style={{ backgroundColor: `${color}14`, color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}

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
        <div
          key={i}
          className="h-full transition-all"
          style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
        />
      ))}
    </div>
  )
}

function TeamRow({ team }) {
  const health = team.total ? Math.round((team.closed / team.total) * 100) : 0

  return (
    <div className="rounded-xl border border-line bg-soft/60 p-3 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.overdue ? COLOR.red : COLOR.green }} />
            <span className="truncate text-sm font-bold text-ink">{team.team}</span>
          </div>
          <div className="mt-1 flex gap-3 font-mono text-[9px] uppercase tracking-wide text-muted">
            <span>{team.total} total</span>
            <span className={team.overdue ? 'text-red' : ''}>{team.overdue} overdue</span>
            <span>{team.open} open</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden w-28 sm:block">
            <StatusStack {...team} />
          </div>
          <div className="text-right">
            <div className="text-lg font-black tabular-nums text-ink">{health}%</div>
            <div className="font-mono text-[8px] uppercase tracking-wide text-muted">closed</div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
        <span>
          {team.onTimePct !== null ? `${team.onTimePct}% closed on-time` : 'No verified closures yet'}
        </span>
        <span className="font-mono text-green">{team.closed} verified</span>
      </div>
    </div>
  )
}

function SeverityMatrix({ rows }) {
  const maxOpen = Math.max(...rows.map((x) => x.open), 1)

  return (
    <div className="space-y-3">
      {rows.map((s) => {
        const pct = Math.max(4, (s.open / maxOpen) * 100)
        const color = SEVERITY_COLOR[s.severity]

        return (
          <div key={s.severity}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold capitalize text-ink">{s.severity}</span>
              </div>
              <span className="font-mono text-[10px] text-muted">
                {s.open} open · {s.overdue} overdue
              </span>
            </div>

            <div className="relative h-7 overflow-hidden rounded-lg bg-soft">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all"
                style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.88 }}
              />
              <div className="relative flex h-full items-center justify-between px-2.5">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white mix-blend-difference">
                  workload
                </span>
                <span className="font-mono text-[9px] font-bold text-ink">
                  {s.avgDaysToClose !== null ? `${s.avgDaysToClose.toFixed(1)}d avg close` : 'No closure data'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClosureChart({ weeks }) {
  const max = Math.max(...weeks.map((w) => w.count), 1)

  return (
    <div className="relative">
      <div className="flex h-44 items-end gap-2 border-b border-line px-1">
        {weeks.map((w, i) => {
          const height = Math.max(5, (w.count / max) * 100)
          const isLatest = i === weeks.length - 1

          return (
            <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[9px] font-bold text-muted opacity-0 transition group-hover:opacity-100">
                {w.count}
              </span>
              <div className="relative w-full max-w-12" style={{ height: `${height}%` }}>
                <div
                  className="absolute inset-0 rounded-t-lg transition-all group-hover:-translate-y-1"
                  style={{
                    background: isLatest
                      ? `linear-gradient(180deg, ${COLOR.blue}, ${COLOR.purple})`
                      : `linear-gradient(180deg, ${COLOR.blue}cc, ${COLOR.blue}55)`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-2 px-1">
        {weeks.map((w, i) => (
          <span key={i} className="flex-1 truncate text-center font-mono text-[8px] text-muted">
            {w.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function EscalationVisual({ sentBack, blocked }) {
  const total = sentBack + blocked
  const sentPct = total ? (sentBack / total) * 100 : 0
  const blockedPct = total ? (blocked / total) * 100 : 0

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-5">
      <div>
        <div className="mb-3 flex h-5 overflow-hidden rounded-full bg-soft">
          <div style={{ width: `${sentPct}%`, backgroundColor: COLOR.red }} />
          <div style={{ width: `${blockedPct}%`, backgroundColor: COLOR.amber }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-red/20 bg-red/5 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.red }} />
              <span className="text-[10px] font-semibold text-muted">SENT BACK</span>
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: COLOR.red }}>{sentBack}</div>
            <div className="font-mono text-[8px] uppercase text-muted">manager rework</div>
          </div>

          <div className="rounded-xl border border-amber/20 bg-amber/5 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.amber }} />
              <span className="text-[10px] font-semibold text-muted">BLOCKED</span>
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: COLOR.amber }}>{blocked}</div>
            <div className="font-mono text-[8px] uppercase text-muted">workflow friction</div>
          </div>
        </div>
      </div>

      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-8 border-soft">
        <div
          className="absolute inset-[-8px] rounded-full"
          style={{
            border: `8px solid transparent`,
            borderTopColor: total ? COLOR.red : COLOR.line,
            borderRightColor: total ? COLOR.amber : COLOR.line,
            transform: 'rotate(35deg)',
          }}
        />
        <div className="text-center">
          <div className="text-xl font-black tabular-nums text-ink">{total}</div>
          <div className="font-mono text-[7px] uppercase tracking-wide text-muted">signals</div>
        </div>
      </div>
    </div>
  )
}

export default function GovernanceAnalytics({ items = [], activity = {} }) {
  const m = useMemo(() => computeMetrics(items, activity), [items, activity])

  const closurePct = m.totalItems ? Math.round((m.totalClosed / m.totalItems) * 100) : 0
  const activePct = m.totalItems ? Math.round((m.totalActive / m.totalItems) * 100) : 0

  return (
    <div className="min-h-full bg-[#F8FAFB] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Command header */}
        <div className="relative overflow-hidden rounded-2xl bg-[#14181C] p-6 text-white shadow-lg">
          <div
            className="pointer-events-none absolute right-[-60px] top-[-80px] h-64 w-64 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${COLOR.blue}, transparent 68%)` }}
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: COLOR.green }} />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
                  ETCH · GOVERNANCE CONTROL
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Governance Analytics</h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">
                A visual command view of accountability, closure velocity, deadline compliance and escalation pressure.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="font-mono text-[8px] uppercase tracking-wider text-gray-500">Total actions</div>
                <div className="mt-1 text-xl font-black tabular-nums">{m.totalItems}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="font-mono text-[8px] uppercase tracking-wider text-gray-500">Active</div>
                <div className="mt-1 text-xl font-black tabular-nums">{m.totalActive}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Executive metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card className="relative overflow-hidden p-5 lg:col-span-1">
            <div className="flex items-center gap-4">
              <Ring
                value={m.complianceRate}
                color={
                  m.complianceRate === null
                    ? COLOR.muted
                    : m.complianceRate >= 80
                      ? COLOR.green
                      : m.complianceRate >= 50
                        ? COLOR.amber
                        : COLOR.red
                }
                label="on-time"
                size={92}
              />
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted">Compliance</p>
                <p className="mt-1 text-xs leading-5 text-muted">Closed on or before deadline.</p>
              </div>
            </div>
          </Card>

          <MetricCard
            label="Closure Velocity"
            value={m.avgDaysToClose !== null ? `${m.avgDaysToClose.toFixed(1)}d` : '—'}
            sublabel="Average time to verified closure"
            color={COLOR.blue}
            icon="↗"
          />
          <MetricCard
            label="Overdue Active"
            value={m.overdueCount}
            sublabel="Past deadline and unresolved"
            color={COLOR.red}
            icon="!"
          />
          <MetricCard
            label="Critical Open"
            value={m.criticalOpenCount}
            sublabel="Critical items requiring attention"
            color={COLOR.red}
            icon="◆"
          />
          <MetricCard
            label="Verified Closed"
            value={m.totalClosed}
            sublabel={`${closurePct}% of all actions`}
            color={COLOR.green}
            icon="✓"
          />
        </div>

        {/* Portfolio health strip */}
        <Card className="p-5">
          <SectionHeader
            eyebrow="Portfolio health"
            title="Where the action load sits"
            description="The same information is now represented as a visual status composition."
          />

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="flex h-10 overflow-hidden rounded-xl bg-soft">
                {m.totalItems > 0 && (
                  <>
                    <div
                      className="flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ width: `${closurePct}%`, backgroundColor: COLOR.green }}
                    >
                      {closurePct >= 12 ? `${m.totalClosed} CLOSED` : ''}
                    </div>
                    <div
                      className="flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ width: `${Math.max(0, activePct)}%`, backgroundColor: COLOR.blue }}
                    >
                      {activePct >= 12 ? `${m.totalActive} ACTIVE` : ''}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-wide text-muted">
                <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green" />Verified closed</span>
                <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue" />Active workload</span>
                <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red" />Overdue {m.overdueCount}</span>
                <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber" />Critical {m.criticalOpenCount}</span>
              </div>
            </div>

            <div className="rounded-xl bg-soft p-4">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Closure ratio</div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-black tabular-nums text-ink">{closurePct}%</span>
                <span className="pb-1 text-[10px] text-muted">portfolio closed</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${closurePct}%`, backgroundColor: COLOR.green }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Team + severity */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5">
            <SectionHeader
              eyebrow="Accountability"
              title="Team performance"
              description="Workload, overdue pressure and closure health by team."
              right={<span className="rounded-full bg-soft px-2.5 py-1 font-mono text-[9px] text-muted">{m.byTeam.length} teams</span>}
            />
            <div className="mt-5 space-y-3">
              {m.byTeam.length === 0 ? (
                <p className="rounded-xl bg-soft p-6 text-center text-xs text-muted">No team data yet.</p>
              ) : (
                m.byTeam.map((team) => <TeamRow key={team.team} team={team} />)
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              eyebrow="Risk distribution"
              title="Severity workload"
              description="Open volume, overdue exposure and average closure speed."
            />
            <div className="mt-5">
              {m.bySeverity.length ? (
                <SeverityMatrix rows={m.bySeverity} />
              ) : (
                <p className="rounded-xl bg-soft p-6 text-center text-xs text-muted">No severity data yet.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Trend + escalation */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <SectionHeader
              eyebrow="Closure velocity"
              title="Verified closures · last 8 weeks"
              description="A rising profile indicates the organization is converting actions into verified closure."
              right={
                <div className="rounded-lg bg-blue/10 px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-blue">
                  Weekly trend
                </div>
              }
            />
            <div className="mt-6">
              <ClosureChart weeks={m.weeks} />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              eyebrow="Escalation intelligence"
              title="Where closure friction appears"
              description="Signals extracted from the activity trail."
            />
            <div className="mt-6">
              <EscalationVisual sentBack={m.sentBackCount} blocked={m.blockedCount} />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber/10 text-xs font-bold text-amber">
                  i
                </div>
                <p className="text-[11px] leading-5 text-muted">
                  High sent-back or blocked counts indicate rework and workflow friction.
                  Use this view to identify where management intervention may be needed.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Operating model */}
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <SectionHeader
              eyebrow="Governance operating model"
              title="From action creation to verified closure"
              description="The workflow itself is represented as a visual control path."
            />
          </div>

          <div className="grid md:grid-cols-4">
            {[
              { n: '01', title: 'OPEN', desc: 'Action logged with owner and deadline.', color: COLOR.muted },
              { n: '02', title: 'IN PROGRESS', desc: 'Owner executes and records evidence.', color: COLOR.blue },
              { n: '03', title: 'READY TO CLOSE', desc: 'Evidence submitted for independent verification.', color: COLOR.amber },
              { n: '04', title: 'CLOSED', desc: 'Verifier confirms completion and closes the loop.', color: COLOR.green },
            ].map((stage, i) => (
              <div
                key={stage.title}
                className="relative border-b border-line p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-wider" style={{ color: stage.color }}>
                    {stage.n}
                  </span>
                  {i < 3 && <span className="hidden text-muted md:block">→</span>}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-black tracking-wide text-ink">{stage.title}</span>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted">{stage.desc}</p>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  )
}
    