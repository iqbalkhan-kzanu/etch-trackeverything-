import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import CreateGroupModal from './CreateGroupModal'
import GroupChatModal from './GroupChatModal'

// Same palette Directory.jsx uses for team badges — kept identical so a
// team's color means the same thing everywhere in the app.
const TEAM_META = {
  FMCS: '#2B6CB0',
  HVAC: '#D9A824',
  UPW: '#1F9E9E',
  ELECTRICAL: '#C1443C',
  'GAS & CHEMICAL': '#7C5CBF',
  HR: '#C15A9E',
  SAFETY: '#E07B39',
  MODULE: '#5C6670',
}

function teamColor(team) {
  return TEAM_META[team] || '#5C6670'
}

// Other (custom) groups don't have an inherent team color, so each one gets
// a stable color of its own — hashed from the group id, so it's consistent
// every time you see it, but distinct from group to group.
const GROUP_PALETTE = ['#2B6CB0', '#D9A824', '#1F9E9E', '#C1443C', '#7C5CBF', '#C15A9E', '#E07B39', '#2F8F5B']
function groupColor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[hash % GROUP_PALETTE.length]
}

function GroupsIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
}
function MembersIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 6-6 8-6s6.5 2 8 6" /></svg>)
}
function ChatIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>)
}
function ChevronIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>)
}

function StatChip({ icon, value, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-accent-blue">{icon}</span>
      <span className="font-semibold text-ink text-lg">{value}</span>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  )
}

export default function GroupsList({ user, profiles, onUnreadChange }) {
  const [myGroups, setMyGroups] = useState([])
  const [unread, setUnread] = useState({})
  const [memberCounts, setMemberCounts] = useState({})
  const [activityCounts, setActivityCounts] = useState({})
  const [uniqueMemberCount, setUniqueMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [highlighted, setHighlighted] = useState(null)
  const [error, setError] = useState('')

  async function loadMyGroups({ silent = false } = {}) {
    if (!silent) setLoading(true)
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('group_id, last_read_at, chat_groups(*)')
      .eq('user_id', user.id)

    if (error) { if (!silent) { setError(error.message); setLoading(false) } return }

    const groups = (data || [])
      .filter((row) => row.chat_groups)
      .map((row) => ({ ...row.chat_groups, last_read_at: row.last_read_at }))
    setMyGroups(groups)

    const groupIds = groups.map((g) => g.id)
    if (groupIds.length === 0) {
      setUnread({}); setMemberCounts({}); setActivityCounts({}); setUniqueMemberCount(0)
      onUnreadChange?.(0)
      if (!silent) setLoading(false)
      return
    }

    const lastReadMap = {}
    groups.forEach((g) => { lastReadMap[g.id] = g.last_read_at })

    // Two batched queries instead of three-per-group — scales fine as the
    // number of groups grows, and lets us de-duplicate members correctly.
    const [{ data: memberRows }, { data: messageRows }] = await Promise.all([
      supabase.from('chat_group_members').select('group_id, user_id').in('group_id', groupIds),
      supabase.from('group_messages').select('group_id, sender_id, created_at').in('group_id', groupIds),
    ])

    const members = {}
    const uniqueMembers = new Set()
    ;(memberRows || []).forEach((r) => {
      members[r.group_id] = (members[r.group_id] || 0) + 1
      uniqueMembers.add(r.user_id)
    })

    const activity = {}
    const unreadCounts = {}
    ;(messageRows || []).forEach((m) => {
      activity[m.group_id] = (activity[m.group_id] || 0) + 1
      const threshold = lastReadMap[m.group_id]
      const isUnread = m.sender_id !== user.id && (!threshold || new Date(m.created_at) > new Date(threshold))
      if (isUnread) unreadCounts[m.group_id] = (unreadCounts[m.group_id] || 0) + 1
    })

    setUnread(unreadCounts)
    setMemberCounts(members)
    setActivityCounts(activity)
    setUniqueMemberCount(uniqueMembers.size)
    onUnreadChange?.(Object.values(unreadCounts).reduce((sum, n) => sum + n, 0))
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    loadMyGroups()
    const interval = setInterval(() => loadMyGroups({ silent: true }), 6000)
    return () => clearInterval(interval)
  }, [user.id])

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

    const { data: existing } = await supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      const { error: joinError } = await supabase
        .from('chat_group_members')
        .insert([{ group_id: group.id, user_id: user.id }])
      if (joinError) { setError(joinError.message); return }
    }

    setHighlighted(group.id)
    setOpenGroup(group)
  }

  function openOtherGroup(g) {
    setHighlighted(g.id)
    setOpenGroup(g)
  }

  const teamGroup = myGroups.find((g) => g.is_team_group)
  const otherGroups = myGroups.filter((g) => !g.is_team_group)
  const teamUnread = teamGroup ? (unread[teamGroup.id] || 0) : 0

  const totalGroups = myGroups.length
  const activeConversations = Object.values(activityCounts).filter((n) => n > 0).length

  return (
    <div className="relative min-h-screen">
      {/* Dynamic background layer — soft gradient wash + slow-moving blurred blobs
          in colors pulled from the existing team palette, so it reads as
          "part of the app" rather than a generic decorative backdrop. */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#2B6CB0]/20 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#1F9E9E]/20 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#7C5CBF]/20 blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-[#D9A824]/10 blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {openGroup && (
          <GroupChatModal
            currentUser={user}
            group={openGroup}
            profiles={profiles}
            onClose={() => { setOpenGroup(null); loadMyGroups() }}
            onRead={() => loadMyGroups({ silent: true })}
          />
        )}
        {showCreate && (
          <CreateGroupModal
            user={user}
            profiles={profiles}
            onCancel={() => setShowCreate(false)}
            onCreated={(group) => { setShowCreate(false); loadMyGroups(); setHighlighted(group.id); setOpenGroup(group) }}
          />
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">Groups</h2>
            <p className="text-sm text-ink-muted mt-0.5">Your team channel and any other groups.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="bg-accent-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-accent-blue/90 transition-colors">
            + New Group
          </button>
        </div>

        {error && <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 mb-4 text-sm font-mono">{error}</div>}

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* LEFT — channel rail */}
          <div className="space-y-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mb-2 px-1">Team Group</p>
              <button
                onClick={openTeamChannel}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 border text-left transition-colors ${
                  highlighted === teamGroup?.id ? 'border-accent-blue bg-accent-blue/5' : 'border-line bg-surface hover:border-gray-300'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: teamColor(user.team) }}
                >
                  {user.team?.[0] || '?'}
                </div>
                <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{user.team} Team</span>
                {teamUnread > 0 ? (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {teamUnread > 99 ? '99+' : teamUnread}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-ink-muted shrink-0">{memberCounts[teamGroup?.id] ?? ''}</span>
                )}
              </button>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mb-2 px-1">Other Groups</p>
              {otherGroups.length === 0 ? (
                <p className="text-xs text-ink-muted px-3 py-2">None yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {otherGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => openOtherGroup(g)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 border text-left transition-colors ${
                        highlighted === g.id ? 'border-accent-blue bg-accent-blue/5' : 'border-line bg-surface hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: groupColor(g.id) }}
                      >
                        {g.name?.[0]?.toUpperCase() || '#'}
                      </div>
                      <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{g.name}</span>
                      {unread[g.id] > 0 ? (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {unread[g.id] > 99 ? '99+' : unread[g.id]}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-ink-muted shrink-0">{memberCounts[g.id] ?? ''}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — overview */}
          <div className="border border-line rounded-xl bg-surface shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0">
                <GroupsIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">All Groups</h3>
                <p className="text-sm text-ink-muted">Overview of your team and other groups.</p>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-line flex flex-wrap gap-8">
              <StatChip icon={<GroupsIcon className="w-4 h-4" />} value={totalGroups} label="Total Groups" />
              <StatChip icon={<MembersIcon className="w-4 h-4" />} value={uniqueMemberCount} label="Total Members" />
              <StatChip icon={<ChatIcon className="w-4 h-4" />} value={activeConversations} label="Active Conversations" />
            </div>

            {loading ? (
              <p className="text-ink-muted font-mono text-sm px-6 py-6">Loading groups…</p>
            ) : myGroups.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-ink font-medium">No groups yet.</p>
                <p className="text-ink-muted text-sm mt-1">Open your team channel or create another group to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {teamGroup && (
                  <button
                    onClick={openTeamChannel}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-line/30 transition-colors text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: teamColor(user.team) }}
                    >
                      {user.team?.[0] || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">{user.team} Team</p>
                      <p className="text-xs text-ink-muted truncate">Everyone on your team</p>
                    </div>
                    {teamUnread > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {teamUnread > 99 ? '99+' : teamUnread}
                      </span>
                    )}
                    <span className="font-mono text-xs text-ink-muted shrink-0 w-24 text-right">{memberCounts[teamGroup.id] ?? 0} members</span>
                    <ChevronIcon className="w-4 h-4 text-ink-muted shrink-0" />
                  </button>
                )}
                {otherGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => openOtherGroup(g)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-line/30 transition-colors text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: groupColor(g.id) }}
                    >
                      {g.name?.[0]?.toUpperCase() || '#'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">{g.name}</p>
                      <p className="text-xs text-ink-muted truncate">Other group</p>
                    </div>
                    {unread[g.id] > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {unread[g.id] > 99 ? '99+' : unread[g.id]}
                      </span>
                    )}
                    <span className="font-mono text-xs text-ink-muted shrink-0 w-24 text-right">{memberCounts[g.id] ?? 0} members</span>
                    <ChevronIcon className="w-4 h-4 text-ink-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>  
    </div>
  )
}    