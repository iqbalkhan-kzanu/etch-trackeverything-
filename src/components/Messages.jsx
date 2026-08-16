import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Messages({ currentUser, onOpenChat }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })

      const seen = {}
      const partnerIds = []
      ;(data || []).forEach((m) => {
        const otherId = m.sender_id === currentUser.id ? m.recipient_id : m.sender_id
        if (!seen[otherId]) {
          seen[otherId] = m
          partnerIds.push(otherId)
        }
      })

      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', partnerIds)
        const list = partnerIds
          .map((id) => ({ profile: profiles.find((p) => p.id === id), lastMessage: seen[id] }))
          .filter((c) => c.profile)
        setConversations(list)
      } else {
        setConversations([])
      }
      setLoading(false)
    }
    load()
  }, [currentUser.id])

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-1">Messages</h2>
      <p className="text-sm text-ink-muted mb-6">Direct conversations with your teammates.</p>

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading…</p>
      ) : conversations.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">No conversations yet.</p>
          <p className="text-ink-muted text-sm mt-1">Message someone from the Team Directory to start one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(({ profile, lastMessage }) => (
            <button
              key={profile.id}
              onClick={() => onOpenChat(profile)}
              className="w-full flex items-center justify-between border border-line rounded-xl bg-surface p-4 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{profile.name}</p>
                <p className="text-sm text-ink-muted truncate">{lastMessage.body}</p>
              </div>
              <span className="font-mono text-[11px] text-ink-muted shrink-0 ml-3">{profile.team}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}       