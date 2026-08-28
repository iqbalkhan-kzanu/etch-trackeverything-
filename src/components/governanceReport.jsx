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

export function exportGovernanceReportPDF(items) {
  const closed = items.filter((i) => i.status === 'closed')
  const open = items.filter((i) => i.status !== 'closed')
  const closedByTeam = groupByTeam(closed)
  const openByTeam = groupByTeam(open)
  const closedTeams = sortedTeamKeys(closedByTeam)
  const openTeams = sortedTeamKeys(openByTeam)

  const doc = new jsPDF()

  // --- Cover / summary page ---
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

  // --- Closed tasks detail table, grouped by team ---
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Closed Tasks — Detail', 14, 18)
  autoTable(doc, {
    startY: 24,
    head: [['Team', 'Title', 'Owner', 'Severity', 'Deadline', 'Closed By', 'Closed At']],
    body: closedTeams.flatMap((team) =>
      closedByTeam[team].map((item) => {
        const snap = item.close_snapshot || {}
        return [team, item.title, item.owner_name, item.severity, item.deadline, snap.closed_by || '', snap.closed_at ? new Date(snap.closed_at).toLocaleDateString() : '']
      })
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: CLOSED_COLOR },
  })

  // --- Open tasks detail table, grouped by team ---
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

  // --- One detail page per closed item (completion note + full timeline) ---
  closed.forEach((item) => {
    doc.addPage()
    doc.setFontSize(13)
    doc.text(item.title, 14, 18)
    doc.setFontSize(9)
    doc.text(`Owner: ${item.owner_name}  ·  Team: ${item.team}  ·  Severity: ${item.severity}`, 14, 26)
    doc.text(`Source: ${item.source}  ·  Deadline: ${item.deadline}`, 14, 32)
    const snap = item.close_snapshot || {}
    let y = 42
    if (snap.completion_note) {
      doc.setFontSize(10)
      doc.text('Completion Note:', 14, y); y += 6
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(snap.completion_note, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 4
    }
    if (Array.isArray(snap.timeline) && snap.timeline.length) {
      doc.setFontSize(10)
      doc.text('Timeline:', 14, y); y += 6
      doc.setFontSize(8)
      snap.timeline.forEach((e) => {
        const line = `${new Date(e.created_at).toLocaleString()} — ${e.actor}: ${e.action}${e.note ? ' — ' + e.note : ''}`
        const lines = doc.splitTextToSize(line, 180)
        doc.text(lines, 14, y)
        y += lines.length * 4.5
      })
    }
  })

  doc.save(`governance-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}    