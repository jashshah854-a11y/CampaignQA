import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  useEffect(() => { document.title = 'Sign in — LaunchProof' }, [])
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)

  if (session) return <Navigate to="/dashboard" replace />

  const sendOtp = async () => {
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (err) { setError(err.message); return false }
    setResendCountdown(30)
    return true
  }

  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCountdown])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await sendOtp()
    if (ok) setStep('otp')
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    setLoading(false)
    if (err) setError(err.message)
    // On success AuthContext picks up session via onAuthStateChange → Navigate fires
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">LaunchProof</h1>
          <p className="text-slate-500 mt-2 text-sm">Pre-launch QA for paid media campaigns</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {loading ? 'Sending code…' : 'Continue with email →'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                We'll send a 6-digit sign-in code. No password needed.
              </p>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <div className="text-3xl mb-3">📬</div>
                <p className="text-sm font-semibold text-slate-900">Check your inbox</p>
                <p className="text-xs text-slate-500 mt-1">
                  6-digit code sent to <span className="font-medium text-slate-700">{email}</span>
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '')
                  setOtp(val)
                  if (val.length === 6) {
                    // Auto-submit when 6 digits entered
                    setTimeout(() => {
                      (e.target.form as HTMLFormElement | null)?.requestSubmit()
                    }, 80)
                  }
                }}
                placeholder="000000"
                className="w-full px-3 py-3 border border-slate-300 rounded-lg text-xl font-mono text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {loading ? 'Verifying…' : 'Verify & sign in →'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError('') }}
                  className="text-slate-400 hover:text-slate-600 transition-colors py-1"
                >
                  ← Different email
                </button>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || loading}
                  onClick={sendOtp}
                  className="text-blue-500 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors py-1"
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in you agree to our{' '}
          <a href="mailto:jashshah854@gmail.com" className="underline hover:text-slate-600">terms</a>
          {' '}and{' '}
          <a href="mailto:jashshah854@gmail.com" className="underline hover:text-slate-600">privacy policy</a>.
        </p>
      </div>
    </div>
  )
}
