import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  ready_to_close: 'Ready to Close',
  pending_approval: 'Pending Approval',
  closed: 'Closed',
}

const CLOSED_COLOR = [47, 143, 91]   // green
const OPEN_COLOR = [43, 108, 176]    // blue

function escape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function groupByTeam(items) {
  const map = {}
  items.forEach((i) => {
    const team = i.team || 'Unassigned'
    if (!map[team]) map[team] = []
    map[team].push(i)
  })
  return map
}

function sortedTeamKeys(byTeam) {
  return Object.keys(byTeam).sort((a, b) => a.localeCompare(b))
}

function toClosedRow(team, item) {
  const snap = item.close_snapshot || {}
  return [
    team, item.title, item.owner_name, item.source, item.severity, item.deadline,
    item.verified_by, item.verified_at, snap.completion_note, snap.closed_by, snap.closed_at,
  ]
}

function toOpenRow(team, item) {
  return [
    team, item.title, item.owner_name, item.source, STATUS_LABELS[item.status] || item.status,
    item.severity, item.deadline, item.blocked ? 'Yes' : 'No',
  ]
}

// Report layout: totals by team for closed tasks, totals by team for open
// tasks, then the detailed rows for each group.
export function exportGovernanceReportCSV(items) {
  const closed = items.filter((i) => i.status === 'closed')
  const open = items.filter((i) => i.status !== 'closed')
  const closedByTeam = groupByTeam(closed)
  const openByTeam = groupByTeam(open)
  const closedTeams = sortedTeamKeys(closedByTeam)
  const openTeams = sortedTeamKeys(openByTeam)

  const lines = []
  lines.push(escape(`Governance Report — Generated ${new Date().toLocaleString()}`))
  lines.push('')

  lines.push(escape('CLOSED TASKS BY TEAM'))
  lines.push(['Team', 'Closed Count'].map(escape).join(','))
  closedTeams.forEach((team) => lines.push([team, closedByTeam[team].length].map(escape).join(',')))
  lines.push(['Total', closed.length].map(escape).join(','))
  lines.push('')

  lines.push(escape('OPEN TASKS BY TEAM'))
  lines.push(['Team', 'Open Count'].map(escape).join(','))
  openTeams.forEach((team) => lines.push([team, openByTeam[team].length].map(escape).join(',')))
  lines.push(['Total', open.length].map(escape).join(','))
  lines.push('')

  lines.push(escape('CLOSED TASKS — DETAIL'))
  lines.push(['Team', 'Title', 'Owner', 'Source', 'Severity', 'Deadline', 'Verified By', 'Verified At', 'Completion Note', 'Closed By', 'Closed At'].map(escape).join(','))
  closedTeams.forEach((team) => {
    closedByTeam[team].forEach((item) => lines.push(toClosedRow(team, item).map(escape).join(',')))
  })
  lines.push('')

  lines.push(escape('OPEN TASKS — DETAIL'))
  lines.push(['Team', 'Title', 'Owner', 'Source', 'Status', 'Severity', 'Deadline', 'Blocked'].map(escape).join(','))
  openTeams.forEach((team) => {
    openByTeam[team].forEach((item) => lines.push(toOpenRow(team, item).map(escape).join(',')))
  })

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `governance-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Fixed 3-page structure:
//   Page 1 — summary: closed-by-team + open-by-team tables
//   Page 2 — closed tasks detail (incl. who closed it + completion note)
//   Page 3 — open tasks detail (incl. current status + blocked flag)
// Long tables still wrap onto continuation pages on their own (that's
// normal table pagination, not extra report pages) — what this removes is
// the old one-full-page-per-closed-item loop, which is what pushed a
// handful of closed items into a 7+ page report. Per-item timelines are no
// longer rendered as full pages; the completion note is kept as a column
// in the closed-tasks table instead.
export function exportGovernanceReportPDF(items) {
  const closed = items.filter((i) => i.status === 'closed')
  const open = items.filter((i) => i.status !== 'closed')
  const closedByTeam = groupByTeam(closed)
  const openByTeam = groupByTeam(open)
  const closedTeams = sortedTeamKeys(closedByTeam)
  const openTeams = sortedTeamKeys(openByTeam)

  const doc = new jsPDF()

  // --- Page 1: summary ---
  doc.setFontSize(16)
  doc.text('Governance Report', 14, 18)
  doc.setFontSize(10)
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25)

  doc.setFontSize(12)
  doc.text('Closed Tasks by Team', 14, 35)
  autoTable(doc, {
    startY: 39,
    head: [['Team', 'Closed Count']],
    body: [
      ...closedTeams.map((team) => [team, String(closedByTeam[team].length)]),
      ['Total', String(closed.length)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: CLOSED_COLOR },
  })

  const afterClosedSummaryY = doc.lastAutoTable.finalY + 12
  doc.setFontSize(12)
  doc.text('Open Tasks by Team', 14, afterClosedSummaryY)
  autoTable(doc, {
    startY: afterClosedSummaryY + 4,
    head: [['Team', 'Open Count']],
    body: [
      ...openTeams.map((team) => [team, String(openByTeam[team].length)]),
      ['Total', String(open.length)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: OPEN_COLOR },
  })

  // --- Page 2: closed tasks detail, grouped by team, notes included ---
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Closed Tasks — Detail', 14, 18)
  autoTable(doc, {
    startY: 24,
    head: [['Team', 'Title', 'Owner', 'Severity', 'Deadline', 'Closed By', 'Closed At', 'Completion Note']],
    body: closedTeams.flatMap((team) =>
      closedByTeam[team].map((item) => {
        const snap = item.close_snapshot || {}
        return [
          team, item.title, item.owner_name, item.severity, item.deadline,
          snap.closed_by || '', snap.closed_at ? new Date(snap.closed_at).toLocaleDateString() : '',
          snap.completion_note || '',
        ]
      })
    ),
    styles: { fontSize: 8, cellWidth: 'wrap' },
    columnStyles: { 7: { cellWidth: 55 } },
    headStyles: { fillColor: CLOSED_COLOR },
  })

  // --- Page 3: open tasks detail, grouped by team ---
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Open Tasks — Detail', 14, 18)
  autoTable(doc, {
    startY: 24,
    head: [['Team', 'Title', 'Owner', 'Status', 'Severity', 'Deadline', 'Blocked']],
    body: openTeams.flatMap((team) =>
      openByTeam[team].map((item) => [
        team, item.title, item.owner_name, STATUS_LABELS[item.status] || item.status, item.severity, item.deadline, item.blocked ? 'Yes' : 'No',
      ])
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: OPEN_COLOR },
  })

  doc.save(`governance-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}       