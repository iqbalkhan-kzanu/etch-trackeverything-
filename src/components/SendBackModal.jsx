import { useState } from 'react'

export default function SendBackModal({ item, onCancel, onConfirm }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!note.trim()) { setError('Add a comment explaining what needs fixing.'); return }
    setSubmitting(true)
    await onConfirm({ note: note.trim() })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-red" />
        <p className="font-mono text-xs uppercase tracking-wider text-accent-red mb-1">Send Back</p>
        <h2 className="text-xl font-semibold text-ink mb-1">Send "{item.title}" back</h2>
        <p className="text-sm text-ink-muted mb-5">
          This reopens the item at "Ready to Close" and notifies {item.owner_name}.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">What needs re-examination?</label>
            <textarea
              autoFocus rows={3}
              className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-red/40 focus:border-accent-red"
              placeholder="e.g. Evidence photo doesn't match the description"
              value={note} onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-accent-red text-white rounded-md p-2.5 font-medium hover:bg-accent-red/90 transition-colors disabled:opacity-60">
              {submitting ? 'Sending…' : 'Send Back'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}    