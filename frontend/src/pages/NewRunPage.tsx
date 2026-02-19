import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import type { CreateRunPayload } from '@/lib/api'

const PLATFORMS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
  { value: 'multi', label: 'Multi-Platform' },
]

const OBJECTIVES = ['awareness', 'traffic', 'conversion', 'retargeting']
const VERTICALS = ['ecommerce', 'saas', 'lead_gen', 'app_install', 'other']

export default function NewRunPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    run_name: '',
    platform: 'meta',
    urlsRaw: '',
    campaign_name: '',
    campaign_objective: '',
    industry_vertical: '',
    headline: '',
    primary_text: '',
    description: '',
  })

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const rawLines = form.urlsRaw.split('\n').map(l => l.trim()).filter(Boolean)
    if (rawLines.length === 0) { setError('Add at least one URL'); return }
    if (!form.run_name.trim()) { setError('Give this run a name'); return }

    const urls = rawLines.map(url => ({ url }))

    const payload: CreateRunPayload = {
      run_name: form.run_name,
      platform: form.platform,
      urls,
      campaign_name: form.campaign_name || undefined,
      campaign_objective: form.campaign_objective || undefined,
      industry_vertical: form.industry_vertical || undefined,
      headline: form.headline || undefined,
      primary_text: form.primary_text || undefined,
      description: form.description || undefined,
    }

    setLoading(true)
    try {
      const res = await api.createRun(payload)
      navigate(`/runs/${res.run_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New QA Run</h1>
        <p className="text-slate-500 mt-1">Check your campaign before it goes live</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Run name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Run Name *</label>
          <input
            {...field('run_name')}
            placeholder="e.g. Black Friday Campaign — Meta"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Platform */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Platform *</label>
          <select
            {...field('platform')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* URLs */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Destination URLs * <span className="text-slate-400 font-normal">(one per line)</span>
          </label>
          <textarea
            {...field('urlsRaw')}
            rows={5}
            placeholder={"https://yoursite.com/landing?utm_source=facebook&utm_medium=cpc&utm_campaign=bfcm\nhttps://yoursite.com/product?utm_source=instagram&utm_medium=paid_social&utm_campaign=bfcm"}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Paste up to 50 destination URLs, one per line</p>
        </div>

        {/* Optional: Ad copy */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Ad Copy (optional — enables character limit checks)
          </summary>
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Headline</label>
              <input {...field('headline')} placeholder="Your ad headline" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Text / Ad Copy</label>
              <textarea {...field('primary_text')} rows={3} placeholder="Your primary ad copy text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input {...field('description')} placeholder="Ad description" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </details>

        {/* Optional: Campaign metadata */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Campaign Details (optional — enables benchmark comparison)
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-4 pl-4 border-l-2 border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Objective</label>
              <select {...field('campaign_objective')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {OBJECTIVES.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry Vertical</label>
              <select {...field('industry_vertical')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {VERTICALS.map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </details>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
        >
          {loading ? 'Running QA checks...' : 'Run QA Check →'}
        </button>
      </form>
    </div>
  )
}
