import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// Expanded palette (14 vs original 7) so distinct people don't collide on
// color once a team grows past a handful of members.
const AVATAR_PALETTE = [
  '#2B6CB0', '#7C5CBF', '#2F8F5B', '#D98C2B', '#C1443C',
  '#1F9E9E', '#C15A9E', '#3D7A5C', '#8B5CF6', '#0EA5A5',
  '#DB6E44', '#4C6EF5', '#B0447C', '#5B8C3E',
]
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

// Small helper: given a base hex color, return a lighter tint for avatar
// rings / gradient stops without needing a color library.
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, ((n >> 16) & 255) + amount)
  const g = Math.min(255, ((n >> 8) & 255) + amount)
  const b = Math.min(255, (n & 255) + amount)
  return `rgb(${r}, ${g}, ${b})`
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
function SpinnerIcon({ className }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
function ChatEmptyIcon({ className }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>)
}

// A single avatar circle with a soft ring in a lighter tone of its own
// color, rather than a flat solid disc — this is what makes a wall of
// avatars read as "designed" instead of "div, repeated."
function Avatar({ id, name, size = 'md' }) {
  const color = colorFromId(id)
  const ring = lighten(color, 60)
  const dims = { sm: 'w-9 h-9 text-[11px]', md: 'w-12 h-12 text-sm', lg: 'w-14 h-14 text-sm' }[size]
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center text-white font-bold shrink-0 relative`}
      style={{
        background: `linear-gradient(135deg, ${color}, ${lighten(color, -20)})`,
        boxShadow: `0 0 0 2px ${ring}55, 0 2px 6px rgba(0,0,0,0.18)`,
      }}
    >
      {getInitials(name)}
    </div>
  )
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
  const groupColorLight = lighten(groupColor, 55)
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

  const selectedCount = Object.values(addSelected).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <style>{`
        @keyframes gcm-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gcm-panel-in {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 240px; }
        }
        .gcm-msg-in { animation: gcm-msg-in 0.28s ease both; }
        .gcm-panel-in { animation: gcm-panel-in 0.24s ease both; overflow: hidden; }
        .gcm-row-hover { transition: background-color 0.15s ease, transform 0.15s ease; }
        .gcm-row-hover:hover { transform: translateX(1px); }
      `}</style>

      <div
        className="relative bg-surface border border-line/70 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          height: '680px',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.35), 0 8px 24px -8px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header — soft gradient wash behind, not just a 1px accent bar */}
        <div
          className="relative px-6 pt-6 pb-4 shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(180deg, ${groupColorLight}35, transparent)` }}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${groupColor}, ${lighten(groupColor, 40)})` }} />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar id={group.id} name={group.name} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink truncate tracking-tight">{group.name}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {members.length} Member{members.length === 1 ? '' : 's'}
                  {creatorProfile && <> · Created by {creatorProfile.name}</>}
                  {group.created_at && <> · {formatCreatedDate(group.created_at)}</>}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink hover:bg-line/60 shrink-0 p-1.5 rounded-full transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs — active tab gets a filled pill background, not just an underline */}
        <div className="flex items-center gap-2 px-5 pb-2 border-b border-line shrink-0">
          <button
            onClick={() => setTab('messages')}
            className={`flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors ${
              tab === 'messages' ? 'bg-accent-blue/12 text-accent-blue' : 'text-ink-muted hover:text-ink hover:bg-line/50'
            }`}
          >
            <MessagesTabIcon className="w-4 h-4" /> Messages
          </button>
          <button
            onClick={() => { setTab('members'); setShowAdd(false) }}
            className={`flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors ${
              tab === 'members' ? 'bg-accent-blue/12 text-accent-blue' : 'text-ink-muted hover:text-ink hover:bg-line/50'
            }`}
          >
            <MembersTabIcon className="w-4 h-4" /> Members
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${tab === 'members' ? 'bg-accent-blue/20' : 'bg-line'}`}>
              {members.length}
            </span>
          </button>
        </div>

        {tab === 'members' ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-ink text-sm tracking-tight">Group Members</p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:bg-accent-blue/10 px-2.5 py-1.5 rounded-md transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> {showAdd ? 'Cancel' : 'Add'}
              </button>
            </div>

            {showAdd && (
              <div className="gcm-panel-in mb-5 border border-line rounded-xl p-3.5 bg-canvas shadow-sm">
                <input
                  autoFocus
                  className="w-full border border-line rounded-lg p-2.5 text-sm mb-2.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue"
                  placeholder="Search people…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto space-y-0.5 mb-2.5">
                  {addCandidates.length === 0 ? (
                    <p className="text-xs text-ink-muted py-2 text-center">No matches.</p>
                  ) : (
                    addCandidates.map((p) => (
                      <label key={p.id} className="gcm-row-hover flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-line/50 cursor-pointer">
                        <input type="checkbox" checked={!!addSelected[p.id]} onChange={() => toggleAddSelect(p.id)} className="accent-accent-blue" />
                        <span className="text-sm text-ink truncate">{p.name}</span>
                        <span className="font-mono text-[10px] text-ink-muted ml-auto shrink-0 bg-line px-1.5 py-0.5 rounded">{p.team}</span>
                      </label>
                    ))
                  )}
                </div>
                {addError && <p className="text-xs text-accent-red mb-2 bg-accent-red/10 border border-accent-red/20 rounded-md px-2 py-1.5">{addError}</p>}
                <button
                  onClick={handleAddMembers}
                  disabled={addingMembers || selectedCount === 0}
                  className="w-full bg-accent-blue text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-accent-blue/90 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  {addingMembers ? <><SpinnerIcon className="w-3.5 h-3.5" /> Adding…</> : `Add${selectedCount > 0 ? ` ${selectedCount} selected` : ' selected'}`}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-5">
              {members.map((m) => {
                const isAdmin = m.user_id === group.created_by
                return (
                  <div key={m.user_id} className="gcm-row-hover flex flex-col items-center text-center rounded-xl py-2 hover:bg-line/30">
                    <Avatar id={m.user_id} name={m.profiles?.name} size="lg" />
                    <p className="text-sm font-medium text-ink truncate max-w-full mt-2">
                      {m.profiles?.name || 'Unknown'}{m.user_id === currentUser.id && ' (You)'}
                    </p>
                    <span className={`mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-accent-blue/12 text-accent-blue' : 'bg-line text-ink-muted'}`}>
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
                <div className="space-y-4 pt-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                      <div className="w-9 h-9 rounded-full bg-line animate-pulse shrink-0" />
                      <div className={`h-10 rounded-2xl bg-line animate-pulse ${i % 2 === 0 ? 'w-40' : 'w-56'}`} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${groupColor}18`, color: groupColor }}
                  >
                    <ChatEmptyIcon className="w-7 h-7" />
                  </div>
                  <p className="text-ink font-medium text-sm">No messages yet</p>
                  <p className="text-ink-muted text-xs mt-1">Be the first to say hello to the group.</p>
                </div>
              ) : (
                dayGroups.map((group_, gi) => (
                  <div key={gi}>
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-line" />
                      <span className="text-[11px] font-medium text-ink-muted shrink-0 bg-canvas px-2 py-0.5 rounded-full border border-line">{group_.label}</span>
                      <div className="flex-1 h-px bg-line" />
                    </div>
                    <div className="space-y-4">
                      {group_.items.map((m) => {
                        const isMe = m.sender_id === currentUser.id
                        const color = colorFromId(m.sender_id)
                        return (
                          <div key={m.id} className={`gcm-msg-in flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            {!isMe && <Avatar id={m.sender_id} name={m.profiles?.name} size="sm" />}
                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                              {!isMe && (
                                <p className="text-xs font-semibold mb-1" style={{ color }}>{m.profiles?.name || 'Unknown'}</p>
                              )}
                              <div
                                className={`px-4 py-2.5 text-sm leading-relaxed ${isMe ? 'text-white rounded-2xl rounded-tr-md' : 'text-ink rounded-2xl rounded-tl-md border border-line'}`}
                                style={
                                  isMe
                                    ? { background: `linear-gradient(135deg, var(--tw-color-accent-blue, #2B6CB0), ${lighten('#2B6CB0', -25)})`, boxShadow: '0 2px 8px -2px rgba(43,108,176,0.4)' }
                                    : { backgroundColor: 'var(--tw-color-surface, #fff)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                                }
                              >
                                {m.body}
                              </div>
                              <p className="text-[10px] text-ink-muted mt-1 px-1">{formatClock(m.created_at)}</p>
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

            <form onSubmit={handleSend} className="flex items-center gap-2 px-5 py-4 border-t border-line shrink-0 bg-canvas/40">
              <input
                className="flex-1 border border-line rounded-full px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue transition-shadow"
                placeholder="Message the group…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="flex items-center gap-1.5 bg-accent-blue text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50 shrink-0 shadow-sm transition-all"
              >
                {sending ? <SpinnerIcon className="w-3.5 h-3.5" /> : <SendIcon className="w-3.5 h-3.5" />}
                {sending ? 'Sending' : 'Send'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}   