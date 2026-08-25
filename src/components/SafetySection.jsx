import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const SEVERITIES = [
  { label: 'Low', color: '#5C6670' },
  { label: 'Medium', color: '#D98C2B' },
  { label: 'High', color: '#C1443C' },
  { label: 'Critical', color: '#8B1E1E' },
]
const NEAR_MISS_CATEGORIES = ['Electrical', 'Mechanical', 'Chemical', 'Ergonomic', 'Procedural', 'Other']
const SEVERITY_WEIGHT = { Low: 1, Medium: 2, High: 3, Critical: 4 }
const MENTOR_COLOR = '#7C5CBF'
const NEAR_MISS_COLOR = '#D98C2B'
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

async function callGemini(promptText, blob) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('AI key not configured')
  const base64 = await blobToBase64(blob)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
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

// Text-only variant — near misses often don't have a photo, so classification
// runs off the written description instead of an image.
async function callGeminiText(promptText) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('AI key not configured')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
    }
  )
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

async function analyzeHazardFromUrl(photoUrl) {
  const imgRes = await fetch(photoUrl)
  const blob = await imgRes.blob()
  const prompt = `You are a workplace safety inspector at a semiconductor fab. Look at this photo and identify the most likely safety hazard shown. Respond ONLY with valid JSON, no markdown fences, no extra text, in exactly this format:
{"hazard": "<one sentence describing the hazard>", "severity": "Low|Medium|High|Critical", "measures": ["<short action 1>", "<short action 2>", "<short action 3>"]}`
  return callGemini(prompt, blob)
}

async function assessAreaSafety(file) {
  const prompt = `You are a workplace safety inspector at a semiconductor fab. Assess this photo for site safety. Check specifically for: (1) exposed or faulty electrical wiring, (2) waterlogging or liquid spills on the floor, (3) whether any people shown are wearing proper PPE (helmets, gloves, safety gear). Respond ONLY with valid JSON, no markdown, in exactly this format:
{"score": <integer 0-100, 100 = completely safe>, "wiring": {"status": "safe|hazard|not_visible", "note": "<one short sentence>"}, "waterlogging": {"status": "safe|hazard|not_visible", "note": "<one short sentence>"}, "ppe": {"status": "safe|hazard|not_visible", "note": "<one short sentence>"}, "measures": ["<short recommended action 1>", "<short action 2>", "<short action 3>"]}`
  return callGemini(prompt, file)
}

async function classifyNearMiss(description, category, potentialSeverity, location) {
  const prompt = `You are a workplace safety analyst at a semiconductor fab, doing near-miss analysis (an event that almost caused an incident, but didn't). Here is a near-miss report:
Description: "${description}"
Reported category: ${category}
Reported potential severity: ${potentialSeverity}
Location: ${location || 'not specified'}

Analyze it and respond ONLY with valid JSON, no markdown fences, no extra text, in exactly this format:
{"category": "Electrical|Mechanical|Chemical|Ergonomic|Procedural|Other", "risk_score": <integer 0-100, how likely this becomes a real incident if unaddressed>, "measures": ["<short corrective action 1>", "<short action 2>", "<short action 3>"]}`
  return callGeminiText(prompt)
}

function scoreColor(score) {
  if (score >= 80) return '#2F8F5B'
  if (score >= 50) return '#D98C2B'
  return '#C1443C'
}

function riskColor(score) {
  if (score >= 66) return '#C1443C'
  if (score >= 33) return '#D98C2B'
  return '#2F8F5B'
}

function statusColor(status) {
  if (status === 'safe') return '#2F8F5B'
  if (status === 'hazard') return '#C1443C'
  return '#5C6670'
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

function HazardCard({ r, onLightbox, onAiClick, aiOpen, isAnalyzing, onResolveClick }) {
  let measures = []
  try { measures = r.ai_measures ? JSON.parse(r.ai_measures) : [] } catch { measures = [] }

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {r.action_photo_url ? (
        <div className="grid grid-cols-2 gap-0.5">
          <div className="relative cursor-pointer" onClick={() => onLightbox(r.photo_url)}>
            <img src={r.photo_url} alt="Hazard" className="w-full h-40 object-cover" />
            <span className="absolute top-2 left-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: severityColor(r.severity) }}>
              {r.severity}
            </span>
            {r.status === 'resolved' && (
              <span className="absolute top-2 right-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-green text-white">Resolved</span>
            )}
          </div>
          <div className="relative cursor-pointer" onClick={() => onLightbox(r.action_photo_url)}>
            <img src={r.action_photo_url} alt="Action taken" className="w-full h-40 object-cover" />
            <span className="absolute top-2 left-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white bg-accent-green">
              Action Taken
            </span>
          </div>
        </div>
      ) : (
        <div className="relative cursor-pointer" onClick={() => onLightbox(r.photo_url)}>
          <img src={r.photo_url} alt="Hazard" className="w-full h-40 object-cover" />
          <span className="absolute top-2 left-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: severityColor(r.severity) }}>
            {r.severity}
          </span>
          {r.status === 'resolved' && (
            <span className="absolute top-2 right-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent-green text-white">Resolved</span>
          )}
        </div>
      )}
      <div className="p-4">
        <p className="text-sm text-ink">{r.description}</p>
        {r.location && <p className="text-xs text-ink-muted mt-1">📍 {r.location}</p>}

        {r.action_taken && (
          <div className="mt-2 rounded-lg p-2.5 bg-accent-green/10 border border-accent-green/30">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent-green mb-0.5">Immediate Action Taken</p>
            <p className="text-sm text-ink">{r.action_taken}</p>
          </div>
        )}

        <p className="font-mono text-[11px] text-ink-muted mt-2">
          {r.reported_by} {r.team && `· ${r.team}`} · {formatTime(r.created_at)}
        </p>
        {r.status === 'resolved' && r.resolved_by && (
          <p className="font-mono text-[11px] text-accent-green mt-1">Resolved by EHS #{r.resolved_by} · {formatTime(r.resolved_at)}</p>
        )}

        <button
          onClick={() => onAiClick(r)}
          className="mt-3 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border transition-colors"
          style={{ borderColor: MENTOR_COLOR, color: MENTOR_COLOR, backgroundColor: aiOpen ? `${MENTOR_COLOR}15` : 'transparent' }}
        >
          {isAnalyzing ? 'Analyzing…' : aiOpen ? 'Hide AI Suggestions' : 'AI Suggestions'}
        </button>

        {aiOpen && !isAnalyzing && r.ai_analyzed && (
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
            onClick={() => onResolveClick(r)}
            className="mt-2 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border border-accent-green text-accent-green hover:bg-accent-green/10 transition-colors"
          >
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  )
}

function NearMissCard({ nm, onLightbox, onAiClick, aiOpen, isAnalyzing }) {
  let measures = []
  try { measures = nm.ai_measures ? JSON.parse(nm.ai_measures) : [] } catch { measures = [] }

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {nm.photo_url && (
        <div className="relative cursor-pointer" onClick={() => onLightbox(nm.photo_url)}>
          <img src={nm.photo_url} alt="Near miss" className="w-full h-32 object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: NEAR_MISS_COLOR }}>
            {nm.category}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: `${severityColor(nm.potential_severity)}15`, color: severityColor(nm.potential_severity) }}>
            Potential: {nm.potential_severity}
          </span>
          {nm.ai_analyzed && nm.ai_risk_score != null && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: `${riskColor(nm.ai_risk_score)}15`, color: riskColor(nm.ai_risk_score) }}>
              Risk: {nm.ai_risk_score}
            </span>
          )}
        </div>
        <p className="text-sm text-ink">{nm.description}</p>
        {nm.location && <p className="text-xs text-ink-muted mt-1">📍 {nm.location}</p>}
        <p className="font-mono text-[11px] text-ink-muted mt-2">
          {nm.reported_by} {nm.team && `· ${nm.team}`} · {formatTime(nm.created_at)}
        </p>

        <button
          onClick={() => onAiClick(nm)}
          className="mt-3 w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-md border transition-colors"
          style={{ borderColor: MENTOR_COLOR, color: MENTOR_COLOR, backgroundColor: aiOpen ? `${MENTOR_COLOR}15` : 'transparent' }}
        >
          {isAnalyzing ? 'Analyzing…' : aiOpen ? 'Hide AI Analysis' : 'AI Risk Analysis'}
        </button>

        {aiOpen && !isAnalyzing && nm.ai_analyzed && (
          <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: `${MENTOR_COLOR}0D`, border: `1px solid ${MENTOR_COLOR}40` }}>
            <p className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: MENTOR_COLOR }}>Corrective Actions</p>
            {measures.length > 0 && (
              <ul className="text-xs text-ink-muted list-disc pl-4 space-y-0.5">
                {measures.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryTile({ label, status, note }) {
  return (
    <div className="border border-line rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
      </div>
      <p className="text-sm text-ink">{note}</p>
    </div>
  )
}

// Simple horizontal-bar row, used by the Analysis tab — no chart library,
// just a colored div scaled to a percentage of the row's max value.
function BarRow({ label, value, max, color, suffix = '' }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-ink truncate">{label}</span>
        <span className="font-mono text-xs text-ink-muted shrink-0 ml-2">{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function AnalysisTab({ reports, nearMisses, loading }) {
  if (loading) return <p className="text-ink-muted font-mono text-sm">Loading…</p>

  // Combine hazards + near-misses per location into a single risk picture.
  // Risk score = sum of hazard severity weights + sum of near-miss risk
  // contributions (using AI risk_score/25 as a rough severity-equivalent,
  // or 1 point if not yet AI-analyzed).
  const locationMap = {}
  function bump(locationRaw, weight, kind) {
    const key = (locationRaw || 'Unspecified').trim() || 'Unspecified'
    if (!locationMap[key]) locationMap[key] = { location: key, hazards: 0, nearMisses: 0, riskScore: 0 }
    locationMap[key][kind] += 1
    locationMap[key].riskScore += weight
  }
  reports.forEach((r) => bump(r.location, SEVERITY_WEIGHT[r.severity] || 1, 'hazards'))
  nearMisses.forEach((nm) => {
    const weight = nm.ai_analyzed && nm.ai_risk_score != null ? nm.ai_risk_score / 25 : (SEVERITY_WEIGHT[nm.potential_severity] || 1)
    bump(nm.location, weight, 'nearMisses')
  })

  const locationStats = Object.values(locationMap).sort((a, b) => b.riskScore - a.riskScore)
  const maxRisk = locationStats.length > 0 ? locationStats[0].riskScore : 0
  const hotSpots = locationStats.filter((l) => l.hazards + l.nearMisses >= 3 || l.riskScore >= 6)

  const categoryMap = {}
  nearMisses.forEach((nm) => {
    const cat = nm.ai_analyzed && nm.ai_category ? nm.ai_category : nm.category
    categoryMap[cat] = (categoryMap[cat] || 0) + 1
  })
  const categoryStats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])
  const maxCategory = categoryStats.length > 0 ? categoryStats[0][1] : 0

  const totalIncidents = reports.length + nearMisses.length

  if (totalIncidents === 0) {
    return (
      <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
        <p className="text-ink font-medium">Nothing to analyze yet.</p>
        <p className="text-ink-muted text-sm mt-1">Once hazards and near misses are logged, trends and hot spots will show up here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hotSpots.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm" style={{ borderLeft: '4px solid #C1443C' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔥</span>
            <h3 className="text-base font-semibold text-ink">Hot Spots</h3>
          </div>
          <p className="text-sm text-ink-muted mb-3">Locations with repeated hazards or near misses — worth a closer look before something more serious happens.</p>
          <div className="space-y-2">
            {hotSpots.map((l) => (
              <div key={l.location} className="flex items-center justify-between rounded-lg px-3 py-2 bg-accent-red/5">
                <div>
                  <p className="text-sm font-medium text-ink">{l.location}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{l.hazards} hazard{l.hazards === 1 ? '' : 's'} · {l.nearMisses} near miss{l.nearMisses === 1 ? '' : 'es'}</p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: `${riskColor(l.riskScore * 10)}15`, color: riskColor(l.riskScore * 10) }}>
                  Risk {l.riskScore.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
        <h3 className="text-base font-semibold text-ink mb-1">Risk by Location</h3>
        <p className="text-sm text-ink-muted mb-4">Combined score from hazard severity and near-miss risk, highest first.</p>
        <div className="space-y-3">
          {locationStats.slice(0, 10).map((l) => (
            <BarRow key={l.location} label={l.location} value={Number(l.riskScore.toFixed(1))} max={maxRisk} color={riskColor(l.riskScore * 10)} />
          ))}
        </div>
      </div>

      {categoryStats.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-ink mb-1">Near Misses by Category</h3>
          <p className="text-sm text-ink-muted mb-4">Where the near-miss reports are clustering.</p>
          <div className="space-y-3">
            {categoryStats.map(([cat, count]) => (
              <BarRow key={cat} label={cat} value={count} max={maxCategory} color={NEAR_MISS_COLOR} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Safety({ user }) {
  const [tab, setTab] = useState('ongoing')
  const [reports, setReports] = useState([])
  const [scores, setScores] = useState([])
  const [nearMisses, setNearMisses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [actionTaken, setActionTaken] = useState('')
  const [actionFile, setActionFile] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [aiOpen, setAiOpen] = useState({})
  const [analyzingId, setAnalyzingId] = useState(null)
  const [resolvingReport, setResolvingReport] = useState(null)

  const [scoreFile, setScoreFile] = useState(null)
  const [scoreLocation, setScoreLocation] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [scoreError, setScoreError] = useState('')

  const [showNearMissForm, setShowNearMissForm] = useState(false)
  const [nmDescription, setNmDescription] = useState('')
  const [nmLocation, setNmLocation] = useState('')
  const [nmCategory, setNmCategory] = useState('Other')
  const [nmSeverity, setNmSeverity] = useState('Medium')
  const [nmFile, setNmFile] = useState(null)
  const [nmSubmitting, setNmSubmitting] = useState(false)
  const [nmError, setNmError] = useState('')
  const [nmAiOpen, setNmAiOpen] = useState({})
  const [nmAnalyzingId, setNmAnalyzingId] = useState(null)

  async function loadAll() {
    setLoading(true)
    const [{ data: reportData }, { data: scoreData }, { data: nearMissData }] = await Promise.all([
      supabase.from('safety_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('safety_scores').select('*').order('created_at', { ascending: false }),
      supabase.from('near_misses').select('*').order('created_at', { ascending: false }),
    ])
    setReports(reportData || [])
    setScores(scoreData || [])
    setNearMisses(nearMissData || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

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

    // Immediate action photo is optional — only upload if provided.
    let actionPhotoUrl = null
    if (actionFile) {
      const actionPath = `${Date.now()}-action-${actionFile.name.replace(/\s+/g, '-')}`
      const { error: actionUploadError } = await supabase.storage.from('safety-photos').upload(actionPath, actionFile)
      if (actionUploadError) { setError(actionUploadError.message); setUploading(false); return }
      const { data: actionUrlData } = supabase.storage.from('safety-photos').getPublicUrl(actionPath)
      actionPhotoUrl = actionUrlData.publicUrl
    }

    const { error: insertError } = await supabase.from('safety_reports').insert([{
      photo_url: urlData.publicUrl,
      description: description.trim(),
      location: location.trim(),
      severity,
      action_taken: actionTaken.trim() || null,
      action_photo_url: actionPhotoUrl,
      reported_by: user?.name || 'Unknown',
      team: user?.team || '',
    }])
    setUploading(false)
    if (insertError) { setError(insertError.message); return }

    // Broadcast the hazard into General so everyone sees it, gets a live
    // toast, and an unread badge on the nav (handled in Tracker.jsx).
    const { error: announceError } = await supabase.from('announcements').insert([{
      author_id: user?.id,
      author_name: user?.name || 'Unknown',
      author_team: user?.team || null,
      type: 'hazard_alert',
      severity,
      location: location.trim() || null,
      body: `Safety hazard reported${location.trim() ? ` at ${location.trim()}` : ''}: ${description.trim()}`,
    }])
    if (announceError) console.error('hazard announcement failed:', announceError.message)

    setFile(null)
    setDescription('')
    setLocation('')
    setSeverity('Medium')
    setActionTaken('')
    setActionFile(null)
    setShowForm(false)
    loadAll()
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
      loadAll()
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
    loadAll()
  }

  async function handleAssess(e) {
    e.preventDefault()
    setScoreError('')
    if (!scoreFile) { setScoreError('Attach a photo of the area to assess.'); return }
    setAssessing(true)
    try {
      const result = await assessAreaSafety(scoreFile)
      const path = `${Date.now()}-${scoreFile.name.replace(/\s+/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('safety-photos').upload(path, scoreFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('safety-photos').getPublicUrl(path)

      await supabase.from('safety_scores').insert([{
        photo_url: urlData.publicUrl,
        location: scoreLocation.trim(),
        score: result.score,
        wiring_status: result.wiring?.status,
        wiring_note: result.wiring?.note,
        water_status: result.waterlogging?.status,
        water_note: result.waterlogging?.note,
        ppe_status: result.ppe?.status,
        ppe_note: result.ppe?.note,
        measures: JSON.stringify(result.measures || []),
        checked_by: user?.name || 'Unknown',
        team: user?.team || '',
      }])

      setScoreFile(null)
      setScoreLocation('')
      loadAll()
    } catch (err) {
      setScoreError('Assessment failed — check your AI key and try again.')
    }
    setAssessing(false)
  }

  async function handleNearMissSubmit(e) {
    e.preventDefault()
    setNmError('')
    if (!nmDescription.trim()) { setNmError('Describe what happened.'); return }
    setNmSubmitting(true)

    let photoUrl = null
    if (nmFile) {
      const path = `${Date.now()}-${nmFile.name.replace(/\s+/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('safety-photos').upload(path, nmFile)
      if (uploadError) { setNmError(uploadError.message); setNmSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('safety-photos').getPublicUrl(path)
      photoUrl = urlData.publicUrl
    }

    const { error: insertError } = await supabase.from('near_misses').insert([{
      description: nmDescription.trim(),
      location: nmLocation.trim(),
      category: nmCategory,
      potential_severity: nmSeverity,
      photo_url: photoUrl,
      reported_by: user?.name || 'Unknown',
      team: user?.team || '',
    }])
    setNmSubmitting(false)
    if (insertError) { setNmError(insertError.message); return }

    setNmDescription('')
    setNmLocation('')
    setNmCategory('Other')
    setNmSeverity('Medium')
    setNmFile(null)
    setShowNearMissForm(false)
    loadAll()
  }

  async function handleNearMissAiClick(nm) {
    setNmAiOpen((prev) => ({ ...prev, [nm.id]: !prev[nm.id] }))
    if (nm.ai_analyzed) return
    setNmAnalyzingId(nm.id)
    try {
      const result = await classifyNearMiss(nm.description, nm.category, nm.potential_severity, nm.location)
      await supabase.from('near_misses').update({
        ai_category: result.category,
        ai_risk_score: result.risk_score,
        ai_measures: JSON.stringify(result.measures || []),
        ai_analyzed: true,
      }).eq('id', nm.id)
      loadAll()
    } catch (err) {
      setNmError('AI analysis failed — try again in a moment.')
    }
    setNmAnalyzingId(null)
  }

  const openReports = reports.filter((r) => r.status === 'open')
  const resolvedReports = reports.filter((r) => r.status === 'resolved')

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === key ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink border border-line'
      }`}
    >
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )

  return (
    <div>
      {resolvingReport && <ResolveModal report={resolvingReport} onCancel={() => setResolvingReport(null)} onConfirm={handleResolveConfirm} />}

      {lightbox && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 text-white font-mono text-sm uppercase tracking-wider" onClick={() => setLightbox(null)}>Close ✕</button>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-ink">Safety at Site</h2>
        {(tab === 'ongoing' || tab === 'resolved') && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-accent-red text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-red/90 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Report Hazard'}
          </button>
        )}
        {tab === 'nearmiss' && (
          <button
            onClick={() => setShowNearMissForm((s) => !s)}
            className="text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
            style={{ backgroundColor: NEAR_MISS_COLOR }}
          >
            {showNearMissForm ? 'Cancel' : '+ Report Near Miss'}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabBtn('ongoing', 'Ongoing Hazards', openReports.length)}
        {tabBtn('resolved', 'Resolved', resolvedReports.length)}
        {tabBtn('nearmiss', 'Near Misses', nearMisses.length)}
        {tabBtn('analysis', 'Analysis')}
        {tabBtn('score', 'Area Safety Score')}
      </div>

      {(tab === 'ongoing' || tab === 'resolved') && showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Photo of the hazard</label>
            <input required type="file" accept="image/*" className="w-full border border-line rounded-md p-2.5 mt-1 bg-canvas text-sm" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What's the hazard?</label>
            <textarea required rows={3} className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
              placeholder="e.g. Exposed wiring near the FMCS panel" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Location / Area</label>
              <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
                placeholder="e.g. Bay 3, near loading dock" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Severity</label>
              <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
                value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITIES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-line">
            <p className="font-mono text-[11px] uppercase tracking-wider text-accent-green mb-3">Immediate Action Taken (optional)</p>
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What did you do about it?</label>
                <textarea rows={2} className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                  placeholder="e.g. Cordoned off the area and switched off the breaker" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Photo of action taken</label>
                <input type="file" accept="image/*" className="w-full border border-line rounded-md p-2.5 mt-1 bg-canvas text-sm" onChange={(e) => setActionFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={uploading} className="w-full bg-accent-red text-white rounded-md p-2.5 font-medium hover:bg-accent-red/90 transition-colors disabled:opacity-60">
            {uploading ? 'Uploading…' : 'Submit Report'}
          </button>
        </form>
      )}

      {tab === 'nearmiss' && showNearMissForm && (
        <form onSubmit={handleNearMissSubmit} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm space-y-4">
          <p className="text-sm text-ink-muted">
            A near miss is something that almost caused an incident but didn't — reporting these helps catch risks before they become real ones.
          </p>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What happened?</label>
            <textarea required rows={3} className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:border-line"
              style={{ '--tw-ring-color': `${NEAR_MISS_COLOR}66` }}
              placeholder="e.g. A cart nearly rolled into a walkway when its brake wasn't set" value={nmDescription} onChange={(e) => setNmDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Location / Area</label>
              <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2"
                placeholder="e.g. Bay 3, near loading dock" value={nmLocation} onChange={(e) => setNmLocation(e.target.value)} />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Category</label>
              <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2"
                value={nmCategory} onChange={(e) => setNmCategory(e.target.value)}>
                {NEAR_MISS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Potential Severity (if it had occurred)</label>
              <select className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2"
                value={nmSeverity} onChange={(e) => setNmSeverity(e.target.value)}>
                {SEVERITIES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Photo (optional)</label>
              <input type="file" accept="image/*" className="w-full border border-line rounded-md p-2.5 mt-1 bg-canvas text-sm" onChange={(e) => setNmFile(e.target.files[0])} />
            </div>
          </div>
          {nmError && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{nmError}</p>}
          <button type="submit" disabled={nmSubmitting} className="w-full text-white rounded-md p-2.5 font-medium transition-colors disabled:opacity-60" style={{ backgroundColor: NEAR_MISS_COLOR }}>
            {nmSubmitting ? 'Submitting…' : 'Submit Near Miss'}
          </button>
        </form>
      )}

      {tab === 'ongoing' && (
        loading ? <p className="text-ink-muted font-mono text-sm">Loading…</p> :
        openReports.length === 0 ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
            <p className="text-ink font-medium">No open hazards.</p>
            <p className="text-ink-muted text-sm mt-1">Nice — nothing outstanding right now.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {openReports.map((r) => (
              <HazardCard key={r.id} r={r} onLightbox={setLightbox} onAiClick={handleAiClick} aiOpen={!!aiOpen[r.id]} isAnalyzing={analyzingId === r.id} onResolveClick={setResolvingReport} />
            ))}
          </div>
        )
      )}

      {tab === 'resolved' && (
        loading ? <p className="text-ink-muted font-mono text-sm">Loading…</p> :
        resolvedReports.length === 0 ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
            <p className="text-ink font-medium">Nothing resolved yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedReports.map((r) => (
              <HazardCard key={r.id} r={r} onLightbox={setLightbox} onAiClick={handleAiClick} aiOpen={!!aiOpen[r.id]} isAnalyzing={analyzingId === r.id} onResolveClick={setResolvingReport} />
            ))}
          </div>
        )
      )}

      {tab === 'nearmiss' && (
        loading ? <p className="text-ink-muted font-mono text-sm">Loading…</p> :
        nearMisses.length === 0 ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
            <p className="text-ink font-medium">No near misses logged yet.</p>
            <p className="text-ink-muted text-sm mt-1">Report anything that almost went wrong — it's the earliest signal you'll get.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearMisses.map((nm) => (
              <NearMissCard key={nm.id} nm={nm} onLightbox={setLightbox} onAiClick={handleNearMissAiClick} aiOpen={!!nmAiOpen[nm.id]} isAnalyzing={nmAnalyzingId === nm.id} />
            ))}
          </div>
        )
      )}

      {tab === 'analysis' && (
        <AnalysisTab reports={reports} nearMisses={nearMisses} loading={loading} />
      )}

      {tab === 'score' && (
        <div>
          <form onSubmit={handleAssess} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm space-y-4">
            <p className="text-sm text-ink-muted">
              Upload a photo of an area — AI checks for exposed wiring, waterlogging, and proper PPE, then returns a safety score.
            </p>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Photo of the area</label>
              <input required type="file" accept="image/*" className="w-full border border-line rounded-md p-2.5 mt-1 bg-canvas text-sm" onChange={(e) => setScoreFile(e.target.files[0])} />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Location / Area</label>
              <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                placeholder="e.g. Bay 3 floor" value={scoreLocation} onChange={(e) => setScoreLocation(e.target.value)} />
            </div>
            {scoreError && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{scoreError}</p>}
            <button type="submit" disabled={assessing} className="w-full bg-accent-blue text-white rounded-md p-2.5 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
              {assessing ? 'Assessing…' : 'Assess Area Safety'}
            </button>
          </form>

          {loading ? (
            <p className="text-ink-muted font-mono text-sm">Loading…</p>
          ) : scores.length === 0 ? (
            <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
              <p className="text-ink font-medium">No areas assessed yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scores.map((s) => {
                let measures = []
                try { measures = s.measures ? JSON.parse(s.measures) : [] } catch { measures = [] }
                return (
                  <div key={s.id} className="bg-surface border border-line rounded-xl p-5 shadow-sm">
                    <div className="flex gap-4 flex-wrap">
                      <img src={s.photo_url} alt="Area" className="w-28 h-28 object-cover rounded-lg cursor-pointer shrink-0" onClick={() => setLightbox(s.photo_url)} />
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-3xl font-bold" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">/ 100 safety score</span>
                        </div>
                        {s.location && <p className="text-xs text-ink-muted mt-0.5">📍 {s.location}</p>}
                        <p className="font-mono text-[11px] text-ink-muted mt-1">{s.checked_by} {s.team && `· ${s.team}`} · {formatTime(s.created_at)}</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 mt-4">
                      <CategoryTile label="Wiring" status={s.wiring_status} note={s.wiring_note} />
                      <CategoryTile label="Waterlogging" status={s.water_status} note={s.water_note} />
                      <CategoryTile label="PPE Compliance" status={s.ppe_status} note={s.ppe_note} />
                    </div>
                    {measures.length > 0 && (
                      <div className="mt-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mb-1">Recommended Measures</p>
                        <ul className="text-sm text-ink list-disc pl-5 space-y-0.5">
                          {measures.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}         