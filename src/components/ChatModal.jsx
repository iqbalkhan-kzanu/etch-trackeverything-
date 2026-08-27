import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const AVATAR_PALETTE = ['#2B6CB0', '#7C5CBF', '#2F8F5B', '#D98C2B', '#C1443C', '#1F9E9E', '#C15A9E']
function colorFromId(id) {
  let hash = 0
  const str = id || ''
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}
function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
function formatClock(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function formatDayLabel(ts) {
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return isToday ? `Today, ${datePart}` : datePart
}

function XIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>)
}
function SendIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M11 13 22 2" /></svg>)
}
function TaskLinkIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 10h8M8 14h5" /></svg>)
}

export default function ChatModal({ currentUser, recipient, onClose, onMessagesRead, onOpenItem }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const recipientColor = colorFromId(recipient.id)

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)

    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', currentUser.id)
      .eq('sender_id', recipient.id)
      .is('read_at', null)

    onMessagesRead?.()
  }

  useEffect(() => { loadMessages() }, [recipient.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Realtime: any new message between these two people (either direction)
  // appears instantly without waiting for a resend/reopen.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${currentUser.id}-${recipient.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new
          const isThisThread =
            (m.sender_id === currentUser.id && m.recipient_id === recipient.id) ||
            (m.sender_id === recipient.id && m.recipient_id === currentUser.id)
          if (isThisThread) loadMessages()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient.id, currentUser.id])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert([{
      sender_id: currentUser.id, recipient_id: recipient.id, body: text.trim(),
    }])
    setSending(false)
    if (!error) {
      setText('')
      loadMessages()
    }
  }

  // Group messages into date buckets for the "Today, Aug 17" dividers.
  const dayGroups = []
  messages.forEach((m) => {
    const label = formatDayLabel(m.created_at)
    const last = dayGroups[dayGroups.length - 1]
    if (last && last.label === label) last.items.push(m)
    else dayGroups.push({ label, items: [m] })
  })

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-2xl w-full max-w-lg shadow-xl flex flex-col overflow-hidden" style={{ height: '640px' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: recipientColor }} />

        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: recipientColor }}
            >
              {getInitials(recipient.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">{recipient.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted truncate">{recipient.team}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink shrink-0 p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t border-line" />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-ink-muted font-mono text-sm">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-ink-muted text-sm text-center py-10">No messages yet. Say hello.</p>
          ) : (
            dayGroups.map((group, gi) => (
              <div key={gi}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-xs text-ink-muted shrink-0">{group.label}</span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                <div className="space-y-3">
                  {group.items.map((m) => {
                    const isMe = m.sender_id === currentUser.id

                    // System-generated messages tied to an action item render
                    // as a tappable card that jumps straight to that item.
                    if (m.item_id) {
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <button
                              type="button"
                              onClick={() => onOpenItem?.(m.item_id, m.target_nav)}
                              className={`text-left rounded-2xl px-4 py-2.5 text-sm border transition-colors w-full ${
                                isMe
                                  ? 'bg-accent-blue/10 border-accent-blue/30 hover:border-accent-blue text-ink rounded-tr-sm'
                                  : 'bg-line/50 border-line hover:border-accent-blue text-ink rounded-tl-sm'
                              }`}
                            >
                              <p>{m.body}</p>
                              <p className="flex items-center gap-1 text-[10px] font-semibold mt-1.5" style={{ color: '#2B6CB0' }}>
                                <TaskLinkIcon className="w-3 h-3" /> View task →
                              </p>
                            </button>
                            <p className="text-[10px] text-ink-muted mt-1">{formatClock(m.created_at)}</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'bg-accent-blue text-white rounded-tr-sm' : 'bg-line text-ink rounded-tl-sm'}`}>
                            {m.body}
                          </div>
                          <p className="text-[10px] text-ink-muted mt-1">{formatClock(m.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 px-5 py-4 border-t border-line shrink-0">
          <input
            className="flex-1 border border-line rounded-full px-4 py-2.5 text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex items-center gap-1.5 bg-accent-blue text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50 shrink-0"
          >
            <SendIcon className="w-3.5 h-3.5" /> Send
          </button>
        </form>
      </div>
    </div>
  )
}     