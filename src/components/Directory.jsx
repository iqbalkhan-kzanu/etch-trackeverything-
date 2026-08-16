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

export default function Directory() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('profiles').select('*').order('name', { ascending: true })
      setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const grouped = {}
  profiles.forEach((p) => {
    const key = p.team || 'Unassigned'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  })
  const teamKeys = Object.keys(grouped).sort()

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-1">Team Directory</h2>
      <p className="text-sm text-ink-muted mb-6">{profiles.length} registered member{profiles.length !== 1 ? 's' : ''} across {teamKeys.length} team{teamKeys.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading…</p>
      ) : profiles.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">No members registered yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teamKeys.map((team) => {
            const color = TEAM_META[team]?.color || '#5C6670'
            const members = grouped[team]
            return (
              <div key={team} className="border border-line rounded-xl bg-surface shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-line" style={{ backgroundColor: `${color}0D` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <p className="font-semibold" style={{ color }}>{team}</p>
                  <span className="font-mono text-[11px] text-ink-muted ml-auto">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-line">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{m.email}</p>
                      </div>
                      <span className="font-mono text-xs text-ink-muted border border-line rounded px-2 py-1">
                        {m.employee_id || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}           