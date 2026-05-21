import { useEffect, useRef } from 'react'
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  TrendingUp, Brain, Newspaper, Search, Bot, Globe,
  ExternalLink, CheckCheck, AlertCircle, Building2, Star, Zap,
} from 'lucide-react'

const VERDICT_CONFIG = {
  REAL:        { label: 'Verified Real', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, glow: 'shadow-emerald-100' },
  LIKELY_REAL: { label: 'Likely Real',   color: '#34D399', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, glow: 'shadow-emerald-100' },
  UNCERTAIN:   { label: 'Uncertain',     color: '#F59E0B', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: HelpCircle,   glow: 'shadow-amber-100' },
  LIKELY_FAKE: { label: 'Likely Fake',   color: '#F87171', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: AlertTriangle, glow: 'shadow-red-100' },
  FAKE:        { label: 'Fake News',     color: '#EF4444', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: XCircle,       glow: 'shadow-red-100' },
}

const SIZE   = 130
const STROKE = 12
const R      = (SIZE - STROKE) / 2
const CIRC   = 2 * Math.PI * R

// Domain reputation badge
function DomainBadge({ reputation, category, domain }) {
  if (!reputation || category === 'text_only') return null
  const isGood    = category === 'tier1_trusted' || category === 'official'
  const isOk      = category === 'tier2_reputable'
  const isBad     = category === 'known_fake' || category === 'suspicious_ip'
  const isUnknown = category === 'unknown'

  if (isUnknown) return null

  const styles = isGood  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
               : isOk    ? 'bg-blue-100 text-blue-800 border-blue-200'
               : isBad   ? 'bg-red-100 text-red-800 border-red-200 font-bold'
               : 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${styles} mb-3`}>
      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{reputation}</span>
    </div>
  )
}

// Source attribution row
function SourceBadge({ detectedSource }) {
  if (!detectedSource || detectedSource === 'Unknown') return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
      <Globe className="w-3 h-3" />
      <span>Source detected: <strong className="text-slate-700">{detectedSource}</strong></span>
    </div>
  )
}

// Mini score bar for each source
function SourceBar({ label, score, icon: Icon, iconColor, available, note }) {
  const pct   = Math.max(0, Math.min(100, score ?? 50))
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

// Score interpretation helper
function ScoreInterpretation({ score, verdict }) {
  const ranges = [
    { min: 85, label: '✅ Highly credible — verified sources, professional journalism', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { min: 65, label: '✅ Likely credible — mostly verified with minor gaps', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { min: 40, label: '⚠️ Uncertain — mixed signals, treat with caution', color: 'text-amber-700', bg: 'bg-amber-50' },
    { min: 20, label: '🚨 Likely misinformation — multiple red flags detected', color: 'text-red-600', bg: 'bg-red-50' },
    { min: 0,  label: '❌ Fake news — fabricated or confirmed misinformation', color: 'text-red-700', bg: 'bg-red-50' },
  ]
  const range = ranges.find(r => score >= r.min) || ranges[ranges.length - 1]
  return (
    <p className={`text-xs ${range.color} ${range.bg} px-2 py-1 rounded-lg inline-block mt-1 font-medium`}>
      {range.label}
    </p>
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

  const hasFacts    = result.fact_checks?.length > 0
  const hasNews     = result.news_sources?.length > 0
  const hasMultiSrc = (result.sources_checked?.length ?? 0) > 1
  const hasCreds    = result.credibility_signals?.length > 0 && result.credibility_signals[0]
  const isFake      = result.verdict === 'FAKE' || result.verdict === 'LIKELY_FAKE'
  const isReal      = result.verdict === 'REAL' || result.verdict === 'LIKELY_REAL'

  return (
    <div className="space-y-5 animate-slide-up">

      {/* ── Known Fake Site Warning Banner ──────────────────────────────── */}
      {result.is_known_fake_site && (
        <div className="card p-4 border-2 border-red-400 bg-red-50 flex items-start gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-red-700 font-bold text-sm">⚠️ KNOWN MISINFORMATION SOURCE DETECTED</p>
            <p className="text-red-600 text-xs mt-0.5">
              This URL is from a site flagged in our misinformation database ({result.domain_category?.replace('_', ' ')}). 
              Content from this source is extremely likely to be false or misleading.
            </p>
          </div>
        </div>
      )}

      {/* ── Main verdict card ───────────────────────────────────────────── */}
      <div className={`card p-6 border-2 ${config.border} ${config.bg} ${config.glow} shadow-lg`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Score ring */}
          <div className="flex-shrink-0 relative">
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
            <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: config.color }}>{result.trust_score}</span>
              <span className="text-xs text-slate-500 font-medium">/ 100</span>
            </div>
          </div>

          {/* Verdict text */}
          <div className="flex-1 text-center sm:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${config.bg} border ${config.border} mb-2`}>
              <Icon className={`w-4 h-4 ${config.text}`} />
              <span className={`text-sm font-bold ${config.text}`}>{config.label}</span>
            </div>

            {/* Domain reputation badge */}
            {result.domain_available && (
              <div className="block mb-2">
                <DomainBadge
                  reputation={result.domain_reputation}
                  category={result.domain_category}
                  domain={result.detected_source}
                />
              </div>
            )}

            <h3 className="text-slate-800 font-semibold text-lg mb-0.5 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-trinetra-blue" />
              Trust Score: {result.trust_score}/100
            </h3>
            <ScoreInterpretation score={result.trust_score} verdict={result.verdict} />
            {/* Mode badge */}
            {result.input_mode && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                result.input_mode === 'claim'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {result.input_mode === 'claim' ? '🔍 Fact-Check Mode' : '📰 Article Analysis Mode'}
              </span>
            )}
            <SourceBadge detectedSource={result.detected_source} />
            {hasMultiSrc && (
              <p className="text-xs text-slate-400 mt-2">
                Verified by: {result.sources_checked?.join(' · ')}
              </p>
            )}
            <p className="text-slate-600 text-sm leading-relaxed mt-3">{result.reasoning}</p>
          </div>
        </div>
      </div>

      {/* ── Verification Sources panel ──────────────────────────────────── */}
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
            {result.domain_available && (
              <SourceBar
                label={`Domain Reputation (${result.domain_category?.replace(/_/g, ' ')})`}
                score={result.domain_score}
                icon={Building2}
                iconColor={result.is_known_fake_site ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}
                available={result.domain_available}
              />
            )}
            <SourceBar
              label="HuggingFace NLP Model"
              score={result.hf_score}
              icon={Bot}
              iconColor="bg-orange-50 text-orange-500"
              available={result.hf_available}
              note={!result.hf_available ? 'Model unavailable' : undefined}
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
              label="AI Content Detection"
              score={result.rd_score}
              icon={Globe}
              iconColor="bg-rose-50 text-rose-500"
              available={result.rd_available}
            />
          </div>

          {result.rd_available && result.rd_ai_generated && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">
                <strong>AI Detection:</strong> This content appears to be AI-generated ({result.rd_ai_probability}% confidence). This may indicate synthetic or fabricated news.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Credibility + Red Flags 2-col ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Credibility Signals */}
        {hasCreds && (
          <div className="card p-5 border border-emerald-100">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-emerald-500" />
              <h4 className="text-slate-700 font-semibold text-sm">Credibility Signals</h4>
            </div>
            <ul className="space-y-2">
              {result.credibility_signals.filter(Boolean).map((sig, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                  {sig}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {result.red_flags?.length > 0 && result.red_flags[0] && (
          <div className="card p-5 border border-red-100">
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

      {/* ── Source Analysis + Key Claims ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-trinetra-blue" />
            <h4 className="text-slate-700 font-semibold text-sm">Source Analysis</h4>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{result.source_analysis || 'No source analysis available.'}</p>
        </div>

        {result.key_claims?.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-trinetra-blue" />
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

      {/* ── Google Fact Check results ────────────────────────────────────── */}
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

      {/* ── NewsAPI corroborating sources ─────────────────────────────────── */}
      {hasNews && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-4 h-4 text-purple-500" />
            <h4 className="text-slate-700 font-semibold text-sm">Corroborating News Sources</h4>
            <span className="ml-auto text-xs text-slate-400">{result.total_results?.toLocaleString()} total results</span>
          </div>
          {result.trusted_count > 0 ? (
            <p className="text-xs text-emerald-600 font-medium mb-3">
              ✓ {result.trusted_count} trusted outlet{result.trusted_count > 1 ? 's' : ''} reporting on this story
            </p>
          ) : (
            <p className="text-xs text-amber-600 mb-3">⚠ No major trusted outlets corroborating this story</p>
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
    </div>
  )
}
