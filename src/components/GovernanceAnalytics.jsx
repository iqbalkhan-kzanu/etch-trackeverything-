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

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)

  d.setDate(diff)
  d.setHours(0, 0, 0, 0)

  return d
}

function weekLabel(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function computeMetrics(items = [], activity = {}) {
  const closed = items.filter((item) => item.status === 'closed')
  const active = items.filter((item) => item.status !== 'closed')
  const now = new Date()

  const closedWithDates = closed.map((item) => {
    const closedAtRaw =
      item.close_snapshot?.closed_at || item.verified_at

    const closedAt = closedAtRaw ? new Date(closedAtRaw) : null
    const deadline = new Date(item.deadline)

    const onTime = closedAt
      ? closedAt <=
        new Date(
          deadline.getFullYear(),
          deadline.getMonth(),
          deadline.getDate(),
          23,
          59,
          59
        )
      : null

    const entries = activity[item.id] || []
    const created = entries.find((entry) => entry.action === 'created')
    const startDate = created
      ? new Date(created.created_at)
      : null

    const daysToClose =
      startDate && closedAt
        ? daysBetween(startDate, closedAt)
        : null

    return {
      ...item,
      _closedAt: closedAt,
      _onTime: onTime,
      _daysToClose: daysToClose,
    }
  })

  const knownOnTime = closedWithDates.filter(
    (item) => item._onTime !== null
  )

  const onTimeCount = knownOnTime.filter(
    (item) => item._onTime
  ).length

  const complianceRate = knownOnTime.length
    ? (onTimeCount / knownOnTime.length) * 100
    : null

  const knownDuration = closedWithDates.filter(
    (item) =>
      item._daysToClose !== null &&
      item._daysToClose >= 0
  )

  const avgDaysToClose = knownDuration.length
    ? knownDuration.reduce(
        (sum, item) => sum + item._daysToClose,
        0
      ) / knownDuration.length
    : null

  const isOverdue = (item) =>
    item.status !== 'closed' &&
    item.deadline &&
    new Date(item.deadline) < new Date(now.toDateString())

  const teams = Array.from(
    new Set(
      items
        .map((item) => item.team)
        .filter(Boolean)
    )
  )

  const byTeam = teams
    .map((team) => {
      const teamItems = items.filter(
        (item) => item.team === team
      )

      const teamClosed = closedWithDates.filter(
        (item) =>
          item.team === team &&
          item._onTime !== null
      )

      const teamOnTime = teamClosed.filter(
        (item) => item._onTime
      ).length

      return {
        team,
        total: teamItems.length,
        open: teamItems.filter(
          (item) => item.status !== 'closed'
        ).length,
        overdue: teamItems.filter(isOverdue).length,
        closed: teamItems.filter(
          (item) => item.status === 'closed'
        ).length,
        onTimePct: teamClosed.length
          ? Math.round(
              (teamOnTime / teamClosed.length) * 100
            )
          : null,
      }
    })
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        b.total - a.total
    )

  const bySeverity = SEVERITY_ORDER
    .map((severity) => {
      const severityItems = items.filter(
        (item) => item.severity === severity
      )

      const severityClosed = closedWithDates.filter(
        (item) =>
          item.severity === severity &&
          item._daysToClose !== null &&
          item._daysToClose >= 0
      )

      const avgDays = severityClosed.length
        ? severityClosed.reduce(
            (sum, item) =>
              sum + item._daysToClose,
            0
          ) / severityClosed.length
        : null

      return {
        severity,
        total: severityItems.length,
        open: severityItems.filter(
          (item) => item.status !== 'closed'
        ).length,
        overdue: severityItems.filter(isOverdue).length,
        avgDaysToClose: avgDays,
      }
    })
    .filter((item) => item.total > 0)

  const weeks = []

  for (let w = 7; w >= 0; w--) {
    const weekStart = startOfWeek(
      new Date(
        now.getTime() -
          w * 7 * 24 * 60 * 60 * 1000
      )
    )

    const weekEnd = new Date(
      weekStart.getTime() +
        7 * 24 * 60 * 60 * 1000
    )

    const count = closedWithDates.filter(
      (item) =>
        item._closedAt &&
        item._closedAt >= weekStart &&
        item._closedAt < weekEnd
    ).length

    weeks.push({
      label: weekLabel(weekStart),
      count,
    })
  }

  let sentBackCount = 0
  let blockedCount = 0

  Object.values(activity).forEach((entries) => {
    entries.forEach((entry) => {
      if (entry.action === 'sent_back') {
        sentBackCount++
      }

      if (entry.action === 'flagged_blocked') {
        blockedCount++
      }
    })
  })

  return {
    totalItems: items.length,
    totalClosed: closed.length,
    totalActive: active.length,
    complianceRate,
    avgDaysToClose,
    overdueCount: active.filter(isOverdue).length,
    criticalOpenCount: active.filter(
      (item) => item.severity === 'critical'
    ).length,
    byTeam,
    bySeverity,
    weeks,
    sentBackCount,
    blockedCount,
  }
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`
        rounded-xl
        border border-line
        bg-white
        shadow-sm
        ${className}
      `}
    >
      {children}
    </section>
  )
}

function SectionHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-bold text-ink">
        {title}
      </h3>

      {right}
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  color,
  icon,
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black text-ink">
            {value}
          </p>

          <p className="mt-1 text-sm text-muted">
            {helper}
          </p>
        </div>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold"
          style={{
            backgroundColor: `${color}14`,
            color,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}

function ComplianceCard({ value }) {
  const safe =
    value === null
      ? 0
      : Math.max(0, Math.min(100, value))

  const radius = 42
  const circumference = 2 * Math.PI * radius
  const dash =
    (safe / 100) * circumference

  const color =
    value === null
      ? COLOR.muted
      : value >= 80
        ? COLOR.green
        : value >= 50
          ? COLOR.amber
          : COLOR.red

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="-rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={COLOR.line}
              strokeWidth="8"
            />

            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${
                circumference - dash
              }`}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black text-ink">
              {value === null
                ? '—'
                : `${Math.round(value)}%`}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-muted">
            On-time compliance
          </p>

          <p className="mt-1 text-sm text-muted">
            Closed by deadline
          </p>
        </div>
      </div>
    </Card>
  )
}

function TeamRow({ team }) {
  const health = team.total
    ? Math.round(
        (team.closed / team.total) * 100
      )
    : 0

  return (
    <div className="rounded-lg border border-line bg-soft p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: team.overdue
                  ? COLOR.red
                  : COLOR.green,
              }}
            />

            <span className="truncate text-base font-bold text-ink">
              {team.team}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
            <span>{team.total} total</span>
            <span>{team.open} open</span>

            <span
              className={
                team.overdue
                  ? 'font-semibold text-red'
                  : ''
              }
            >
              {team.overdue} overdue
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-black text-ink">
            {health}%
          </div>

          <div className="text-sm text-muted">
            closed
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full"
          style={{
            width: `${health}%`,
            backgroundColor: COLOR.green,
          }}
        />
      </div>

      <div className="mt-2 flex justify-between text-sm text-muted">
        <span>
          {team.onTimePct !== null
            ? `${team.onTimePct}% on time`
            : 'No verified closures'}
        </span>

        <span className="font-semibold text-green">
          {team.closed} verified
        </span>
      </div>
    </div>
  )
}

function SeverityMatrix({ rows }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const color =
          SEVERITY_COLOR[row.severity]

        return (
          <div
            key={row.severity}
            className="rounded-lg border border-line p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: color,
                  }}
                />

                <span className="font-bold capitalize text-ink">
                  {row.severity}
                </span>
              </div>

              <span className="text-lg font-black text-ink">
                {row.open}
              </span>
            </div>

            <div className="mt-2 flex justify-between text-sm text-muted">
              <span>
                {row.overdue} overdue
              </span>

              <span>
                {row.avgDaysToClose !== null
                  ? `${row.avgDaysToClose.toFixed(1)}d avg close`
                  : 'No closure data'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClosureChart({ weeks }) {
  const max = Math.max(
    ...weeks.map((week) => week.count),
    1
  )

  return (
    <div>
      <div className="flex h-40 items-end gap-2 border-b border-line">
        {weeks.map((week, index) => {
          const height = Math.max(
            6,
            (week.count / max) * 100
          )

          const latest =
            index === weeks.length - 1

          return (
            <div
              key={index}
              className="flex flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-sm font-semibold text-muted">
                {week.count}
              </span>

              <div
                className="w-full max-w-12 rounded-t-md"
                style={{
                  height: `${height}%`,
                  background: latest
                    ? `linear-gradient(180deg, ${COLOR.blue}, ${COLOR.purple})`
                    : COLOR.blue,
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {weeks.map((week, index) => (
          <span
            key={index}
            className="flex-1 truncate text-center text-xs text-muted"
          >
            {week.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function EscalationVisual({
  sentBack,
  blocked,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-muted">
          Sent back
        </p>

        <p
          className="mt-1 text-3xl font-black"
          style={{ color: COLOR.red }}
        >
          {sentBack}
        </p>

        <p className="mt-1 text-sm text-muted">
          Requires rework
        </p>
      </div>

      <div className="rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-muted">
          Blocked
        </p>

        <p
          className="mt-1 text-3xl font-black"
          style={{ color: COLOR.amber }}
        >
          {blocked}
        </p>

        <p className="mt-1 text-sm text-muted">
          Needs intervention
        </p>
      </div>
    </div>
  )
}

export default function GovernanceAnalytics({
  items = [],
  activity = {},
}) {
  const metrics = useMemo(
    () => computeMetrics(items, activity),
    [items, activity]
  )

  const closurePct = metrics.totalItems
    ? Math.round(
        (metrics.totalClosed /
          metrics.totalItems) *
          100
      )
    : 0

  return (
    <div
      className="min-h-full bg-[#F8FAFB] p-4 sm:p-6"
      style={{
        fontFamily:
          '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">

        {/* Header */}
        <div className="rounded-xl bg-[#14181C] p-5 text-white">
          <p className="text-sm font-semibold text-gray-400">
            ETCH · GOVERNANCE CONTROL
          </p>

          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <h2 className="text-2xl font-black">
              Governance Analytics
            </h2>

            <div className="flex gap-3">
              <div>
                <p className="text-sm text-gray-400">
                  Total
                </p>

                <p className="text-xl font-black">
                  {metrics.totalItems}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">
                  Active
                </p>

                <p className="text-xl font-black">
                  {metrics.totalActive}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <ComplianceCard
            value={metrics.complianceRate}
          />

          <MetricCard
            label="Closure speed"
            value={
              metrics.avgDaysToClose !== null
                ? `${metrics.avgDaysToClose.toFixed(1)}d`
                : '—'
            }
            helper="Average closure"
            color={COLOR.blue}
            icon="↗"
          />

          <MetricCard
            label="Overdue"
            value={metrics.overdueCount}
            helper="Needs action"
            color={COLOR.red}
            icon="!"
          />

          <MetricCard
            label="Critical open"
            value={metrics.criticalOpenCount}
            helper="Highest priority"
            color={COLOR.red}
            icon="◆"
          />

          <MetricCard
            label="Closed"
            value={metrics.totalClosed}
            helper={`${closurePct}% complete`}
            color={COLOR.green}
            icon="✓"
          />
        </div>

        {/* Portfolio */}
        <Card className="p-5">
          <SectionHeader title="Portfolio status" />

          <div className="mt-4">
            <div className="flex h-10 overflow-hidden rounded-lg bg-soft">
              <div
                className="flex items-center justify-center text-sm font-bold text-white"
                style={{
                  width: `${closurePct}%`,
                  backgroundColor: COLOR.green,
                }}
              >
                {closurePct >= 15
                  ? `${metrics.totalClosed} CLOSED`
                  : ''}
              </div>

              <div
                className="flex items-center justify-center text-sm font-bold text-white"
                style={{
                  width: `${100 - closurePct}%`,
                  backgroundColor: COLOR.blue,
                }}
              >
                {100 - closurePct >= 15
                  ? `${metrics.totalActive} ACTIVE`
                  : ''}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted">
                  Closed
                </p>
                <p className="text-xl font-black text-ink">
                  {metrics.totalClosed}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted">
                  Active
                </p>
                <p className="text-xl font-black text-ink">
                  {metrics.totalActive}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted">
                  Overdue
                </p>
                <p
                  className="text-xl font-black"
                  style={{ color: COLOR.red }}
                >
                  {metrics.overdueCount}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted">
                  Critical
                </p>
                <p
                  className="text-xl font-black"
                  style={{ color: COLOR.red }}
                >
                  {metrics.criticalOpenCount}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Team + Risk */}
        <div className="grid gap-4 lg:grid-cols-2">

          <Card className="p-5">
            <SectionHeader
              title="Team performance"
              right={
                <span className="text-sm text-muted">
                  {metrics.byTeam.length} teams
                </span>
              }
            />

            <div className="mt-4 space-y-3">
              {metrics.byTeam.length ? (
                metrics.byTeam.map((team) => (
                  <TeamRow
                    key={team.team}
                    team={team}
                  />
                ))
              ) : (
                <p className="rounded-lg bg-soft p-5 text-center text-sm text-muted">
                  No team data available.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Risk by severity" />

            <div className="mt-4">
              {metrics.bySeverity.length ? (
                <SeverityMatrix
                  rows={metrics.bySeverity}
                />
              ) : (
                <p className="rounded-lg bg-soft p-5 text-center text-sm text-muted">
                  No severity data available.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Closures + Escalations */}
        <div className="grid gap-4 lg:grid-cols-2">

          <Card className="p-5">
            <SectionHeader
              title="Closures · 8 weeks"
              right={
                <span className="text-sm font-semibold text-blue">
                  Weekly trend
                </span>
              }
            />

            <div className="mt-5">
              <ClosureChart
                weeks={metrics.weeks}
              />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Escalations" />

            <div className="mt-5">
              <EscalationVisual
                sentBack={metrics.sentBackCount}
                blocked={metrics.blockedCount}
              />
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}    