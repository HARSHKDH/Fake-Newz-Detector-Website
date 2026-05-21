import { useState, useRef, useCallback } from 'react'
import { ImagePlus, X, Loader2, AlertCircle, Sparkles, Camera, FileImage, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { mlApi, api } from '../api'
import TrustScoreCard from '../components/TrustScoreCard'

const MAX_SIZE_MB = 8
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function ImageAnalyzer() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Please upload a JPG, PNG, WebP or GIF image.')
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB}MB.`)
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }, [handleFile])

  const handleAnalyze = async () => {
    if (!file) { setError('Please select an image first.'); return }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await mlApi.post('/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000, // 3 min — OCR + Gemini
      })
      setResult(data)

      // Save to history silently
      try {
        await api.post('/history/', {
          input_text:      `[IMAGE] ${file.name}: ${data.reasoning?.slice(0, 400) || ''}`,
          input_url:       '',
          trust_score:     data.trust_score,
          gemini_score:    data.gemini_score || 0,
          verdict:         data.verdict,
          verdict_label:   data.verdict_label || '',
          reasoning:       data.reasoning || '',
          source_analysis: data.source_analysis || '',
          red_flags:       Array.isArray(data.red_flags) ? data.red_flags.filter(Boolean).slice(0, 8) : [],
          key_claims:      Array.isArray(data.key_claims) ? data.key_claims.filter(Boolean).slice(0, 8) : [],
          sources_checked: Array.isArray(data.sources_checked) ? data.sources_checked.filter(Boolean).slice(0, 20) : [],
          input_mode:      data.input_mode || 'image',
        })
      } catch (_) { /* non-critical */ }

    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the Trinetra AI engine. Make sure FastAPI is running on port 8001.')
      } else {
        const detail = err.response?.data?.detail
        setError(
          typeof detail === 'string'
            ? detail
            : 'Image analysis failed. Please try a clearer screenshot.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <Link to="/analyze" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-trinetra-blue mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Analyzer
        </Link>
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center shadow-glow">
            <Camera className="w-8 h-8 text-trinetra-blue" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Image Fact-Check</h1>
        <p className="text-slate-500 mt-2 max-w-lg mx-auto">
          Upload a screenshot of a news headline, WhatsApp forward, or social media post.
          Trinetra AI will extract the text and fact-check it instantly.
        </p>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div className="card p-6 mb-6">
          {!preview ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-trinetra-blue bg-blue-50'
                  : 'border-slate-200 hover:border-trinetra-blue/50 hover:bg-slate-50/60'
              }`}
              id="image-drop-zone"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
                id="image-file-input"
              />
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <FileImage className="w-7 h-7 text-slate-400" />
                </div>
              </div>
              <p className="text-slate-700 font-semibold text-base">Drop your image here</p>
              <p className="text-slate-400 text-sm mt-1">or click to browse — JPG, PNG, WebP, GIF up to {MAX_SIZE_MB}MB</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center text-xs text-slate-500">
                {['Screenshots', 'WhatsApp forwards', 'Social media posts', 'News headlines'].map(t => (
                  <span key={t} className="px-2.5 py-1 bg-slate-100 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 mb-4">
                <img src={preview} alt="Selected" className="w-full max-h-96 object-contain bg-slate-50" />
                <button
                  onClick={handleClear}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all"
                  id="image-clear-btn"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <ImagePlus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file?.name}</p>
                  <p className="text-xs text-slate-400">{file ? (file.size / 1024).toFixed(0) + ' KB' : ''}</p>
                </div>
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
              disabled={loading || !file}
              className="btn-primary flex-1 py-3"
              id="image-analyze-btn"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Extracting &amp; Analyzing…</>
              ) : (
                <><Sparkles className="w-4 h-4" />Fact-Check This Image</>
              )}
            </button>
            {(file || result) && (
              <button onClick={handleClear} className="btn-secondary px-5" id="image-reset-btn">Reset</button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-10 text-center animate-fade-in">
          <div className="flex justify-center mb-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-trinetra-blue/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-trinetra-blue border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-2 border-4 border-trinetra-blue-glow/40 border-t-transparent rounded-full animate-spin-slow" style={{ animationDirection: 'reverse' }} />
            </div>
          </div>
          <p className="text-slate-700 font-semibold">Extracting text from image…</p>
          <p className="text-slate-400 text-sm mt-1">Running OCR → Gemini AI fact-check → multi-source verification</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-trinetra-blue transition-colors"
              id="image-analyze-another-btn"
            >
              <ArrowLeft className="w-4 h-4" /> Analyze another image
            </button>
          </div>
          <TrustScoreCard result={result} />
        </>
      )}
    </div>
  )
}
