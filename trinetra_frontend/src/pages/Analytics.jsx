import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  BarChart2, Shield, AlertTriangle, CheckCircle2, HelpCircle, XCircle,
  TrendingUp, Calendar, Trash2, ExternalLink, RefreshCw, Brain,
  Newspaper, Search, ChevronDown, ChevronUp, Activity, Zap, Tag,
  Clock, Link2, FileText, Globe,
} from 'lucide-react'
import { api } from '../api'

const V_COLORS = {
  REAL: '#10B981', LIKELY_REAL: '#34D399',
  UNCERTAIN: '#F59E0B', LIKELY_FAKE: '#F87171', FAKE: '#EF4444',
}
const V_ICONS = {
  REAL: CheckCircle2, LIKELY_REAL: CheckCircle2,
  UNCERTAIN: HelpCircle, LIKELY_FAKE: AlertTriangle, FAKE: XCircle,
}
const V_BG = {
  REAL: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  LIKELY_REAL: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  UNCERTAIN: 'bg-amber-50 border-amber-200 text-amber-700',
  LIKELY_FAKE: 'bg-red-50 border-red-200 text-red-700',
  FAKE: 'bg-red-50 border-red-200 text-red-700',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function scoreColor(s) {
  return s >= 65 ? '#10B981' : s >= 40 ? '#F59E0B' : '#EF4444'
}

function ScoreRing({ score, size = 44 }) {
  const stroke = 5, r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = scoreColor(score)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (score/100)*circ}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}/>
    </svg>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`}/>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  )
}

function HistoryCard({ item, onDelete, deleting }) {
  const [open, setOpen] = useState(false)
  const VIcon = V_ICONS[item.verdict] || HelpCircle
  const color = scoreColor(item.trust_score || 0)
  const badgeClass = V_BG[item.verdict] || 'bg-slate-100 border-slate-200 text-slate-600'
  const isUrl = item.input_text?.startsWith('[URL]') || !!item.input_url

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Score ring */}
        <div className="relative flex-shrink-0">
          <ScoreRing score={item.trust_score || 0} size={48}/>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
            {item.trust_score}
          </span>
        </div>

        {/* Content preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {isUrl
              ? <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0"/>
              : <FileText className="w-3 h-3 text-slate-400 flex-shrink-0"/>}
            <p className="text-sm text-slate-700 font-medium truncate">
              {item.input_url
                ? item.input_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)
                : item.input_text?.slice(0, 90)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
              <VIcon className="w-3 h-3"/>
              {(item.verdict_label || item.verdict || '').replace('_', ' ')}
            </span>
            {item.input_mode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {item.input_mode === 'claim' ? '🔍 Fact-check' : '📰 Article'}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3"/>{fmtDate(item.analyzed_at)} {fmtTime(item.analyzed_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.input_url && (
            <a href={item.input_url} target="_blank" rel="noopener noreferrer"
               className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
              <ExternalLink className="w-3.5 h-3.5"/>
            </a>
          )}
          <button onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            {open ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
          </button>
          <button onClick={() => onDelete(item.id)} disabled={deleting === item.id}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
          {/* Score breakdown bar */}
          {item.gemini_score != null && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Score Breakdown</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24 flex-shrink-0">Gemini AI</span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.gemini_score}%`, backgroundColor: scoreColor(item.gemini_score) }}/>
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color: scoreColor(item.gemini_score) }}>
                  {item.gemini_score}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-slate-500 w-24 flex-shrink-0">Final Score</span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.trust_score}%`, backgroundColor: color }}/>
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color }}>{item.trust_score}</span>
              </div>
            </div>
          )}

          {/* Reasoning */}
          {item.reasoning && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">AI Reasoning</p>
              <p className="text-xs text-slate-600 leading-relaxed bg-white rounded-xl p-3 border border-slate-100">
                {item.reasoning}
              </p>
            </div>
          )}

          {/* Key claims + Red flags side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.key_claims?.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-400"/> Key Claims
                </p>
                <ul className="space-y-1">
                  {item.key_claims.filter(Boolean).map((c, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i+1}</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.red_flags?.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-red-100">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3"/> Red Flags
                </p>
                <ul className="space-y-1">
                  {item.red_flags.filter(Boolean).map((f, i) => (
                    <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5"/>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sources checked */}
          {item.sources_checked?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Globe className="w-3 h-3"/> Sources Checked
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.sources_checked.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source analysis */}
          {item.source_analysis && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source Analysis</p>
              <p className="text-xs text-slate-500 leading-relaxed">{item.source_analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  const fetchHistory = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/history/')
      setHistory(data.results || [])
    } catch { setError('Could not load history.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await api.delete(`/history/${id}/`); setHistory(h => h.filter(x => x.id !== id)) }
    catch {}
    finally { setDeleting(null) }
  }

  // Filtered list
  const filtered = history.filter(h => {
    const matchSearch = !search ||
      h.input_text?.toLowerCase().includes(search.toLowerCase()) ||
      h.input_url?.toLowerCase().includes(search.toLowerCase()) ||
      h.reasoning?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'ALL' ||
      (filter === 'REAL' && (h.verdict === 'REAL' || h.verdict === 'LIKELY_REAL')) ||
      (filter === 'FAKE' && (h.verdict === 'FAKE' || h.verdict === 'LIKELY_FAKE')) ||
      filter === h.verdict
    return matchSearch && matchFilter
  })

  // Stats
  const total = history.length
  const realCount = history.filter(h => h.verdict === 'REAL' || h.verdict === 'LIKELY_REAL').length
  const fakeCount = history.filter(h => h.verdict === 'FAKE' || h.verdict === 'LIKELY_FAKE').length
  const avgScore = total ? Math.round(history.reduce((s, h) => s + (h.trust_score || 0), 0) / total) : 0

  // Pie
  const verdictGroups = {}
  history.forEach(h => { verdictGroups[h.verdict] = (verdictGroups[h.verdict] || 0) + 1 })
  const pieData = Object.entries(verdictGroups).map(([v, c]) => ({
    name: v.replace('_', ' '), value: c, color: V_COLORS[v] || '#94A3B8',
  }))

  // Timeline (last 20)
  const timelineData = [...history].reverse().slice(-20).map((h, i) => ({
    i: i + 1, score: h.trust_score, date: fmtDate(h.analyzed_at),
  }))

  // Score buckets
  const buckets = { '0–20': 0, '21–40': 0, '41–60': 0, '61–80': 0, '81–100': 0 }
  history.forEach(h => {
    const s = h.trust_score || 0
    if (s <= 20) buckets['0–20']++
    else if (s <= 40) buckets['21–40']++
    else if (s <= 60) buckets['41–60']++
    else if (s <= 80) buckets['61–80']++
    else buckets['81–100']++
  })
  const distData = Object.entries(buckets).map(([range, count]) => ({ range, count }))

  // Daily 7-day
  const dailyMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })
    dailyMap[k] = { date: k, real: 0, fake: 0, uncertain: 0 }
  }
  history.forEach(h => {
    const k = new Date(h.analyzed_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })
    if (dailyMap[k]) {
      if (h.verdict === 'REAL' || h.verdict === 'LIKELY_REAL') dailyMap[k].real++
      else if (h.verdict === 'FAKE' || h.verdict === 'LIKELY_FAKE') dailyMap[k].fake++
      else dailyMap[k].uncertain++
    }
  })
  const dailyData = Object.values(dailyMap)

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
      <p className="text-slate-400 text-sm">Loading analytics…</p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-500"/> Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Track and trace every news verification you've run</p>
        </div>
        <button onClick={fetchHistory} id="refresh-analytics-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all">
          <RefreshCw className="w-4 h-4"/> Refresh
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}     label="Total Analyses"    value={total}           sub="All time"                                          color="text-blue-500"    bg="bg-blue-50"/>
        <StatCard icon={CheckCircle2} label="Real / Likely Real" value={realCount}       sub={`${total ? Math.round(realCount/total*100) : 0}%`} color="text-emerald-500" bg="bg-emerald-50"/>
        <StatCard icon={XCircle}      label="Fake / Likely Fake" value={fakeCount}       sub={`${total ? Math.round(fakeCount/total*100) : 0}%`} color="text-red-500"     bg="bg-red-50"/>
        <StatCard icon={TrendingUp}   label="Avg Trust Score"   value={`${avgScore}/100`} sub="Across all checks"                               color="text-purple-500"  bg="bg-purple-50"/>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <Brain className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
          <h3 className="text-slate-500 font-semibold">No analyses yet</h3>
          <p className="text-slate-400 text-sm mt-1">Go to Trinetra AI and analyze some news to see data here.</p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Pie */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-semibold text-sm mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500"/> Verdict Distribution
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center">
                {pieData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }}/>
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>

            {/* Score dist */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-semibold text-sm mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500"/> Score Distribution
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distData} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94A3B8' }}/>
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="count" name="Articles" radius={[5,5,0,0]}>
                    {distData.map((_, i) => (
                      <Cell key={i} fill={['#EF4444','#F87171','#F59E0B','#34D399','#10B981'][i]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily stacked */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-semibold text-sm mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-500"/> Daily Activity
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} barSize={14} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }}/>
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend wrapperStyle={{ fontSize: '10px' }}/>
                  <Bar dataKey="real"      name="Real"      stackId="a" fill="#10B981"/>
                  <Bar dataKey="uncertain" name="Uncertain" stackId="a" fill="#F59E0B"/>
                  <Bar dataKey="fake"      name="Fake"      stackId="a" fill="#EF4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-slate-700 font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500"/> Trust Score Timeline (last {timelineData.length})
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#94A3B8' }}
                  label={{ value: 'Analysis #', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94A3B8' }}/>
                <YAxis domain={[0,100]} tick={{ fontSize: 10, fill: '#94A3B8' }}/>
                <Tooltip content={<Tip/>}/>
                <Line type="monotone" dataKey="score" name="Trust Score" stroke="#3B82F6" strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 6 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* History list */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-slate-400"/> Analysis History
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{filtered.length}</span>
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 w-44"/>
                </div>
                {/* Filter pills */}
                {['ALL','REAL','FAKE','UNCERTAIN'].map(v => (
                  <button key={v} onClick={() => setFilter(v)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${
                      filter === v
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2"/>
                <p className="text-slate-400 text-sm">No matching analyses found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(h => (
                  <HistoryCard key={h.id} item={h} onDelete={handleDelete} deleting={deleting}/>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
