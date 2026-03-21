import { useState, useEffect } from 'react'
import { User, Mail, Calendar, Shield, Clock, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const VERDICT_CONFIG = {
  REAL: { label: 'Real', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  LIKELY_REAL: { label: 'Likely Real', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  UNCERTAIN: { label: 'Uncertain', color: 'text-amber-600', bg: 'bg-amber-100', icon: HelpCircle },
  LIKELY_FAKE: { label: 'Likely Fake', color: 'text-red-500', bg: 'bg-red-100', icon: AlertTriangle },
  FAKE: { label: 'Fake', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
}

function timeAgo(dateString) {
  const now = new Date()
  const then = new Date(dateString)
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Profile() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/history/')
        setHistory(data.results || [])
      } catch {
        setHistory([])
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/history/${id}/`)
      setHistory(prev => prev.filter(h => h.id !== id))
    } catch { /* silent */ }
  }

  const stats = {
    total: history.length,
    real: history.filter(h => ['REAL', 'LIKELY_REAL'].includes(h.verdict)).length,
    fake: history.filter(h => ['FAKE', 'LIKELY_FAKE'].includes(h.verdict)).length,
    avgScore: history.length ? Math.round(history.reduce((s, h) => s + h.trust_score, 0) / history.length) : '-',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-navy-900 flex items-center justify-center overflow-hidden shadow-glow flex-shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
              : <span className="text-white text-3xl font-bold">{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 truncate">{user?.full_name || 'Trinetra User'}</h1>
            <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
              <Mail className="w-4 h-4" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>Member since {user?.date_joined ? new Date(user.date_joined).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : '—'}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-trinetra-blue/10 rounded-xl border border-trinetra-blue/20">
            <Shield className="w-4 h-4 text-trinetra-blue" />
            <span className="text-trinetra-blue text-sm font-semibold">Verified User</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Analyses', value: stats.total, icon: Shield, color: 'text-trinetra-blue', bg: 'bg-blue-50' },
          { label: 'Avg Trust Score', value: stats.avgScore, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Flagged Real', value: stats.real, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Flagged Fake', value: stats.fake, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Analysis History */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Analysis History</h2>
          <span className="badge bg-slate-100 text-slate-600">{history.length} records</span>
        </div>

        {loadingHistory ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No analyses yet</p>
            <p className="text-slate-400 text-sm">Head to the Trinetra AI page to start verifying news.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {history.map((item) => {
              const vc = VERDICT_CONFIG[item.verdict] || VERDICT_CONFIG.UNCERTAIN
              const VIcon = vc.icon
              return (
                <div key={item.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
                  <div className={`w-10 h-10 rounded-xl ${vc.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <VIcon className={`w-5 h-5 ${vc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-sm font-medium line-clamp-2 leading-snug">
                      {item.input_text?.startsWith('[URL]')
                        ? <span className="text-trinetra-blue">{item.input_text}</span>
                        : item.input_text?.slice(0, 120) + (item.input_text?.length > 120 ? '…' : '')}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`badge ${vc.bg} ${vc.color} text-xs`}>{vc.label}</span>
                      <span className="text-xs text-slate-400">Trust Score: <strong className="text-slate-600">{item.trust_score}</strong></span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />{timeAgo(item.analyzed_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                    aria-label="Delete analysis"
                    id={`delete-history-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
