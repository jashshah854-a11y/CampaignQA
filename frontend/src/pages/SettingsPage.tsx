import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  plan_tier: string
  reports_used: number
  reports_limit: number
  created_at: string
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:   { label: 'Free',   color: 'bg-slate-100 text-slate-700' },
  pro:    { label: 'Pro',    color: 'bg-blue-100 text-blue-700'   },
  agency: { label: 'Agency', color: 'bg-indigo-100 text-indigo-700' },
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ full_name: '', company_name: '' })

  useEffect(() => {
    api.getProfile()
      .then(p => {
        setProfile(p)
        setForm({ full_name: p.full_name || '', company_name: p.company_name || '' })
      })
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await api.updateProfile(form)
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setError('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleUpgrade = async (plan: 'pro' | 'agency') => {
    setUpgradeLoading(true)
    try {
      const { checkout_url } = await api.createCheckoutSession(plan)
      window.location.href = checkout_url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setUpgradeLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }

  const plan = profile?.plan_tier || 'free'
  const planMeta = PLAN_LABELS[plan] || PLAN_LABELS.free

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">Sign out</button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">{error}</div>
      )}

      {/* Plan card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Current Plan</h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${planMeta.color}`}>{planMeta.label}</span>
        </div>

        {plan === 'free' ? (
          <>
            <p className="text-sm text-slate-500 mb-4">Upgrade to unlock client-shareable reports and team access.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={upgradeLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Upgrade to Pro — $29/mo
              </button>
              <button
                onClick={() => handleUpgrade('agency')}
                disabled={upgradeLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Upgrade to Agency — $79/mo
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900 capitalize">{plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">QA Runs</span>
              <span className="font-medium text-slate-900">Unlimited</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Member since</span>
              <span className="font-medium text-slate-900">
                {profile ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              value={user?.email || ''}
              disabled
              className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company / Agency</label>
            <input
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Your company"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Account</h2>
        <p className="text-xs text-slate-500">
          Signed in as <strong>{user?.email}</strong>. To delete your account, contact{' '}
          <a href="mailto:jashshah854@gmail.com" className="text-blue-600 hover:underline">support</a>.
        </p>
      </div>
    </div>
  )
}
