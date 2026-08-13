import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const SEVERITIES = [
  { label: 'Low', color: '#5C6670' },
  { label: 'Medium', color: '#D98C2B' },
  { label: 'High', color: '#C1443C' },
  { label: 'Critical', color: '#8B1E1E' },
]

function severityColor(label) {
  return SEVERITIES.find((s) => s.label === label)?.color || '#5C6670'
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Safety({ user }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState('Medium')

  async function loadReports() {
    setLoading(true)
    const { data, error } = await supabase.from('safety_reports').select('*').order('created_at', { ascending: false })
    if (!error) setReports(data)
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!file) { setError('Please attach a photo of the hazard.'); return }
    if (!description.trim()) { setError('Please describe the hazard.'); return }
    setUploading(true)

    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('safety-photos').upload(path, file)
    if (uploadError) { setError(uploadError.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('safety-photos').getPublicUrl(path)

    const { error: insertError } = await supabase.from('safety_reports').insert([{
      photo_url: urlData.publicUrl,
      description: description.trim(),
      location: location.trim(),
      severity,
      reported_by: user?.name || 'Unknown',
      team: user?.team || '',
    }])
    setUploading(false)
    if (insertError) { setError(insertError.message); return }

    setFile(null)
    setDescription('')
    setLocation('')
    setSeverity('Medium')
    setShowForm(false)
    loadReports()
  }

  async function toggleResolved(report) {
    const nextStatus = report.status === 'open' ? 'resolved' : 'open'
    await supabase.from('safety_reports').update({ status: nextStatus }).eq('id', report.id)
    loadReports()
  }

  const openCount = reports.filter((r) => r.status === 'open').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Safety at Site</h2>
          <p className="text-sm text-ink-muted mt-1">
            {openCount} open hazard{openCount !== 1 ? 's' : ''} reported by the team
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-accent-red text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-red/90 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Report Hazard'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Photo of the hazard</label>
            <input
              required
              type="file"
              accept="image/*"
              className="w-full border border-line rounded-md p-2.5 mt-1 bg-canvas text-sm"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What's the hazard?</label>
            <textarea
              required
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
              placeholder="e.g. Exposed wiring near the FMCS panel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Location / Area</label>
              <input
                className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
                placeholder="e.g. Bay 3, near loading dock"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Severity</label>
              <select
                className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-accent-red text-white rounded-md p-2.5 font-medium hover:bg-accent-red/90 transition-colors disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Submit Report'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading reports…</p>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">No hazards reported.</p>
          <p className="text-ink-muted text-sm mt-1">If you spot something unsafe, report it here with a photo.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <div key={r.id} className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative">
                <img src={r.photo_url} alt="Hazard" className="w-full h-40 object-cover" />
                <span
                  className="absolute top-2 left-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: severityColor(r.severity) }}
                >
                  {r.severity}
                </span>
                {r.status === 'resolved' && (
                  <span className="absolute top-2 right-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-green text-white">
                    Resolved
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm text-ink">{r.description}</p>
                {r.location && <p className="text-xs text-ink-muted mt-1">📍 {r.location}</p>}
                <p className="font-mono text-[11px] text-ink-muted mt-2">
                  {r.reported_by} {r.team && `· ${r.team}`} · {formatTime(r.created_at)}
                </p>
                <button
                  onClick={() => toggleResolved(r)}
                  className={`mt-3 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border transition-colors ${
                    r.status === 'open'
                      ? 'border-accent-green text-accent-green hover:bg-accent-green/10'
                      : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  {r.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}       