import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

function nameFor(id, profiles, fallback) {
  return profiles.find((p) => p.id === id)?.name || fallback || 'Unknown'
}

// Single check = sent, double grey = delivered, double blue = read (DM),
// or "seen by n/total" for groups.
function MessageTicks({ isMe, delivered_at, read_at, isGroup, seenCount, totalOthers }) {
  if (!isMe) return null
  if (isGroup) {
    if (totalOthers === 0) return null
    const allSeen = seenCount >= totalOthers
    return (
      <span className={`text-[10px] font-mono ml-1 ${allSeen ? 'text-accent-blue' : 'text-white/60'}`}>
        {allSeen ? '✓✓' : seenCount > 0 ? `✓✓ ${seenCount}/${totalOthers}` : '✓'}
      </span>
    )
  }
  if (read_at) return <span className="text-[10px] font-mono ml-1 text-accent-blue">✓✓</span>
  if (delivered_at) return <span className="text-[10px] font-mono ml-1 text-white/60">✓✓</span>
  return <span className="text-[10px] font-mono ml-1 text-white/60">✓</span>
}

export default function ChatModal({ currentUser, recipient, channel, profiles = [], onClose, onMessagesRead, onLeftGroup }) {
  const isGroup = !!channel
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([]) // group only: channel_members rows
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const bottomRef = useRef(null)

  async function loadMembers() {
    if (!isGroup) return
    const { data } = await supabase
      .from('channel_members')
      .select('user_id, last_read_at')
      .eq('channel_id', channel.id)
    setMembers(data || [])
  }

  async function markRead() {
    if (isGroup) {
      await supabase
        .from('channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channel.id)
        .eq('user_id', currentUser.id)
    } else {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', currentUser.id)
        .eq('sender_id', recipient.id)
        .is('read_at', null)
    }
    onMessagesRead?.()
  }

  async function loadMessages() {
    setLoading(true)
    let query = supabase.from('messages').select('*').order('created_at', { ascending: true })
    query = isGroup
      ? query.eq('channel_id', channel.id)
      : query.or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${currentUser.id})`)
    const { data } = await query
    setMessages(data || [])
    setLoading(false)
    await markRead()
    if (isGroup) loadMembers()
  }

  useEffect(() => { loadMessages() }, [isGroup ? channel.id : recipient.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Realtime: new messages in this thread, plus live tick updates
  // (read_at changes for DM, last_read_at changes for group members).
  useEffect(() => {
    const filter = isGroup ? `channel_id=eq.${channel.id}` : undefined
    const msgChannel = supabase
      .channel(`messages-${isGroup ? channel.id : [currentUser.id, recipient.id].sort().join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter }, (payload) => {
        if (!isGroup) {
          const row = payload.new || payload.old
          const belongs =
            (row.sender_id === currentUser.id && row.recipient_id === recipient.id) ||
            (row.sender_id === recipient.id && row.recipient_id === currentUser.id)
          if (!belongs) return
        }
        loadMessages()
      })
      .subscribe()

    let memberChannel
    if (isGroup) {
      memberChannel = supabase
        .channel(`channel-members-${channel.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_members', filter: `channel_id=eq.${channel.id}` }, () => {
          loadMembers()
        })
        .subscribe()
    }

    return () => {
      supabase.removeChannel(msgChannel)
      if (memberChannel) supabase.removeChannel(memberChannel)
    }
  }, [isGroup ? channel.id : recipient.id])

  function seenCountFor(msg) {
    if (!isGroup) return 0
    return members.filter((m) => m.user_id !== currentUser.id && m.last_read_at && new Date(m.last_read_at) >= new Date(msg.created_at)).length
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const payload = isGroup
      ? { sender_id: currentUser.id, channel_id: channel.id, body: text.trim() }
      : { sender_id: currentUser.id, recipient_id: recipient.id, body: text.trim() }
    const { error } = await supabase.from('messages').insert([payload])
    setSending(false)
    if (!error) {
      setText('')
      loadMessages()
    }
  }

  async function handleLeave() {
    setLeaving(true)
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', currentUser.id)
    setLeaving(false)
    if (!error) {
      onLeftGroup?.(channel.id)
      onClose()
    }
  }

  const title = isGroup ? channel.name : recipient.name
  const subtitle = isGroup ? `${members.length} member${members.length === 1 ? '' : 's'}` : recipient.team

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl w-full max-w-md shadow-xl flex flex-col overflow-hidden" style={{ height: '600px' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">{title}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isGroup && (
              confirmLeave ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="font-mono text-[10px] uppercase tracking-wider text-white bg-accent-red rounded-md px-2 py-1 hover:opacity-90 disabled:opacity-60"
                  >
                    {leaving ? 'Leaving…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-accent-red border border-line hover:border-accent-red rounded-md px-2 py-1 transition-colors"
                >
                  Leave
                </button>
              )
            )}
            <button onClick={onClose} className="text-ink-muted hover:text-ink font-mono text-sm">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <p className="text-ink-muted font-mono text-sm">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-ink-muted text-sm text-center py-10">No messages yet. Say hello.</p>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === currentUser.id
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${isMe ? 'bg-accent-blue text-white' : 'bg-line text-ink'}`}>
                    {isGroup && !isMe && (
                      <p className="text-[10px] font-mono uppercase tracking-wider opacity-70 mb-0.5">
                        {nameFor(m.sender_id, profiles)}
                      </p>
                    )}
                    <span>{m.body}</span>
                    <MessageTicks
                      isMe={isMe}
                      delivered_at={m.delivered_at}
                      read_at={m.read_at}
                      isGroup={isGroup}
                      seenCount={seenCountFor(m)}
                      totalOthers={isGroup ? Math.max(members.length - 1, 0) : 0}
                    />
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-line shrink-0">
          <input
            className="flex-1 border border-line rounded-md p-2.5 text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={sending} className="bg-accent-blue text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-60">
            Send
          </button>
        </form>
      </div>
    </div>  
  )
}    