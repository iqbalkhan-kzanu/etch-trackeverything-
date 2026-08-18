import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function CreateGroupModal({ user, profiles, onCancel, onCreated }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const others = profiles.filter((p) => p.id !== user.id)
  const filtered = others.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase().trim())
  )
  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  function toggle(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Give the group a name.'); return }
    if (selectedIds.length === 0) { setError('Pick at least one person.'); return }
    setSubmitting(true)

    const { data: group, error: groupError } = await supabase
      .from('chat_groups')
      .insert([{ name: name.trim(), is_team_group: false, created_by: user.id }])
      .select()
      .single()

    if (groupError) { setError(groupError.message); setSubmitting(false); return }

    const memberRows = [user.id, ...selectedIds].map((id) => ({ group_id: group.id, user_id: id }))
    const { error: memberError } = await supabase.from('chat_group_members').insert(memberRows)
    if (memberError) { setError(memberError.message); setSubmitting(false); return }

    setSubmitting(false)
    onCreated(group)
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-blue" />
        <div className="px-6 pt-6 pb-1 shrink-0">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">New Group</p>
          <h2 className="text-xl font-semibold text-ink mb-4">Start a group chat</h2>
          <input
            className="w-full border border-line rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
            placeholder="Group name, e.g. Shift Handover"
            value={name} onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border border-line rounded-md p-2.5 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
            placeholder="Search people…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted py-4 text-center">No matches.</p>
          ) : (
            filtered.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-line/40 cursor-pointer">
                <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggle(p.id)} />
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{p.name}</p>
                  <p className="font-mono text-[10px] text-ink-muted">{p.team}</p>
                </div>
              </label>
            ))
          )}
        </div>

        {error && <p className="mx-6 text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2">{error}</p>}

        <div className="flex gap-3 px-6 py-4 border-t border-line shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 border border-line rounded-md p-2.5 font-medium text-ink-muted hover:text-ink transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-accent-blue text-white rounded-md p-2.5 font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-60">
            {submitting ? 'Creating…' : `Create (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}   