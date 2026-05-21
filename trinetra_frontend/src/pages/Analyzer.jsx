import { useState } from 'react'
import { Scan, Link2, FileText, Loader2, AlertCircle, Sparkles, Info } from 'lucide-react'
import { mlApi, api } from '../api'
import TrustScoreCard from '../components/TrustScoreCard'

export default function Analyzer() {
  const [mode, setMode] = useState('text') // 'text' | 'url'
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    const input = mode === 'text' ? text.trim() : url.trim()
    if (!input) {
      setError(mode === 'text' ? 'Please paste some news text to analyze.' : 'Please enter a valid URL.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const payload = mode === 'text' ? { text } : { url }
      const { data } = await mlApi.post('/analyze', payload)
      setResult(data)

      // Save to history (non-critical — failure is silent)
      try {
        const inputText = mode === 'text'
          ? text.slice(0, 500)
          : `[URL] ${url}`
        await api.post('/history/', {
          input_text:      inputText,
          input_url:       mode === 'url' ? url : '',
          trust_score:     data.trust_score,
          gemini_score:    data.gemini_score    || 0,
          verdict:         data.verdict,
          verdict_label:   data.verdict_label   || '',
          reasoning:       data.reasoning       || '',
          source_analysis: data.source_analysis || '',
          red_flags:       Array.isArray(data.red_flags)       ? data.red_flags.filter(Boolean).slice(0, 8)        : [],
          key_claims:      Array.isArray(data.key_claims)      ? data.key_claims.filter(Boolean).slice(0, 8)       : [],
          sources_checked: Array.isArray(data.sources_checked) ? data.sources_checked.filter(Boolean).slice(0, 20) : [],
          input_mode:      data.input_mode || '',
        })
      } catch (_) {
        // Non-critical — history save failure is silent
      }
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the Trinetra AI engine. Make sure FastAPI is running on port 8001.')
      } else {
        setError(err.response?.data?.detail || 'Analysis failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setText('')
    setUrl('')
    setResult(null)
    setError('')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center shadow-glow">
            <Scan className="w-8 h-8 text-trinetra-blue" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Trinetra AI Engine</h1>
        <p className="text-slate-500 mt-2 max-w-lg mx-auto">
          Powered by Google Gemini. Paste any news article or URL for a real-time Trust Score and fact-check analysis.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6 w-fit mx-auto">
        {[
          { id: 'text', label: 'Paste Text', icon: FileText },
          { id: 'url', label: 'Enter URL', icon: Link2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setError(''); setResult(null) }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === id ? 'bg-white shadow-md text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
            id={`mode-${id}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Input Card */}
      <div className="card p-6 mb-6">
        {mode === 'text' ? (
          <div>
            <label htmlFor="news-text-input" className="block text-sm font-medium text-slate-700 mb-2">
              News Article Text
            </label>
            <textarea
              id="news-text-input"
              value={text}
              onChange={(e) => { setText(e.target.value); setError('') }}
              rows={8}
              className="input-field resize-none font-mono text-sm"
              placeholder="Paste the full news article text here for analysis…"
            />
            <p className="text-xs text-slate-400 mt-1.5">{text.length.toLocaleString()} characters</p>
          </div>
        ) : (
          <div>
            <label htmlFor="news-url-input" className="block text-sm font-medium text-slate-700 mb-2">
              Article URL
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="news-url-input"
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError('') }}
                className="input-field pl-10"
                placeholder="https://example.com/news-article"
              />
            </div>
            <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">The AI engine will fetch and extract the article content from the URL automatically.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="btn-primary flex-1 py-3"
            id="analyze-btn"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Analyzing with Gemini AI...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Analyze Now</>
            )}
          </button>
          {(text || url || result) && (
            <button onClick={handleClear} className="btn-secondary px-5" id="clear-btn">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Loading animation */}
      {loading && (
        <div className="card p-10 text-center animate-fade-in">
          <div className="flex justify-center mb-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-trinetra-blue/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-trinetra-blue border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-2 border-4 border-trinetra-blue-glow/40 border-t-transparent rounded-full animate-spin-slow" style={{ animationDirection: 'reverse' }} />
            </div>
          </div>
          <p className="text-slate-700 font-semibold">Gemini AI is analysing the content…</p>
          <p className="text-slate-400 text-sm mt-1">Checking facts, sources, and credibility signals</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && <TrustScoreCard result={result} />}
    </div>
  )
}
