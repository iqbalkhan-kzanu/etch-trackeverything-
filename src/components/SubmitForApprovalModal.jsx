import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SubmitForApprovalModal({ item, user, onCancel, onConfirm }) {
  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])   // File objects picked, not yet uploaded
  const [previews, setPreviews] = useState([]) // local object URLs for thumbnails
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleFilePick(e) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    setFiles((prev) => [...prev, ...picked])
    setPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))])
    e.target.value = '' // allow picking the same file again if removed
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!note.trim()) { setError('Add a short conclusion — what was actually done.'); return }
    setSubmitting(true)

    try {
      const uploadedUrls = []
      for (const file of files) {
        const path = `${item.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file)
        if (uploadError) throw uploadError
        const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(path)
        uploadedUrls.push(publicUrlData.publicUrl)
      }
      await onConfirm({ note: note.trim(), images: uploadedUrls })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-1 bg-ink" />
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted mb-1">Submit for Approval</p>
        <h2 className="text-xl font-semibold text-ink mb-1">"{item.title}"</h2>
        <p className="text-sm text-ink-muted mb-5">Summarize what's done and attach proof if you have it. Your manager sees this before approving.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Conclusion — what's been done</label>
            <textarea
              autoFocus rows={3}
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              placeholder="e.g. Replaced the worn guard on line 3, tested for 2 shifts, no issues."
              value={note} onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Attachments</label>
              <label htmlFor="attach-input" className="cursor-pointer w-7 h-7 rounded-md border border-line flex items-center justify-center text-ink-muted hover:text-accent-blue hover:border-accent-blue transition-colors" title="Attach pictures">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
                </svg>
              </label>
              <input id="attach-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFilePick} />
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-line group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-ink/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-ink text-white rounded-md p-2.5 font-medium hover:bg-ink/90 transition-colors disabled:opacity-60">
              {submitting ? 'Uploading…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}          