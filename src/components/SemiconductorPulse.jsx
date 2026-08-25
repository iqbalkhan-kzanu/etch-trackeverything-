import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const RANK_GRADIENTS = [
  'linear-gradient(135deg, #2B6CB0, #1F9E9E)',
  'linear-gradient(135deg, #7C5CBF, #2B6CB0)',
  'linear-gradient(135deg, #2B6CB0, #2F8F5B)',
  'linear-gradient(135deg, #C1443C, #D9A824)',
  'linear-gradient(135deg, #1F9E9E, #2F8F5B)',
  'linear-gradient(135deg, #D9A824, #C1443C)',
  'linear-gradient(135deg, #7C5CBF, #C15A9E)',
  'linear-gradient(135deg, #2F8F5B, #1F9E9E)',
  'linear-gradient(135deg, #C15A9E, #7C5CBF)',
  'linear-gradient(135deg, #2B6CB0, #7C5CBF)',
]

const BOOKMARK_KEY = 'etch_pulse_bookmarks'

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function loadBookmarks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function BookmarkIcon({ filled, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function RefreshIcon({ className, spinning }) {
  return (
    <svg className={`${className} ${spinning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
    </svg>
  )
}

function ChipGraphic() {
  return (
    <svg viewBox="0 0 160 160" className="w-full h-full opacity-90">
      <rect x="40" y="40" width="80" height="80" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <rect x="55" y="55" width="50" height="50" rx="4" fill="rgba(43,108,176,0.4)" stroke="rgba(43,108,176,0.7)" strokeWidth="1" />
      {Array.from({ length: 6 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={52 + i * 11} x2={40} y2={52 + i * 11} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <line x1={120} y1={52 + i * 11} x2={160} y2={52 + i * 11} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <line x1={52 + i * 11} y1={0} x2={52 + i * 11} y2={40} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <line x1={52 + i * 11} y1={120} x2={52 + i * 11} y2={160} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
}

function StoryCard({ n, rank, bookmarked, onToggleBookmark }) {
  return (
    <a
      href={n.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex gap-0 bg-surface border border-line rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-accent-blue/30 transition-all duration-200 h-full"
    >
      <div
        className="w-14 sm:w-16 shrink-0 flex items-center justify-center text-white font-mono text-xl font-bold"
        style={{ background: RANK_GRADIENTS[(rank - 1) % RANK_GRADIENTS.length] }}
      >
        {String(rank).padStart(2, '0')}
      </div>

      {n.image_url ? (
        <div className="w-24 sm:w-28 shrink-0 hidden sm:block overflow-hidden">
          <img
            src={n.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 p-4 flex flex-col justify-center">
        <p className="font-semibold text-ink leading-snug group-hover:text-accent-blue transition-colors pr-8">{n.title}</p>
        {n.summary && <p className="text-sm text-ink-muted mt-1.5 line-clamp-2">{n.summary}</p>}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-accent-blue">{n.source}</span>
          {n.published_at && (
            <>
              <span className="w-1 h-1 rounded-full bg-ink-muted/50" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{formatDate(n.published_at)}</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark(n.id) }}
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
          bookmarked ? 'bg-accent-amber/10 border-accent-amber text-accent-amber' : 'border-line text-ink-muted hover:text-accent-amber hover:border-accent-amber bg-surface'
        }`}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
      >
        <BookmarkIcon filled={bookmarked} className="w-3.5 h-3.5" />
      </button>
    </a>
  )
}

export default function SemiconductorPulse() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState(null)
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks())
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)

  async function loadNews() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('semiconductor_news')
      .select('*')
      .order('rank', { ascending: true })
      .limit(10)

    if (error) {
      setError(error.message)
    } else {
      setNews(data || [])
      if (data && data[0]) setLastFetched(data[0].fetched_date)
    }
    setLoading(false)
  }

  useEffect(() => { loadNews() }, [])

  function toggleBookmark(id) {
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const displayed = showBookmarksOnly ? news.filter((n) => bookmarks.has(n.id)) : news

  return (
    <div className="w-full max-w-none">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white p-6 sm:p-10 mb-6 flex items-center justify-between gap-8">
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent-blue">Wafer is the bitcoin of 2026 </p>    
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            What's up <span className="text-white/50 font-normal">Semicon</span>
          </h2>
          <p className="text-sm text-white/50 mt-2">
            {lastFetched ? `Updated ${formatDate(lastFetched)}` : 'Fetching the latest…'} · Your daily pulse of the semiconductor industry
          </p>

          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => setShowBookmarksOnly(false)}
              className={`font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors ${
                !showBookmarksOnly ? 'bg-white text-ink' : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              Top 10
            </button>
            <button
              onClick={() => setShowBookmarksOnly(true)}
              className={`font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                showBookmarksOnly ? 'bg-white text-ink' : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              <BookmarkIcon filled={showBookmarksOnly} className="w-3.5 h-3.5" />
              Bookmarked {bookmarks.size > 0 && `(${bookmarks.size})`}
            </button>
            <button
              onClick={loadNews}
              disabled={loading}
              className="ml-auto font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/15 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshIcon className="w-3.5 h-3.5" spinning={loading} />
              Refresh
            </button>
          </div>
        </div>

        <div className="hidden md:block w-40 h-40 lg:w-52 lg:h-52 shrink-0 opacity-90">
          <ChipGraphic />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-line rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-xl p-4 text-sm font-mono">{error}</div>
      ) : displayed.length === 0 ? (
        <div className="border border-dashed border-line rounded-2xl p-12 text-center bg-surface">
          <p className="text-ink font-medium">
            {showBookmarksOnly ? 'No bookmarks yet.' : 'No stories cached yet.'}
          </p>
          <p className="text-ink-muted text-sm mt-1">
            {showBookmarksOnly ? 'Tap the bookmark icon on a story to save it here.' : 'The daily feed refreshes automatically — check back soon.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((n) => {
            const originalRank = news.findIndex((item) => item.id === n.id) + 1
            return (
              <StoryCard
                key={n.id}
                n={n}
                rank={originalRank || n.rank}
                bookmarked={bookmarks.has(n.id)}
                onToggleBookmark={toggleBookmark}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
     