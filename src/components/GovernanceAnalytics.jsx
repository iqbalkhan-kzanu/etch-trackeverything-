import { useMemo } from 'react'

// Reuses the same palette as Tracker.jsx so it feels native, not bolted on.
const COLOR = {
  ink: '#14181C',
  blue: '#2B6CB0',
  amber: '#D98C2B',
  green: '#2F8F5B',
  red: '#C1443C',
  purple: '#7C5CBF',
  muted: '#5C6670',
  line: '#E4E7EA',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
const SEVERITY_COLOR = { critical: COLOR.red, high: COLOR.amber, medium: COLOR.blue, low: COLOR.muted }

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / msPerDay)
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function weekLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---- Core metric computation, all derived from `items` + `activity` you already have loaded ----
function computeMetrics(items, activity) {
  const closed = items.filter((i) => i.status === 'closed')
  const active = items.filter((i) => i.status !== 'closed')
  const now = new Date()

  // Closed-on-time: prefer close_snapshot.closed_at, fall back to verified_at
  const closedWithDates = closed.map((i) => {
    const closedAtRaw = i.close_snapshot?.closed_at || i.verified_at
    const closedAt = closedAtRaw ? new Date(closedAtRaw) : null
    const deadline = new Date(i.deadline)
    const onTime = closedAt ? closedAt <= new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59) : null
    // Time-to-close needs a start point; use earliest activity entry (created) if available
    const entries = activity[i.id] || []
    const createdEntry = entries.find((e) => e.action === 'created')
    const startDate = createdEntry ? new Date(createdEntry.created_at) : null
    const daysToClose = startDate && closedAt ? daysBetween(startDate, closedAt) : null
    return { ...i, _closedAt: closedAt, _onTime: onTime, _daysToClose: daysToClose }
  })

  const withKnownOnTime = closedWithDates.filter((i) => i._onTime !== null)
  const onTimeCount = withKnownOnTime.filter((i) => i._onTime).length
  const complianceRate = withKnownOnTime.length > 0 ? (onTimeCount / withKnownOnTime.length) * 100 : null

  const withKnownDuration = closedWithDates.filter((i) => i._daysToClose !== null && i._daysToClose >= 0)
  const avgDaysToClose = withKnownDuration.length > 0
    ? withKnownDuration.reduce((sum, i) => sum + i._daysToClose, 0) / withKnownDuration.length
    : null

  const overdueActive = active.filter((i) => new Date(i.deadline) < new Date(now.toDateString()))

  // By team
  const teams = Array.from(new Set(items.map((i) => i.team).filter(Boolean)))
  const byTeam = teams.map((team) => {
    const teamItems = items.filter((i) => i.team === team)
    const teamClosed = closedWithDates.filter((i) => i.team === team && i._onTime !== null)
    const teamOnTime = teamClosed.filter((i) => i._onTime).length
    return {
      team,
      total: teamItems.length,
      open: teamItems.filter((i) => i.status !== 'closed').length,
      overdue: teamItems.filter((i) => i.status !== 'closed' && new Date(i.deadline) < new Date(now.toDateString())).length,
      closed: teamItems.filter((i) => i.status === 'closed').length,
      onTimePct: teamClosed.length > 0 ? Math.round((teamOnTime / teamClosed.length) * 100) : null,
    }
  }).sort((a, b) => b.overdue - a.overdue || b.total - a.total)

  // By severity
  const bySeverity = SEVERITY_ORDER.map((sev) => {
    const sevItems = items.filter((i) => i.severity === sev)
    const sevClosed = closedWithDates.filter((i) => i.severity === sev && i._daysToClose !== null && i._daysToClose >= 0)
    const avgDays = sevClosed.length > 0 ? sevClosed.reduce((s, i) => s + i._daysToClose, 0) / sevClosed.length : null
    return {
      severity: sev,
      total: sevItems.length,
      open: sevItems.filter((i) => i.status !== 'closed').length,
      overdue: sevItems.filter((i) => i.status !== 'closed' && new Date(i.deadline) < new Date(now.toDateString())).length,
      avgDaysToClose: avgDays,
    }
  }).filter((s) => s.total > 0)

  // Closure trend, last 8 weeks
  const weeks = []
  for (let w = 7; w >= 0; w--) {
    const weekStart = startOfWeek(new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000))
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const count = closedWithDates.filter((i) => i._closedAt && i._closedAt >= weekStart && i._closedAt < weekEnd).length
    weeks.push({ label: weekLabel(weekStart), count })
  }
  const maxWeekCount = Math.max(1, ...weeks.map((w) => w.count))

  // Escalation signals from activity log
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
    overdueCount: overdueActive.length,
    criticalOpenCount: active.filter((i) => i.severity === 'critical').length,
    byTeam,
    bySeverity,
    weeks,
    maxWeekCount,
    sentBackCount,
    blockedCount,
  }
}

function HeadlineCard({ label, value, sublabel, color }) {
  return (
    <div className="relative overflow-hidden border border-line rounded-xl bg-surface px-5 py-4">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink tabular-nums">{value}</p>
      {sublabel && <p className="text-xs text-ink-muted mt-1">{sublabel}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color, suffix = '' }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-ink-muted truncate">{label}</span>
      <div className="flex-1 h-3 bg-line rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs text-ink">{value}{suffix}</span>
    </div>
  )
}

export default function GovernanceAnalytics({ items, activity }) {
  const m = useMemo(() => computeMetrics(items, activity), [items, activity])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Governance Analytics</h2>
        <p className="text-sm text-ink-muted">Compliance, closure velocity, and escalation signals across all teams.</p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <HeadlineCard
          label="Compliance Rate"
          value={m.complianceRate !== null ? `${m.complianceRate.toFixed(0)}%` : '—'}
          sublabel="Closed on or before deadline"
          color={m.complianceRate !== null && m.complianceRate >= 80 ? COLOR.green : m.complianceRate !== null && m.complianceRate >= 50 ? COLOR.amber : COLOR.red}
        />
        <HeadlineCard
          label="Avg Time to Close"
          value={m.avgDaysToClose !== null ? `${m.avgDaysToClose.toFixed(1)}d` : '—'}
          sublabel="From logged to closed"
          color={COLOR.blue}
        />
        <HeadlineCard label="Overdue (Active)" value={m.overdueCount} sublabel="Past deadline, not closed" color={COLOR.red} />
        <HeadlineCard label="Critical Open" value={m.criticalOpenCount} sublabel="Critical severity, unresolved" color={COLOR.red} />
        <HeadlineCard label="Total Closed" value={m.totalClosed} sublabel={`of ${m.totalItems} total items`} color={COLOR.green} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By team */}
        <div className="border border-line rounded-xl bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">By Team</h3>
          <div className="space-y-3">
            {m.byTeam.length === 0 && <p className="text-xs text-ink-muted">No team data yet.</p>}
            {m.byTeam.map((t) => (
              <div key={t.team} className="border-b border-line last:border-0 pb-3 last:pb-0">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium text-ink">{t.team}</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {t.onTimePct !== null ? `${t.onTimePct}% on-time` : 'no closures yet'}
                  </span>
                </div>
                <div className="flex gap-4 font-mono text-[11px] text-ink-muted">
                  <span>{t.total} total</span>
                  <span style={{ color: t.overdue > 0 ? COLOR.red : COLOR.muted }}>{t.overdue} overdue</span>
                  <span>{t.open} open</span>
                  <span style={{ color: COLOR.green }}>{t.closed} closed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By severity */}
        <div className="border border-line rounded-xl bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">By Severity — Open Volume & Close Speed</h3>
          <div className="space-y-3">
            {m.bySeverity.map((s) => (
              <div key={s.severity}>
                <BarRow
                  label={s.severity}
                  value={s.open}
                  max={Math.max(...m.bySeverity.map((x) => x.open), 1)}
                  color={SEVERITY_COLOR[s.severity]}
                  suffix=" open"
                />
                <p className="ml-27 pl-[6.75rem] font-mono text-[10px] text-ink-muted mt-0.5">
                  avg close: {s.avgDaysToClose !== null ? `${s.avgDaysToClose.toFixed(1)}d` : '—'} · {s.overdue} overdue
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Closure trend */}
        <div className="border border-line rounded-xl bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Closures per Week (last 8 weeks)</h3>
          <div className="flex items-end gap-2 h-32">
            {m.weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(4, (w.count / m.maxWeekCount) * 100)}%`,
                    backgroundColor: COLOR.blue,
                  }}
                  title={`${w.count} closed`}
                />
                <span className="font-mono text-[9px] text-ink-muted rotate-0">{w.count}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            {m.weeks.map((w, i) => (
              <span key={i} className="flex-1 text-center font-mono text-[9px] text-ink-muted truncate">{w.label}</span>
            ))}
          </div>
        </div>

        {/* Escalation signals */}
        <div className="border border-line rounded-xl bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Escalation Signals</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Items sent back by a manager</span>
              <span className="font-mono text-lg font-bold" style={{ color: COLOR.red }}>{m.sentBackCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Times flagged as blocked</span>
              <span className="font-mono text-lg font-bold" style={{ color: COLOR.amber }}>{m.blockedCount}</span>
            </div>
            <p className="text-xs text-ink-muted pt-2 border-t border-line">
              High counts here indicate rework or friction in the closure process — worth reviewing which items or teams are driving it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}     