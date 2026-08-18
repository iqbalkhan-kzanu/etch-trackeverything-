import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GroupChatModal({ currentUser, group, profiles, onClose, onRead }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addSelected, setAddSelected] = useState({})
  const [addingMembers, setAddingMembers] = useState(false)
  const [addError, setAddError] = useState('')
  const bottomRef = useRef(null)
  const lastMessageIdRef = useRef(null)

  async function markRead() {
    await supabase
      .from('chat_group_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('group_id', group.id)
      .eq('user_id', currentUser.id)
    onRead?.()
  }

  // `silent` = background poll. We only touch state (and therefore the
  // scroll-to-bottom effect) when the last message actually changed —
  // otherwise every 4s poll was snapping the view back down even when
  // nothing new had arrived. That was the "blinking" bug.
  async function loadMessages({ silent = false } = {}) {
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles:sender_id(name)')
      .eq('group_id', group.id)
      .order('created_at', { ascending: true })

    const list = data || []
    const newLastId = list.length ? list[list.length - 1].id : null

    if (!silent || newLastId !== lastMessageIdRef.current) {
      setMessages(list)
      lastMessageIdRef.current = newLastId
    }
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('chat_group_members')
      .select('user_id, profiles:user_id(name, team)')
      .eq('group_id', group.id)
    setMembers(data || [])
  }

  async function initialLoad() {
    setLoading(true)
    await Promise.all([loadMessages(), loadMembers()])
    setLoading(false)
    markRead()
  }

  useEffect(() => {
    initialLoad()
    const interval = setInterval(() => loadMessages({ silent: true }), 4000)
    return () => clearInterval(interval)
  }, [group.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const { error } = await supabase.from('group_messages').insert([{
      group_id: group.id, sender_id: currentUser.id, body: text.trim(),
    }])
    setSending(false)
    if (!error) {
      setText('')
      await loadMessages()
      markRead()
    }
  }

  const memberIds = new Set(members.map((m) => m.user_id))
  const addCandidates = (profiles || [])
    .filter((p) => p.id !== currentUser.id && !memberIds.has(p.id))
    .filter((p) => p.name?.toLowerCase().includes(addSearch.toLowerCase().trim()))

  function toggleAddSelect(id) {
    setAddSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleAddMembers() {
    const ids = Object.keys(addSelected).filter((id) => addSelected[id])
    if (ids.length === 0) return
    setAddingMembers(true)
    setAddError('')
    const rows = ids.map((id) => ({ group_id: group.id, user_id: id }))
    const { error } = await supabase.from('chat_group_members').insert(rows)
    setAddingMembers(false)
    if (error) { setAddError(error.message); return }
    setAddSelected({})
    setAddSearch('')
    setShowAdd(false)
    loadMembers()
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-xl w-full max-w-md shadow-xl flex flex-col overflow-hidden" style={{ height: '640px' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">{group.name}</p>
            <button
              onClick={() => { setShowMembers((s) => !s); setShowAdd(false) }}
              className="font-mono text-[11px] uppercase tracking-wider text-ink-muted hover:text-accent-blue transition-colors"
            >
              {members.length} member{members.length === 1 ? '' : 's'} · {showMembers ? 'Hide' : 'View'}
            </button>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink font-mono text-sm shrink-0">✕</button>
        </div>

        {showMembers && (
          <div className="border-b border-line shrink-0 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-2 sticky top-0 bg-surface z-10">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">In this group</p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="font-mono text-[10px] uppercase tracking-wider text-accent-blue hover:underline"
              >
                {showAdd ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showAdd ? (
              <div className="px-5 pb-3">
                <input
                  autoFocus
                  className="w-full border border-line rounded-md p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                  placeholder="Search people…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
                  {addCandidates.length === 0 ? (
                    <p className="text-xs text-ink-muted py-2">No matches.</p>
                  ) : (
                    addCandidates.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-line/40 cursor-pointer">
                        <input type="checkbox" checked={!!addSelected[p.id]} onChange={() => toggleAddSelect(p.id)} />
                        <span className="text-sm text-ink truncate">{p.name}</span>
                        <span className="font-mono text-[10px] text-ink-muted ml-auto shrink-0">{p.team}</span>
                      </label>
                    ))
                  )}
                </div>
                {addError && <p className="text-xs text-accent-red mb-2">{addError}</p>}
                <button
                  onClick={handleAddMembers}
                  disabled={addingMembers || Object.values(addSelected).every((v) => !v)}
                  className="w-full bg-accent-blue text-white text-xs font-medium py-2 rounded-md hover:bg-accent-blue/90 disabled:opacity-50"
                >
                  {addingMembers ? 'Adding…' : 'Add selected'}
                </button>
              </div>
            ) : (
              <div className="px-5 pb-3 space-y-1">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-ink truncate">
                      {m.profiles?.name || 'Unknown'} {m.user_id === currentUser.id && <span className="text-ink-muted">(You)</span>}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted shrink-0">{m.profiles?.team}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                    {!isMe && <p className="text-[10px] font-mono uppercase tracking-wider opacity-60 mb-0.5">{m.profiles?.name || 'Unknown'}</p>}
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
            placeholder="Message the group…"
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