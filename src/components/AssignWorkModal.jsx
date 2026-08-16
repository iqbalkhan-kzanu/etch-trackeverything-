import { useState } from 'react'
import { supabase } from '../supabaseClient'

const MANAGER_COLOR = '#7C5CBF'

export default function AssignWorkModal({ mentor, assignee, onCancel, onAssigned }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !deadline) { setError('Title and deadline are required.'); return }
    setSubmitting(true)

    const { data, error: insertError } = await supabase.from('action_items').insert([{
      title: title.trim(),
      description: description.trim(),
      owner_name: assignee.name,
      team: mentor.team,
      source: 'project',
      deadline,
      visibility: 'team',
      assigned_by_mentor: mentor.name,
    }]).select()

    if (insertError) { setError(insertError.message); setSubmitting(false); return }

    if (data && data[0]) {
      await supabase.from('item_activity').insert([{
        item_id: data[0].id, actor: mentor.name, action: 'created', note: `Assigned by manager to ${assignee.name}`,
      }])
    }

    await supabase.from('messages').insert([{
      sender_id: mentor.id,
      recipient_id: assignee.id,
      body: `Your manager ${mentor.name} has assigned this work to you: "${title.trim()}" — due ${deadline}.`,
    }])

    setSubmitting(false)
    onAssigned()
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: MANAGER_COLOR }} />
        <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: MANAGER_COLOR }}>Manager Assignment</p>
        <h2 className="text-xl font-semibold text-ink mb-1">Assign work to {assignee.name}</h2>
        <p className="text-sm text-ink-muted mb-5">They'll be notified with a direct message automatically.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Title</label>
            <input required autoFocus className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:border-line"
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Update the flow chart" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Description</label>
            <textarea className="w-full border border-line rounded-md p-2.5 mt-1"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Deadline</label>
            <input required type="date" className="w-full border border-line rounded-md p-2.5 mt-1"
              value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 text-white rounded-md p-2.5 font-medium disabled:opacity-60 hover:opacity-90 transition-opacity" style={{ backgroundColor: MANAGER_COLOR }}>
              {submitting ? 'Assigning…' : 'Assign & Notify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}   