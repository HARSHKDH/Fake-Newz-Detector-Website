import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import { api } from '../api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRequestOTP = async (e) => {
    e.preventDefault()
    if (!email) return setError('Please enter your email address.')
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password/', { email })
      setSuccess('If an account exists with this email, an OTP has been sent.')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (!otp) return setError('Please enter the OTP.')
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/verify-otp/', { email, otp })
      setSuccess('OTP verified! Please enter your new password.')
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return setError('Passwords do not match.')
    if (newPassword.length < 8) return setError('Password must be at least 8 characters long.')
    
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password/', { email, otp, new_password: newPassword })
      setSuccess('Password reset successfully! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.')
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
            <p className="text-trinetra-blue-glow text-sm font-semibold uppercase tracking-wider">Account Recovery</p>
            <p className="text-slate-300 text-base leading-relaxed">
              Reset your password securely using an email verification code to regain access to your account.
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
              <h2 className="text-2xl font-bold text-slate-800">Reset Password</h2>
              <p className="text-slate-500 mt-1 text-sm">
                {step === 1 && "Enter your email to receive an OTP"}
                {step === 2 && "Enter the 6-digit code sent to your email"}
                {step === 3 && "Create your new password"}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in" role="alert">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {success && step !== 2 && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm animate-fade-in" role="alert">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Step 1: Email Form */}
            {step === 1 && (
              <form onSubmit={handleRequestOTP} className="space-y-4 animate-fade-in" noValidate>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess('') }}
                      required
                      className="input-field pl-10"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending OTP...</>
                  ) : 'Send Verification Code'}
                </button>
              </form>
            )}

            {/* Step 2: OTP Form */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4 animate-fade-in" noValidate>
                <div>
                  <label htmlFor="reset-otp" className="block text-sm font-medium text-slate-700 mb-1">6-Digit OTP</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="reset-otp"
                      name="otp"
                      type="text"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value); setError('') }}
                      required
                      className="input-field pl-10 text-center tracking-[0.5em] font-mono font-bold"
                      placeholder="------"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</>
                  ) : 'Verify Code'}
                </button>
                <div className="text-center mt-3">
                  <button type="button" onClick={() => { setStep(1); setSuccess('') }} className="text-sm text-slate-500 hover:text-slate-700 underline">
                    Change Email
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: New Password Form */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in" noValidate>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="new-password"
                      type={showPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                      required
                      className="input-field pl-10 pr-10"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="confirm-password"
                      type={showPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                      required
                      className="input-field pl-10"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resetting...</>
                  ) : 'Reset Password'}
                </button>
              </form>
            )}

            <div className="text-center mt-8">
              <Link to="/login" className="text-sm font-semibold text-trinetra-blue hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
