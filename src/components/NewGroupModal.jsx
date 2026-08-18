import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NewGroupModal({ user, profiles, onCancel, onCreated }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || selected.length === 0) { setError('Name the group and pick at least one person.'); return }
    setCreating(true)
    const { data: ch, error: chErr } = await supabase
      .from('channels')
      .insert([{ name: name.trim(), team: user.team, created_by: user.id }])
      .select()
      .single()
    if (chErr) { setError(chErr.message); setCreating(false); return }

    const rows = [user.id, ...selected].map((uid) => ({ channel_id: ch.id, user_id: uid }))
    const { error: memErr } = await supabase.from('channel_members').insert(rows)
    if (memErr) { setError(memErr.message); setCreating(false); return }

    setCreating(false)
    onCreated(ch)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-blue" />
        <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">New</p>
        <h2 className="text-lg font-semibold text-ink mb-4">Group Chat</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Group name</label>
            <input required autoFocus className="w-full border border-line rounded-md p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FMCS Shift A" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Members</label>
            <div className="max-h-48 overflow-y-auto border border-line rounded-md mt-1 divide-y divide-line">
              {profiles.length === 0 ? (
                <p className="text-sm text-ink-muted px-3 py-3">No other people found.</p>
              ) : (
                profiles.filter((p) => p.id !== user.id).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-line/40">
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                    {p.name}
                  </label>
                ))
              )}
            </div>
            {selected.length > 0 && (
              <p className="font-mono text-[10px] text-ink-muted mt-1.5">{selected.length} selected</p>
            )}
          </div>
          {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="flex-1 bg-accent-blue text-white rounded-md p-2.5 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
              {creating ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}  