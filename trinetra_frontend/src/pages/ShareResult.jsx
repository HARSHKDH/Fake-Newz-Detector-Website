import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Shield, AlertTriangle, CheckCircle2, HelpCircle, XCircle, ExternalLink, Check } from 'lucide-react'
import TrustScoreCard from '../components/TrustScoreCard'

const VERDICT_CONFIG = {
  REAL:        { label: 'Verified Real', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  LIKELY_REAL: { label: 'Likely Real',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  UNCERTAIN:   { label: 'Uncertain',     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: HelpCircle   },
  LIKELY_FAKE: { label: 'Likely Fake',   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     icon: AlertTriangle },
  FAKE:        { label: 'Fake News',     color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     icon: XCircle      },
}

export default function ShareResult() {
  const [params] = useSearchParams()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const data = params.get('d')
    if (!data) { setError('No result data found in this link.'); return }
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(data)))
      setResult(decoded)
    } catch {
      setError('This share link is invalid or has expired.')
    }
  }, [params])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cfg = result ? (VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.UNCERTAIN) : null
  const Icon = cfg?.icon

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <nav className="bg-navy-900 border-b border-navy-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-trinetra-blue rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">Trinetra</span>
              <div className="text-navy-500 text-xs font-medium -mt-0.5">Verify · Trust · Know</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-700 text-slate-300 text-sm font-medium hover:bg-navy-600 transition-all"
              id="copy-share-link-btn"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <Link
              to="/analyze"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-trinetra-blue text-white text-sm font-semibold hover:bg-trinetra-blue-light transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Analyze Your Own
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Shared-by banner */}
        <div className="card p-4 mb-6 flex items-center gap-3 border border-blue-100 bg-blue-50/60">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-trinetra-blue" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Shared Fact-Check Result</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Someone shared this Trinetra AI analysis with you. Verify any news yourself at{' '}
              <Link to="/analyze" className="text-trinetra-blue underline font-medium">trinetra.ai/analyze</Link>
            </p>
          </div>
        </div>

        {error && (
          <div className="card p-8 text-center">
            <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <h2 className="text-slate-700 font-semibold">{error}</h2>
            <Link to="/analyze" className="btn-primary mt-5 inline-flex">Analyze Something New</Link>
          </div>
        )}

        {result && (
          <>
            {/* Quick verdict hero for social preview feel */}
            {cfg && (
              <div className={`card p-5 mb-5 flex items-center gap-4 border-2 ${cfg.border} ${cfg.bg}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`w-7 h-7 ${cfg.color}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Verdict</p>
                  <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-slate-500 text-sm mt-0.5">Trust Score: <strong className={cfg.color}>{result.trust_score}/100</strong></p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Share'}
                  </button>
                </div>
              </div>
            )}

            <TrustScoreCard result={result} />

            <div className="mt-8 card p-6 text-center border border-trinetra-blue/20 bg-blue-50/40">
              <p className="text-slate-700 font-semibold mb-1">Don't trust everything you read online</p>
              <p className="text-slate-500 text-sm mb-4">Use Trinetra AI to fact-check any news article or claim in seconds.</p>
              <Link to="/register" className="btn-primary mr-3" id="share-page-signup-btn">Get Started Free</Link>
              <Link to="/analyze" className="btn-secondary" id="share-page-analyze-btn">Try the Analyzer</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
