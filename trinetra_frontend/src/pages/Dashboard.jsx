import { useState, useEffect, useCallback } from 'react'
import { Globe, Flag, Trophy, Clapperboard, Cpu, Heart, RefreshCw, AlertCircle, Wifi } from 'lucide-react'
import { api } from '../api'
import NewsCard from '../components/NewsCard'

const CATEGORIES = [
  { id: 'india', label: 'India', icon: Flag },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard },
  { id: 'tech', label: 'Tech', icon: Cpu },
  { id: 'health', label: 'Health', icon: Heart },
]

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-48 bg-slate-200" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-full" />
        <div className="h-4 bg-slate-200 rounded w-5/6" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeCategory, setActiveCategory] = useState('india')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchNews = useCallback(async (category) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/news/?category=${category}`)
      setArticles(data.articles || [])
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error
      if (err.response?.status === 503) {
        setError('GNews API key not configured. Add your key to trinetra_backend/.env to load live news.')
      } else if (!err.response) {
        setError('Cannot reach backend. Make sure Django is running on port 8000.')
      } else {
        setError(msg || 'Failed to load news. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNews(activeCategory) }, [activeCategory, fetchNews])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">News Feed</h1>
        <p className="text-slate-500 mt-1">Live news from verified, top-tier journalistic sources</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-8 scrollbar-hide">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              activeCategory === id
                ? 'bg-navy-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-600 hover:text-navy-600'
            }`}
            id={`tab-${id}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <button
          onClick={() => fetchNews(activeCategory)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 flex-shrink-0 transition-all"
          aria-label="Refresh news"
          id="refresh-news-btn"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-700 font-semibold text-sm">News Unavailable</p>
            <p className="text-amber-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.length > 0
            ? articles.map((article, i) => <NewsCard key={`${article.url}-${i}`} article={article} />)
            : !error && (
              <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center">
                <Wifi className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-slate-500 font-semibold">No articles found</h3>
                <p className="text-slate-400 text-sm mt-1">Try a different category or refresh the feed.</p>
              </div>
            )
        }
      </div>
    </div>
  )
}
