import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function RankBadge({ rank }) {
  return (
    <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center font-mono text-sm font-bold shrink-0">
      {String(rank).padStart(2, '0')}
    </div>
  )
}

export default function SemiconductorPulse() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState(null)

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-accent-blue mb-1">Industry Pulse</p>
          <h2 className="text-2xl font-semibold text-ink">Top 10 in Semiconductors Today</h2>
          {lastFetched && (
            <p className="text-sm text-ink-muted mt-1">Updated {formatDate(lastFetched)}</p>
          )}
        </div>
        <button
          onClick={loadNews}
          className="font-mono text-[11px] uppercase tracking-wider border border-line rounded-md px-3 py-2 text-ink-muted hover:text-ink transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-ink-muted font-mono text-sm">Loading today's stories…</p>
      ) : error ? (
        <div className="bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-lg p-3 text-sm font-mono">{error}</div>
      ) : news.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center bg-surface">
          <p className="text-ink font-medium">No stories cached yet.</p>
          <p className="text-ink-muted text-sm mt-1">The daily feed refreshes automatically — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((n) => (
            
              <a key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-4 bg-surface border border-line rounded-xl p-4 shadow-sm hover:shadow-md hover:border-accent-blue/40 transition-all"
            >
              <RankBadge rank={n.rank} />
              {n.image_url && (
                <img src={n.image_url} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 hidden sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink leading-snug">{n.title}</p>
                {n.summary && <p className="text-sm text-ink-muted mt-1 line-clamp-2">{n.summary}</p>}
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mt-2">
                  {n.source} {n.published_at && `· ${formatDate(n.published_at)}`}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}           