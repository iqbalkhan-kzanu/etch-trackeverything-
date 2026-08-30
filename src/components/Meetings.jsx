import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const MEETING_COLOR = '#2B6CB0'
const SCHEDULED_COLOR = '#7C5CBF'
const COMPLETED_COLOR = '#2F8F5B'

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// Sends the raw live transcript to Gemini and asks for a clean summary of
// what was actually discussed — key points, decisions, and action items.
async function summarizeTranscript(rawTranscript) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('AI key not configured')
  const prompt = `You are taking notes for a workplace meeting at a semiconductor fab. Below is a raw, unedited live speech-to-text transcript of the meeting — it may contain errors, filler words, and no speaker labels. Turn it into a short, clean set of meeting notes.

Respond ONLY with plain text (no markdown, no JSON), structured as:
Key Points:
- ...
Decisions:
- ...
Action Items:
- ...

Skip any section that has nothing to report. Be concise — this is for a log, not a transcript.

Raw transcript:
"""
${rawTranscript}
"""`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

function MeetingCard({ m, currentUserId, isFocused, onEditNotes }) {
  const statusColor = m.status === 'completed' ? COMPLETED_COLOR : SCHEDULED_COLOR
  const canEdit = m.created_by === currentUserId || (Array.isArray(m.participants) && m.participants.some((p) => p.id === currentUserId))
  return (
    <div
      id={`meeting-${m.id}`}
      className={`bg-surface border rounded-xl p-5 shadow-sm transition-shadow ${isFocused ? 'border-accent-blue ring-2 ring-accent-blue/30' : 'border-line'}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink">{m.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ backgroundColor: statusColor }}>
              {m.status === 'completed' ? 'Logged' : 'Scheduled'}
            </span>
          </div>
          <p className="text-sm text-ink-muted font-mono mt-0.5">
            {formatDate(m.meeting_date)}{m.location ? ` · ${m.location}` : ''} · by {m.created_by_name}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => onEditNotes(m)}
            className="text-xs bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 transition-colors whitespace-nowrap shrink-0"
          >
            {m.notes ? 'Edit Notes' : 'Add Notes'}
          </button>
        )}
      </div>

      {m.notes ? (
        <p className="text-sm text-ink mt-3 whitespace-pre-wrap">{m.notes}</p>
      ) : (
        <p className="text-sm text-ink-muted italic mt-3">No discussion notes yet.</p>
      )}

      {Array.isArray(m.participants) && m.participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {m.participants.map((p, i) => (
            <span key={i} className="font-mono text-[10px] px-2 py-0.5 rounded bg-line text-ink-muted">{p.name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Meetings({ user, focusMeetingId, onFocusHandled }) {
  const [meetings, setMeetings] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('all')

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [location, setLocation] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [notesEditingId, setNotesEditingId] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  // Live meeting capture — browser speech-to-text (Chrome/Edge only) feeding
  // a running transcript, which can then be handed to Gemini to extract a
  // clean summary once recording stops.
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [recordError, setRecordError] = useState('')
  const recognitionRef = useRef(null)
  const shouldKeepListeningRef = useRef(false)

  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  function startListening() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setRecordError('Live transcription needs Chrome or Edge — this browser doesn\'t support it.')
      return
    }
    setRecordError('')
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript + ' '
      }
      if (finalChunk) setLiveTranscript((prev) => (prev + ' ' + finalChunk).trim())
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      setRecordError(`Microphone error: ${event.error}`)
    }
    // Browser speech recognition auto-stops after a period of silence —
    // restart it automatically as long as the user hasn't hit Stop.
    recognition.onend = () => {
      if (shouldKeepListeningRef.current) recognition.start()
    }

    recognitionRef.current = recognition
    shouldKeepListeningRef.current = true
    recognition.start()
    setIsListening(true)
  }

  function stopListening() {
    shouldKeepListeningRef.current = false
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  async function handleSummarize() {
    if (!liveTranscript.trim()) return
    setSummarizing(true)
    setRecordError('')
    try {
      const summary = await summarizeTranscript(liveTranscript)
      setNotesDraft((prev) => (prev.trim() ? `${prev.trim()}\n\n${summary}` : summary))
    } catch (err) {
      setRecordError('AI summarization failed — check your AI key and try again.')
    }
    setSummarizing(false)
  }

  async function loadMeetings() {
    setLoading(true)
    const { data, error } = await supabase.from('meetings').select('*').order('meeting_date', { ascending: false })
    if (!error) setMeetings(data || [])
    setLoading(false)
  }

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('id, name, team')
    setProfiles(data || [])
  }

  useEffect(() => { loadMeetings(); loadProfiles() }, [])

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (!focusMeetingId) return
    setTab('all')
    const el = document.getElementById(`meeting-${focusMeetingId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (onFocusHandled) onFocusHandled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMeetingId, meetings])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Give the meeting a title.'); return }
    if (!meetingDate) { setError('Pick a date.'); return }
    setSubmitting(true)

    const participants = selectedIds
      .map((id) => profiles.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, team: p.team }))

    const today = new Date(new Date().toDateString())
    const chosen = new Date(meetingDate)
    const status = chosen <= today ? 'completed' : 'scheduled'

    const { data, error: insertError } = await supabase.from('meetings').insert([{
      title: title.trim(),
      notes: notes.trim() || null,
      meeting_date: meetingDate,
      location: location.trim() || null,
      created_by: user?.id,
      created_by_name: user?.name || 'Unknown',
      participants,
      status,
    }]).select()

    if (insertError) { setError(insertError.message); setSubmitting(false); return }

    // Future-dated meetings notify every added participant (except the creator).
    if (status === 'scheduled' && data && data[0]) {
      for (const p of participants) {
        if (p.id === user?.id) continue
        const { error: msgError } = await supabase.from('messages').insert([{
          sender_id: user?.id,
          recipient_id: p.id,
          body: `${user?.name} scheduled a meeting "${title.trim()}" on ${formatDate(meetingDate)}${location.trim() ? ` at ${location.trim()}` : ''}.`,
          meeting_id: data[0].id,
          target_nav: 'meetings',
        }])
        if (msgError) console.error('meeting notify failed:', msgError.message)
      }
    }

    setTitle('')
    setNotes('')
    setMeetingDate('')
    setLocation('')
    setSelectedIds([])
    setShowForm(false)
    setSubmitting(false)
    loadMeetings()
  }

  function isParticipant(m) {
    return m.created_by === user?.id || (Array.isArray(m.participants) && m.participants.some((p) => p.id === user?.id))
  }

  function openNotesEditor(m) {
    if (!isParticipant(m)) return
    setNotesEditingId(m.id)
    setNotesDraft(m.notes || '')
    setLiveTranscript('')
    setRecordError('')
    setShowRecorder(false)
    if (isListening) stopListening()
  }

  async function saveNotes(m) {
    if (!isParticipant(m)) return
    const text = notesDraft.trim()
    const { error } = await supabase.from('meetings').update({
      notes: text || null,
      status: 'completed',
    }).eq('id', m.id)
    if (error) { setError(error.message); return }
    setNotesEditingId(null)
    loadMeetings()
  }

  // "Meeting stamps" for this person — every meeting where they're either
  // the one who logged/scheduled it, or one of the added participants.
  const myMeetings = meetings.filter((m) =>
    m.created_by === user?.id || (Array.isArray(m.participants) && m.participants.some((p) => p.id === user?.id))
  )
  const filtered = tab === 'all' ? myMeetings : myMeetings.filter((m) => m.status === tab)

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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-ink">Meeting Stamps</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
          style={{ backgroundColor: MEETING_COLOR }}
        >
          {showForm ? 'Cancel' : '+ Log / Schedule Meeting'}
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabBtn('all', 'All', myMeetings.length)}
        {tabBtn('scheduled', 'Upcoming', myMeetings.filter((m) => m.status === 'scheduled').length)}
        {tabBtn('completed', 'Logged', myMeetings.filter((m) => m.status === 'completed').length)}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6 mb-6 shadow-sm space-y-4">
          <p className="text-sm text-ink-muted">
            Pick today or a past date to log a meeting that already happened, or a future date to schedule one —
            everyone you add will see it in their own Meeting Stamps, and future meetings notify them right away.
          </p>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Meeting title</label>
            <input required className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="e.g. Weekly FMCS sync" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Date</label>
              <input required type="date" className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Location (optional)</label>
              <input className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                placeholder="e.g. Conference Room B" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What was discussed (leave blank if it hasn't happened yet)</label>
            <textarea rows={3} className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="Key points, decisions, action items…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="border border-line rounded-md p-3 bg-canvas">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted mb-2">Add people to this meeting</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {profiles.filter((p) => p.id !== user?.id).map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-line/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                  />
                  <span className="text-sm text-ink truncate">{p.name}</span>
                  <span className="font-mono text-[10px] text-ink-muted ml-auto shrink-0">{p.team}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full text-white rounded-md p-2.5 font-medium transition-colors disabled:opacity-60" style={{ backgroundColor: MEETING_COLOR }}>
            {submitting ? 'Saving…' : 'Save Meeting'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">No meetings here yet.</p>
          <p className="text-ink-muted text-sm mt-1">Log a past meeting or schedule an upcoming one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            notesEditingId === m.id ? (
              <div key={m.id} className="bg-surface border border-line rounded-xl p-5 shadow-sm">
                <p className="font-medium text-ink mb-2">{m.title}</p>

                {!showRecorder ? (
                  <button
                    type="button"
                    onClick={() => setShowRecorder(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors mb-3"
                    style={{ borderColor: MEETING_COLOR, color: MEETING_COLOR }}
                  >
                    🎙️ Record this meeting instead (optional)
                  </button>
                ) : (
                  <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: `${MEETING_COLOR}0D`, border: `1px solid ${MEETING_COLOR}30` }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">🎙️ Live Meeting Capture</p>
                      <div className="flex items-center gap-1.5">
                        {!isListening ? (
                          <button
                            type="button"
                            onClick={startListening}
                            className="text-xs font-medium px-3 py-1.5 rounded-md text-white transition-colors"
                            style={{ backgroundColor: MEETING_COLOR }}
                          >
                            Start Listening
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopListening}
                            className="text-xs font-medium px-3 py-1.5 rounded-md text-white bg-accent-red hover:bg-accent-red/90 transition-colors flex items-center gap-1.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Stop
                          </button>
                        )}
                        {!isListening && (
                          <button
                            type="button"
                            onClick={() => { setShowRecorder(false); setLiveTranscript(''); setRecordError('') }}
                            className="text-xs px-2 py-1.5 rounded-md text-ink-muted hover:text-ink"
                            title="Close recorder and type manually instead"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-muted mb-2">
                      Everyone in the room should know this meeting is being transcribed and sent to AI for a summary.
                      You can close this and type notes manually below at any time.
                    </p>
                    {liveTranscript && (
                      <div className="max-h-28 overflow-y-auto bg-surface border border-line rounded-md p-2 text-xs text-ink-muted mb-2 whitespace-pre-wrap">
                        {liveTranscript}
                      </div>
                    )}
                    {liveTranscript && !isListening && (
                      <button
                        type="button"
                        onClick={handleSummarize}
                        disabled={summarizing}
                        className="text-xs font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-60"
                        style={{ backgroundColor: '#7C5CBF' }}
                      >
                        {summarizing ? 'Summarizing…' : 'Summarize into Notes'}
                      </button>
                    )}
                    {recordError && <p className="text-[11px] text-accent-red mt-2">{recordError}</p>}
                  </div>
                )}

                <textarea
                  autoFocus={!showRecorder}
                  rows={3}
                  className="w-full border border-line rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                  placeholder="Type notes here manually, or use the recorder above…"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button onClick={() => { if (isListening) stopListening(); setNotesEditingId(null) }} className="text-xs px-3 py-1.5 rounded-md text-ink-muted hover:text-ink">Cancel</button>
                  <button onClick={() => saveNotes(m)} className="text-xs px-3 py-1.5 rounded-md text-white font-medium" style={{ backgroundColor: MEETING_COLOR }}>
                    Save Notes
                  </button>

                </div>
              </div>
            ) : (
              <MeetingCard key={m.id} m={m} currentUserId={user?.id} isFocused={m.id === focusMeetingId} onEditNotes={openNotesEditor} />
            )
          ))}
        </div>
      )}
    </div>
  )
}        