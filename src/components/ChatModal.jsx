import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ChatModal({ currentUser, recipient, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [recipient.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl w-full max-w-md shadow-xl flex flex-col overflow-hidden" style={{ height: '600px' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div>
            <p className="font-semibold text-ink">{recipient.name}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{recipient.team}</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink font-mono text-sm">✕</button>
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
                    {m.body}
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