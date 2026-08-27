import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const TEAM_META = {
  FMCS: { color: '#2B6CB0', bg: '#EFF6FF' },
  HVAC: { color: '#D9A824', bg: '#FFFBEB' },
  UPW: { color: '#1F9E9E', bg: '#ECFEFE' },
  ELECTRICAL: { color: '#C1443C', bg: '#FEF2F2' },
  'GAS & CHEMICAL': { color: '#7C5CBF', bg: '#F5F3FF' },
  HR: { color: '#C15A9E', bg: '#FDF2F8' },
  SAFETY: { color: '#E07B39', bg: '#FFF7ED' },
  MODULE: { color: '#5C6670', bg: '#F8FAFC' },
}
const MANAGER_COLOR = '#7C5CBF'
const AVAILABLE_COLOR = '#2F8F5B'
const UNAVAILABLE_COLOR = '#9AA3AD'

export default function Directory({ user, onMessage, onAssign }) {
  const [profiles, setProfiles] = useState([])
  const [unreadBySender, setUnreadBySender] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [togglingAvailability, setTogglingAvailability] = useState(false)

  async function loadProfiles({ silent = false } = {}) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true })

    if (!error) {
      setProfiles(data || [])
    }
  }

  async function loadUnreadMessages() {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', user.id)
      .is('read_at', null)

    if (error) {
      console.error('Error loading unread messages:', error)
      return
    }

    const counts = {}

    ;(data || []).forEach((message) => {
      counts[message.sender_id] =
        (counts[message.sender_id] || 0) + 1
    })

    setUnreadBySender(counts)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)

      await loadProfiles()
      await loadUnreadMessages()

      setLoading(false)
    }

    load()

    // Profile fields (availability, role, etc.) don't have a per-user filter
    // we can subscribe to cheaply here, so keep a slow poll just for those.
    const profileInterval = setInterval(() => {
      loadProfiles({ silent: true })
    }, 15000)

    return () => clearInterval(profileInterval)
  }, [user?.id])

  // Realtime: unread badges update the instant a message arrives or gets
  // marked read (e.g. from ChatModal), no polling delay.
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`directory-unread-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        () => loadUnreadMessages()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Current user's own profile — used to check manager status and team
  const own = profiles.find((p) => p.id === user?.id)
  const isManager = own?.role === 'MANAGER'

  async function toggleAvailability() {
    if (!own || togglingAvailability) return
    const next = !(own.is_available ?? true)
    setTogglingAvailability(true)
    const { error } = await supabase.from('profiles').update({ is_available: next }).eq('id', user.id)
    setTogglingAvailability(false)
    if (!error) loadProfiles({ silent: true })
  }

  // All team names available, regardless of current search — used to populate the team select
  const allTeams = Array.from(
    new Set(profiles.map((p) => p.team || 'Unassigned'))
  ).sort()

  const filteredProfiles = profiles.filter((p) => {
    const term = search.toLowerCase().trim()
    const team = p.team || 'Unassigned'

    if (selectedTeam !== 'all' && team !== selectedTeam) return false

    if (!term) return true

    return (
      p.name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.team?.toLowerCase().includes(term) ||
      p.employee_id?.toString().includes(term)
    )
  })

  const grouped = {}

  filteredProfiles.forEach((p) => {
    const team = p.team || 'Unassigned'

    if (!grouped[team]) {
      grouped[team] = []
    }

    grouped[team].push(p)
  })

  const teamKeys = Object.keys(grouped).sort()

  const totalUnread = Object.values(unreadBySender).reduce(
    (sum, count) => sum + count,
    0
  )

  function getInitials(name) {
    if (!name) return '?'

    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* HEADER */}
      <div className="flex flex-col items-center text-center gap-5 mb-8">

        <div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <h2 className="text-2xl font-semibold text-ink">
              MEET YOUR MATES    
            </h2>

            {totalUnread > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                {totalUnread} unread
              </span>
            )}
          </div>

          <p className="text-sm text-ink-muted">
            Partners at work
          </p>
        </div>

        {/* SEARCH + TEAM FILTER */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xl">

          <div className="relative w-full sm:flex-1">

            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
              />
            </svg>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or teams..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />

          </div>

          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full sm:w-52 shrink-0 py-2.5 px-3 rounded-lg border border-line bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            <option value="all">All teams</option>
            {allTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-ink-muted font-mono text-sm">
            Loading directory…
          </p>
        </div>
      ) : teamKeys.length === 0 ? (
        <div className="border border-dashed border-line rounded-2xl p-12 text-center bg-surface">
          <p className="text-ink font-medium">
            No members found.
          </p>

          {(search || selectedTeam !== 'all') && (
            <p className="text-sm text-ink-muted mt-1">
              Try a different search or team.
            </p>
          )}
        </div>
      ) : (

        /* TEAM SECTIONS */
        <div className="space-y-7">

          {teamKeys.map((team) => {

            const meta = TEAM_META[team] || {
              color: '#5C6670',
              bg: '#F8FAFC',
            }

            const members = grouped[team]

            return (
              <section key={team}>

                {/* TEAM HEADER */}
                <div className="flex items-center justify-between mb-3 px-1">

                  <div className="flex items-center gap-3">

                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                    </div>

                    <div>
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: meta.color }}
                      >
                        {team}
                      </h3>

                      <p className="text-xs text-ink-muted">
                        {members.length}{' '}
                        {members.length === 1 ? 'member' : 'members'}
                      </p>
                    </div>

                  </div>

                </div>

                {/* MEMBER GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                  {members.map((m) => {

                    const unreadCount =
                      unreadBySender[m.id] || 0

                    const isSelf =
                      user && m.id === user.id

                    const canAssign =
                      isManager && own?.team === team && !isSelf

                    // Defaults to available (true) if never set, matching the DB default.
                    const isAvailable = m.is_available ?? true

                    return (
                      <div
                        key={m.id}
                        className={`group relative bg-surface border rounded-xl p-4 transition-all ${
                          unreadCount > 0
                            ? 'border-red-200 shadow-sm'
                            : 'border-line hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >

                        {/* UNREAD INDICATOR */}
                        {unreadCount > 0 && (
                          <div className="absolute top-3 right-3">
                            <span className="min-w-6 h-6 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {unreadCount > 99
                                ? '99+'
                                : unreadCount}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-3">

                          {/* AVATAR + AVAILABILITY DOT */}
                          <div className="relative shrink-0">
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold"
                              style={{
                                backgroundColor: meta.bg,
                                color: meta.color,
                              }}
                            >
                              {getInitials(m.name)}
                            </div>
                            <span
                              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface"
                              style={{ backgroundColor: isAvailable ? AVAILABLE_COLOR : UNAVAILABLE_COLOR }}
                              title={isAvailable ? 'Available' : 'Unavailable'}
                            />
                          </div>

                          {/* PERSON INFO */}
                          <div className="min-w-0 flex-1">

                            <div className="flex items-center gap-2 pr-8 flex-wrap">

                              <p className="font-semibold text-sm text-ink truncate">
                                {m.name}
                              </p>

                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-ink-muted">
                                  You
                                </span>
                              )}

                              {m.role === 'MANAGER' && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ backgroundColor: `${MANAGER_COLOR}15`, color: MANAGER_COLOR }}
                                >
                                  Manager
                                </span>
                              )}

                            </div>

                            <p className="text-xs text-ink-muted truncate mt-0.5">
                              {m.email}
                            </p>

                            <p
                              className="text-[11px] font-medium mt-0.5"
                              style={{ color: isAvailable ? AVAILABLE_COLOR : UNAVAILABLE_COLOR }}
                            >
                              {isAvailable ? 'Available now' : 'Unavailable'}
                            </p>

                          </div>

                        </div>

                        {/* BOTTOM INFORMATION */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-line gap-2 flex-wrap">

                          <div className="flex items-center gap-2">

                            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                              ID
                            </span>

                            <span className="font-mono text-xs text-ink-muted">
                              {m.employee_id || '—'}
                            </span>

                          </div>

                          <div className="flex items-center gap-2">

                            {isSelf ? (
                              <button
                                onClick={toggleAvailability}
                                disabled={togglingAvailability}
                                className="flex items-center gap-2 text-xs font-semibold px-1 py-1 rounded-full transition-opacity disabled:opacity-50"
                                title="Toggle your availability"
                              >
                                <span
                                  className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                                  style={{ backgroundColor: isAvailable ? AVAILABLE_COLOR : '#D1D5DB' }}
                                >
                                  <span
                                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                                    style={{ left: isAvailable ? '18px' : '2px' }}
                                  />
                                </span>
                                <span style={{ color: isAvailable ? AVAILABLE_COLOR : UNAVAILABLE_COLOR }}>
                                  {isAvailable ? 'Available' : 'Unavailable'}
                                </span>
                              </button>
                            ) : (
                              <>
                                {canAssign && (
                                  <button
                                    onClick={() => onAssign(m)}
                                    className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-white transition-all hover:opacity-90 active:scale-95"
                                    style={{ backgroundColor: MANAGER_COLOR }}
                                  >
                                    Assign Work
                                  </button>
                                )}

                                <button
                                  onClick={() => onMessage(m)}
                                  className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-white transition-all hover:opacity-90 active:scale-95"
                                  style={{
                                    backgroundColor: meta.color,
                                  }}
                                >
                                  Message
                                </button>
                              </>
                            )}

                          </div>

                        </div>

                        {/* UNREAD MESSAGE TEXT */}
                        {unreadCount > 0 && (
                          <div className="mt-3 px-3 py-2 rounded-lg bg-red-50">
                            <p className="text-xs text-red-600 font-medium">
                              {unreadCount === 1
                                ? 'New unread message'
                                : `${unreadCount} unread messages`}
                            </p>
                          </div>
                        )}

                      </div>
                    )
                  })}

                </div>

              </section>
            )
          })}

        </div>
      )}

    </div>
  )
}    