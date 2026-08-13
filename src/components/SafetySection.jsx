import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const SEVERITIES = [
  { label: 'Low', color: '#5C6670' },
  { label: 'Medium', color: '#D98C2B' },
  { label: 'High', color: '#C1443C' },
  { label: 'Critical', color: '#8B1E1E' },
]
const MENTOR_COLOR = '#7C5CBF' 
const EHS_PASSWORD = 'An@1406'

function severityColor(label) {
  return SEVERITIES.find((s) => s.label === label)?.color || '#5C6670'
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function analyzeHazardFromUrl(photoUrl) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('AI key not configured')

  const imgRes = await fetch(photoUrl)
  const blob = await imgRes.blob()
  const base64 = await blobToBase64(blob)

  const prompt = `You are a workplace safety inspector at a semiconductor fab. Look at this photo and identify the most likely safety hazard shown. Respond ONLY with valid JSON, no markdown fences, no extra text, in exactly this format:
{"hazard": "<one sentence describing the hazard>", "severity": "Low|Medium|High|Critical", "measures": ["<short action 1>", "<short action 2>", "<short action 3>"]}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: blob.type || 'image/jpeg', data: base64 } },
          ],
        }],
      }),
    }
  )
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

function ResolveModal({ report, onCancel, onConfirm }) {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!employeeId.trim()) { setError('Enter your employee ID.'); return }
    if (password !== EHS_PASSWORD) { setError('Incorrect EHS password.'); return }
    setSubmitting(true)
    await onConfirm(employeeId.trim())
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-green" />
        <p className="font-mono text-xs uppercase tracking-wider text-accent-green mb-1">EHS Authorization</p>
        <h2 className="text-xl font-semibold text-ink mb-1">Mark Resolved</h2>
        <p className="text-sm text-ink-muted mb-5">Only EHS team members can close out a hazard report.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Employee ID</label>
            <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
              value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">EHS Password</label>
            <input type="password" className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-accent-green text-white rounded-md p-2.5 font-medium hover:bg-accent-green/90 transition-colors disabled:opacity-60">
              {submitting ? 'Verifying…' : 'Confirm Resolved'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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
  const [lightbox, setLightbox] = useState(null)
  const [aiOpen, setAiOpen] = useState({})
  const [analyzingId, setAnalyzingId] = useState(null)
  const [resolvingReport, setResolvingReport] = useState(null)

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

  async function handleAiClick(report) {
    setAiOpen((prev) => ({ ...prev, [report.id]: !prev[report.id] }))
    if (report.ai_analyzed) return
    setAnalyzingId(report.id)
    try {
      const result = await analyzeHazardFromUrl(report.photo_url)
      await supabase.from('safety_reports').update({
        ai_hazard: result.hazard,
        ai_severity: result.severity,
        ai_measures: JSON.stringify(result.measures || []),
        ai_analyzed: true,
      }).eq('id', report.id)
      loadReports()
    } catch (err) {
      setError('AI analysis failed — try again in a moment.')
    }
    setAnalyzingId(null)
  }

  async function handleResolveConfirm(employeeId) {
    const report = resolvingReport
    await supabase.from('safety_reports').update({
      status: 'resolved',
      resolved_by: employeeId,
      resolved_at: new Date().toISOString(),
    }).eq('id', report.id)
    setResolvingReport(null)
    loadReports()
  }

  const openCount = reports.filter((r) => r.status === 'open').length

  return (
    <div>
      {resolvingReport && (
        <ResolveModal report={resolvingReport} onCancel={() => setResolvingReport(null)} onConfirm={handleResolveConfirm} />
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 text-white font-mono text-sm uppercase tracking-wider" onClick={() => setLightbox(null)}>
            Close ✕
          </button>
          <img src={lightbox} alt="Hazard full size" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

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
              rows={3}
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
          {reports.map((r) => {
            const isAiOpen = !!aiOpen[r.id]
            const isAnalyzing = analyzingId === r.id
            let measures = []
            try { measures = r.ai_measures ? JSON.parse(r.ai_measures) : [] } catch { measures = [] }

            return (
              <div key={r.id} className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="relative cursor-pointer" onClick={() => setLightbox(r.photo_url)}>
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
                  {r.status === 'resolved' && r.resolved_by && (
                    <p className="font-mono text-[11px] text-accent-green mt-1">
                      Resolved by EHS #{r.resolved_by} · {formatTime(r.resolved_at)}
                    </p>
                  )}

                  <button
                    onClick={() => handleAiClick(r)}
                    className="mt-3 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border transition-colors"
                    style={{ borderColor: MENTOR_COLOR, color: MENTOR_COLOR, backgroundColor: isAiOpen ? `${MENTOR_COLOR}15` : 'transparent' }}
                  >
                    {isAnalyzing ? 'Analyzing…' : isAiOpen ? 'What to do ? ' : ' what to do now ?'}    
                  </button>

                  {isAiOpen && !isAnalyzing && r.ai_analyzed && (
                    <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: `${MENTOR_COLOR}0D`, border: `1px solid ${MENTOR_COLOR}40` }}>
                      <p className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: MENTOR_COLOR }}>AI Assessment</p>
                      <p className="text-sm text-ink">{r.ai_hazard}</p>
                      {measures.length > 0 && (
                        <ul className="text-xs text-ink-muted mt-1.5 list-disc pl-4 space-y-0.5">
                          {measures.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {r.status === 'open' && (
                    <button
                      onClick={() => setResolvingReport(r)}
                      className="mt-2 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border border-accent-green text-accent-green hover:bg-accent-green/10 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}    