import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import CreateGroupModal from './CreateGroupModal'
import GroupChatModal from './GroupChatModal'

export default function GroupsList({ user, profiles }) {
  const [myGroups, setMyGroups] = useState([])
  const [unread, setUnread] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [error, setError] = useState('')

  async function loadMyGroups() {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('group_id, last_read_at, chat_groups(*)')
      .eq('user_id', user.id)

    if (error) { setError(error.message); setLoading(false); return }

    const groups = (data || [])
      .filter((row) => row.chat_groups)
      .map((row) => ({ ...row.chat_groups, last_read_at: row.last_read_at }))
    setMyGroups(groups)

    const counts = {}
    await Promise.all(groups.map(async (g) => {
      let query = supabase
        .from('group_messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id)
        .neq('sender_id', user.id)
      if (g.last_read_at) query = query.gt('created_at', g.last_read_at)
      const { count } = await query
      counts[g.id] = count || 0
    }))
    setUnread(counts)
    setLoading(false)
  }

  useEffect(() => { loadMyGroups() }, [user.id])

  // Lazily create/sync the team channel: makes it if missing, and pulls in
  // anyone on `user.team` who isn't a member yet (e.g. new hires).
  async function openTeamChannel() {
    setError('')
    let { data: group } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('is_team_group', true)
      .eq('team', user.team)
      .maybeSingle()

    if (!group) {
      const { data: created, error: createError } = await supabase
        .from('chat_groups')
        .insert([{ name: `${user.team} Team`, is_team_group: true, team: user.team, created_by: user.id }])
        .select()
        .single()
      if (createError) { setError(createError.message); return }
      group = created
    }

    const teamMemberIds = profiles.filter((p) => p.team === user.team).map((p) => p.id)
    const { data: existingMembers } = await supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', group.id)
    const existingIds = new Set((existingMembers || []).map((m) => m.user_id))
    const toAdd = teamMemberIds.filter((id) => !existingIds.has(id))
    if (toAdd.length > 0) {
      await supabase.from('chat_group_members').insert(toAdd.map((id) => ({ group_id: group.id, user_id: id })))
    }

    setOpenGroup(group)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {openGroup && (
        <GroupChatModal
          currentUser={user}
          group={openGroup}
          onClose={() => { setOpenGroup(null); loadMyGroups() }}
          onRead={loadMyGroups}
        />
      )}
      {showCreate && (
        <CreateGroupModal
          user={user}
          profiles={profiles}
          onCancel={() => setShowCreate(false)}
          onCreated={(group) => { setShowCreate(false); loadMyGroups(); setOpenGroup(group) }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Groups</h2>
          <p className="text-sm text-ink-muted mt-0.5">Your team channel and any custom groups.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-accent-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-blue/90 transition-colors">
          + New Group
        </button>
      </div>

      {error && <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 mb-4 text-sm font-mono">{error}</div>}

      <button
        onClick={openTeamChannel}
        className="w-full flex items-center justify-between border border-line rounded-xl bg-surface p-4 shadow-sm hover:shadow-md transition-shadow text-left mb-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center font-mono text-xs font-bold shrink-0">#</div>
          <div className="min-w-0">
            <p className="font-medium text-ink truncate">{user.team} Team</p>
            <p className="text-xs text-ink-muted">Everyone on your team</p>
          </div>
        </div>
      </button>

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading groups…</p>
      ) : myGroups.filter((g) => !g.is_team_group).length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-8 text-center bg-surface">
          <p className="text-ink font-medium">No custom groups yet.</p>
          <p className="text-ink-muted text-sm mt-1">Create one to chat with a specific set of people.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {myGroups.filter((g) => !g.is_team_group).map((g) => (
            <button
              key={g.id}
              onClick={() => setOpenGroup(g)}
              className="w-full flex items-center justify-between border border-line rounded-xl bg-surface p-4 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">{g.name}</p>
              </div>
              {unread[g.id] > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-3">
                  {unread[g.id] > 99 ? '99+' : unread[g.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}       