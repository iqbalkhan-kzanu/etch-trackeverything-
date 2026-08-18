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
function formatCreatedDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function XIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>)
}
function MessagesTabIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>)
}
function MembersTabIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
}
function SendIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M11 13 22 2" /></svg>)
}
function PlusIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>)
}

export default function GroupChatModal({ currentUser, group, profiles, onClose, onRead }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('messages') // 'messages' | 'members'
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addSelected, setAddSelected] = useState({})
  const [addingMembers, setAddingMembers] = useState(false)
  const [addError, setAddError] = useState('')
  const bottomRef = useRef(null)
  const lastMessageIdRef = useRef(null)

  const groupColor = colorFromId(group.id)
  const creatorProfile = (profiles || []).find((p) => p.id === group.created_by)

  async function markRead() {
    await supabase
      .from('chat_group_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('group_id', group.id)
      .eq('user_id', currentUser.id)
    onRead?.()
  }

  // `silent` = background poll. Only touch state (and therefore the
  // scroll-to-bottom effect) when the last message actually changed, so a
  // poll with nothing new doesn't snap the view back to the bottom.
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

  // Group messages into date buckets for the "Today, Aug 17" style dividers.
  const dayGroups = []
  messages.forEach((m) => {
    const label = formatDayLabel(m.created_at)
    const last = dayGroups[dayGroups.length - 1]
    if (last && last.label === label) last.items.push(m)
    else dayGroups.push({ label, items: [m] })
  })

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="relative bg-surface border border-line rounded-2xl w-full max-w-lg shadow-xl flex flex-col overflow-hidden" style={{ height: '680px' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: groupColor }} />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
              style={{ backgroundColor: groupColor }}
            >
              {getInitials(group.name)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-ink truncate">{group.name}</p>
              <p className="text-xs text-ink-muted truncate">
                {members.length} Member{members.length === 1 ? '' : 's'}
                {creatorProfile && <> · Created by {creatorProfile.name}</>}
                {group.created_at && <> · {formatCreatedDate(group.created_at)}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink shrink-0 p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 border-b border-line shrink-0">
          <button
            onClick={() => setTab('messages')}
            className={`flex items-center gap-1.5 text-sm font-medium pb-3 border-b-2 transition-colors ${
              tab === 'messages' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <MessagesTabIcon className="w-4 h-4" /> Messages
          </button>
          <button
            onClick={() => { setTab('members'); setShowAdd(false) }}
            className={`flex items-center gap-1.5 text-sm font-medium pb-3 border-b-2 transition-colors ${
              tab === 'members' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <MembersTabIcon className="w-4 h-4" /> Members ({members.length})
          </button>
        </div>

        {tab === 'members' ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-ink text-sm">Group Members</p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
              >
                <PlusIcon className="w-3.5 h-3.5" /> {showAdd ? 'Cancel' : 'Add'}
              </button>
            </div>

            {showAdd && (
              <div className="mb-5 border border-line rounded-lg p-3 bg-canvas">
                <input
                  autoFocus
                  className="w-full border border-line rounded-md p-2 text-sm mb-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                  placeholder="Search people…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto space-y-1 mb-2">
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
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {members.map((m) => {
                const isAdmin = m.user_id === group.created_by
                const color = colorFromId(m.user_id)
                return (
                  <div key={m.user_id} className="flex flex-col items-center text-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2"
                      style={{ backgroundColor: color }}
                    >
                      {getInitials(m.profiles?.name)}
                    </div>
                    <p className="text-sm font-medium text-ink truncate max-w-full">
                      {m.profiles?.name || 'Unknown'}{m.user_id === currentUser.id && ' (You)'}
                    </p>
                    <span className={`mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${isAdmin ? 'bg-accent-blue/10 text-accent-blue' : 'bg-line text-ink-muted'}`}>
                      {isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <p className="text-ink-muted font-mono text-sm">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-ink-muted text-sm text-center py-10">No messages yet. Say hello.</p>
              ) : (
                dayGroups.map((group_, gi) => (
                  <div key={gi}>
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-line" />
                      <span className="text-xs text-ink-muted shrink-0">{group_.label}</span>
                      <div className="flex-1 h-px bg-line" />
                    </div>
                    <div className="space-y-4">
                      {group_.items.map((m) => {
                        const isMe = m.sender_id === currentUser.id
                        const color = colorFromId(m.sender_id)
                        return (
                          <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            {!isMe && (
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                {getInitials(m.profiles?.name)}
                              </div>
                            )}
                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                              {!isMe && (
                                <p className="text-xs font-medium mb-1" style={{ color }}>{m.profiles?.name || 'Unknown'}</p>
                              )}
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
                placeholder="Message the group…"
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
          </>
        )}
      </div>
    </div>
  )
}       