import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function toCSVRow(item) {
  const snap = item.close_snapshot || {}
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [
    item.id, item.title, item.owner_name, item.team, item.source,
    item.severity, item.deadline, item.verified_by, item.verified_at,
    snap.completion_note, snap.closed_by, snap.closed_at,
  ].map(escape).join(',')
}

export function exportClosedItemsCSV(items) {
  const closed = items.filter((i) => i.status === 'closed')
  const header = ['ID', 'Title', 'Owner', 'Team', 'Source', 'Severity', 'Deadline', 'Verified By', 'Verified At', 'Completion Note', 'Closed By', 'Closed At']
  const rows = [header.join(','), ...closed.map(toCSVRow)]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `governance-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportClosedItemsPDF(items) {
  const closed = items.filter((i) => i.status === 'closed')
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Governance Report — Closed Action Items', 14, 18)
  doc.setFontSize(10)
  doc.text(`Generated ${new Date().toLocaleString()} · ${closed.length} closed items`, 14, 25)
  autoTable(doc, {
    startY: 32,
    head: [['Title', 'Owner', 'Team', 'Severity', 'Deadline', 'Closed By', 'Closed At']],
    body: closed.map((i) => {
      const snap = i.close_snapshot || {}
      return [i.title, i.owner_name, i.team, i.severity, i.deadline, snap.closed_by || '', snap.closed_at ? new Date(snap.closed_at).toLocaleDateString() : '']
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [43, 108, 176] },
  })
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