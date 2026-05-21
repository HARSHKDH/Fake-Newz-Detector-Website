import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GoogleLogin } from '@react-oauth/google'

export default function Login() {
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msgs = Object.values(data).flat()
        setError(msgs[0] || 'Login failed.')
      } else {
        setError('Unable to connect. Please ensure the backend is running on port 8000.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async (credentialResponse) => {
    setLoading(true)
    try {
      await googleLogin(credentialResponse.credential)
      navigate('/')
    } catch {
      setError('Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-naval flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '32px 32px'}} />

        <div className="relative text-center space-y-10 max-w-md">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-28 h-28 bg-trinetra-blue/20 rounded-3xl flex items-center justify-center border border-trinetra-blue/30 shadow-glow">
                <Shield className="w-14 h-14 text-trinetra-blue-glow" strokeWidth={1.5} />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-trinetra-green rounded-full border-4 border-navy-900 animate-pulse-slow" />
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-bold text-white tracking-tight">Trinetra</h1>
            <p className="mt-3 text-slate-400 text-xl font-light">Verify · Trust · Know</p>
          </div>

          <div className="glass-card p-6 text-left space-y-3">
            <p className="text-trinetra-blue-glow text-sm font-semibold uppercase tracking-wider">AI-Powered Verification</p>
            <p className="text-slate-300 text-base leading-relaxed">
              Get real-time Trust Scores, source analysis, and Gemini AI reasoning on any news story — instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-trinetra-blue" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
              <p className="text-slate-500 mt-1 text-sm">Sign in to your Trinetra account</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in" role="alert">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="input-field pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-trinetra-blue hover:underline">Forgot Password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="input-field pl-10 pr-10"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 mt-2"
                id="login-submit-btn"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => setError('Google sign-in failed.')}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                width={400}
                useOneTap={false}
                cancel_on_tap_outside={false}
              />
            </div>

            <p className="text-center text-sm text-slate-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-trinetra-blue font-semibold hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
