import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const TEAM_META = {
  FMCS: { color: '#2B6CB0' },
  HVAC: { color: '#D9A824' },
  UPW: { color: '#1F9E9E' },
  ELECTRICAL: { color: '#C1443C' },
  'GAS & CHEMICAL': { color: '#7C5CBF' },
  HR: { color: '#C15A9E' },
  SAFETY: { color: '#E07B39' },
  MODULE: { color: '#5C6670' },
}

export default function Directory({ user, onMessage }) {
  const [profiles, setProfiles] = useState([])
  const [unreadBySender, setUnreadBySender] = useState({})
  const [loading, setLoading] = useState(true)

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true })

    setProfiles(data || [])
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
      counts[message.sender_id] = (counts[message.sender_id] || 0) + 1
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

    // Check for new messages every 5 seconds
    const interval = setInterval(() => {
      loadUnreadMessages()
    }, 5000)

    return () => clearInterval(interval)
  }, [user?.id])

  const grouped = {}

  profiles.forEach((p) => {
    const key = p.team || 'Unassigned'

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(p)
  })

  const teamKeys = Object.keys(grouped).sort()

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-1">
        Team Directory
      </h2>

      <p className="text-sm text-ink-muted mb-6">
        {profiles.length} registered member
        {profiles.length !== 1 ? 's' : ''} across {teamKeys.length} team
        {teamKeys.length !== 1 ? 's' : ''}
      </p>

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">
          Loading…
        </p>
      ) : profiles.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">
            No members registered yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {teamKeys.map((team) => {
            const color = TEAM_META[team]?.color || '#5C6670'
            const members = grouped[team]

            return (
              <div
                key={team}
                className="border border-line rounded-xl bg-surface shadow-sm overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-5 py-3 border-b border-line"
                  style={{ backgroundColor: `${color}0D` }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />

                  <p className="font-semibold" style={{ color }}>
                    {team}
                  </p>

                  <span className="font-mono text-[11px] text-ink-muted ml-auto">
                    {members.length} member
                    {members.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {members.map((m) => {
                    const unreadCount = unreadBySender[m.id] || 0

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-5 py-3 gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-ink">
                              {m.name}
                            </p>

                            {unreadCount > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-ink-muted mt-0.5">
                            {m.email}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs text-ink-muted border border-line rounded px-2 py-1">
                            {m.employee_id || '—'}
                          </span>

                          {user && m.id !== user.id && (
                            <button
                              onClick={() => onMessage(m)}
                              className="text-xs font-medium text-white px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: color }}
                            >
                              Message
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}    