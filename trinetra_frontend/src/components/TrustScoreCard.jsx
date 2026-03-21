import { useEffect, useRef } from 'react'
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  TrendingUp, Brain, Newspaper, Search, Bot, Globe,
  ExternalLink, CheckCheck, AlertCircle,
} from 'lucide-react'

const VERDICT_CONFIG = {
  REAL:        { label: 'Verified Real', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
  LIKELY_REAL: { label: 'Likely Real',   color: '#34D399', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
  UNCERTAIN:   { label: 'Uncertain',     color: '#F59E0B', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: HelpCircle  },
  LIKELY_FAKE: { label: 'Likely Fake',   color: '#F87171', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: AlertTriangle },
  FAKE:        { label: 'Fake News',     color: '#EF4444', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: XCircle     },
}

const SIZE   = 120
const STROKE = 10
const R      = (SIZE - STROKE) / 2
const CIRC   = 2 * Math.PI * R

// Mini score bar for each source
function SourceBar({ label, score, icon: Icon, iconColor, available, note }) {
  const pct = Math.max(0, Math.min(100, score ?? 50))
  const color = pct >= 70 ? '#10B981' : pct >= 45 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-slate-700 truncate">{label}</span>
          {available === false
            ? <span className="text-xs text-slate-400">{note || 'N/A'}</span>
            : <span className="text-xs font-bold" style={{ color }}>{pct}/100</span>
          }
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          {available !== false && (
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function TrustScoreCard({ result }) {
  const circleRef = useRef(null)
  const config  = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.UNCERTAIN
  const Icon    = config.icon
  const offset  = CIRC - (result.trust_score / 100) * CIRC

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.strokeDashoffset = CIRC
      setTimeout(() => {
        if (circleRef.current) circleRef.current.style.strokeDashoffset = offset
      }, 100)
    }
  }, [offset])

  const hasFacts   = result.fact_checks?.length > 0
  const hasNews    = result.news_sources?.length > 0
  const hasMultiSrc = (result.sources_checked?.length ?? 0) > 1

  return (
    <div className="space-y-5 animate-slide-up">

      {/* ── Main verdict card ─────────────────────────────────── */}
      <div className={`card p-6 border-2 ${config.border} ${config.bg}`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Ring */}
          <div className="flex-shrink-0">
            <svg width={SIZE} height={SIZE} className="transform -rotate-90">
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#E2E8F0" strokeWidth={STROKE} />
              <circle
                ref={circleRef}
                cx={SIZE/2} cy={SIZE/2} r={R}
                fill="none" stroke={config.color}
                strokeWidth={STROKE} strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC}
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            <div className="text-center" style={{ marginTop: `-${SIZE}px`, height: SIZE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="text-3xl font-bold" style={{ color: config.color }}>{result.trust_score}</span>
              <span className="text-xs text-slate-500 font-medium">/ 100</span>
            </div>
          </div>

          {/* Verdict text */}
          <div className="flex-1 text-center sm:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${config.bg} border ${config.border} mb-3`}>
              <Icon className={`w-4 h-4 ${config.text}`} />
              <span className={`text-sm font-bold ${config.text}`}>{config.label}</span>
            </div>
            <h3 className="text-slate-800 font-semibold text-lg mb-1 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-trinetra-blue" />
              Composite Trust Score: {result.trust_score}/100
            </h3>
            {hasMultiSrc && (
              <p className="text-xs text-slate-500 mb-2">
                Verified by {result.sources_checked?.join(' · ')}
              </p>
            )}
            <p className="text-slate-600 text-sm leading-relaxed">{result.reasoning}</p>
          </div>
        </div>
      </div>

      {/* ── Verification Sources panel ───────────────────────── */}
      {hasMultiSrc && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCheck className="w-4 h-4 text-trinetra-blue" />
            <h4 className="text-slate-700 font-semibold text-sm">Verification Sources</h4>
            <span className="ml-auto text-xs text-slate-400">{result.sources_checked?.length} sources checked</span>
          </div>
          <div className="space-y-3">
            <SourceBar
              label="Gemini AI Analysis"
              score={result.gemini_score}
              icon={Brain}
              iconColor="bg-blue-50 text-blue-500"
              available={true}
            />
            <SourceBar
              label="HuggingFace NLP Model"
              score={result.hf_score}
              icon={Bot}
              iconColor="bg-orange-50 text-orange-500"
              available={result.hf_available}
              note={result.hf_available === false ? 'Model unavailable' : undefined}
            />
            <SourceBar
              label="Google Fact Check"
              score={result.fact_check_score}
              icon={Search}
              iconColor="bg-green-50 text-green-500"
              available={result.fact_check_available}
              note={result.fact_check_count === 0 ? 'No claims found' : undefined}
            />
            <SourceBar
              label="NewsAPI Corroboration"
              score={result.news_score}
              icon={Newspaper}
              iconColor="bg-purple-50 text-purple-500"
              available={result.news_available}
            />
            <SourceBar
              label="Reality Defender"
              score={result.rd_score}
              icon={Globe}
              iconColor="bg-rose-50 text-rose-500"
              available={result.rd_available}
              note="Optional — AI origin check"
            />
          </div>

          {/* Reality Defender warning */}
          {result.rd_available && result.rd_ai_generated && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">
                <strong>Reality Defender:</strong> This content appears to be AI-generated ({result.rd_ai_probability}% confidence). This may indicate synthetic or fabricated news.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Details row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Source Analysis */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-trinetra-blue" />
            <h4 className="text-slate-700 font-semibold text-sm">Source Analysis</h4>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{result.source_analysis || 'No source analysis available.'}</p>
        </div>

        {/* Key Claims */}
        {result.key_claims?.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-trinetra-green" />
              <h4 className="text-slate-700 font-semibold text-sm">Key Claims Detected</h4>
            </div>
            <ul className="space-y-2">
              {result.key_claims.map((claim, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-trinetra-blue/10 text-trinetra-blue text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</span>
                  {claim}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Google Fact Check results ─────────────────────────── */}
      {hasFacts && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-green-500" />
            <h4 className="text-slate-700 font-semibold text-sm">Google Fact Check Results</h4>
            <span className="ml-auto text-xs text-slate-400">{result.fact_check_count} claim{result.fact_check_count > 1 ? 's' : ''} found</span>
          </div>
          <div className="space-y-3">
            {result.fact_checks.map((fc, i) => (
              <div key={i} className={`p-3 rounded-xl border ${fc.is_true ? 'bg-emerald-50 border-emerald-200' : fc.is_false ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fc.is_true ? 'bg-emerald-100 text-emerald-700' : fc.is_false ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                    {fc.rating}
                  </span>
                  <span className="text-xs text-slate-500">{fc.publisher}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{fc.text}</p>
                {fc.claimant && fc.claimant !== 'Unknown' && (
                  <p className="text-xs text-slate-400 mt-1">Claimed by: {fc.claimant}</p>
                )}
                {fc.url && (
                  <a href={fc.url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-trinetra-blue hover:underline mt-1">
                    View fact check <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NewsAPI corroborating sources ─────────────────────── */}
      {hasNews && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-4 h-4 text-purple-500" />
            <h4 className="text-slate-700 font-semibold text-sm">Corroborating News Sources</h4>
            <span className="ml-auto text-xs text-slate-400">{result.total_results?.toLocaleString()} total results</span>
          </div>
          {result.trusted_count > 0 && (
            <p className="text-xs text-emerald-600 font-medium mb-3">
              ✓ {result.trusted_count} trusted outlet{result.trusted_count > 1 ? 's' : ''} reporting on this story
            </p>
          )}
          <div className="space-y-2">
            {result.news_sources.map((src, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl">
                <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700">{src.name}</span>
                  {src.title && <p className="text-xs text-slate-500 truncate mt-0.5">{src.title}</p>}
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-xs text-trinetra-blue hover:underline">
                      Read <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Red Flags ─────────────────────────────────────────── */}
      {result.red_flags?.length > 0 && result.red_flags[0] && (
        <div className="card p-5 border-2 border-red-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-trinetra-red" />
            <h4 className="text-slate-700 font-semibold text-sm">Red Flags Identified</h4>
          </div>
          <ul className="space-y-2">
            {result.red_flags.filter(f => f).map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
