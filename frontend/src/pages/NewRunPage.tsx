import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

type UrlEntry = { url: string; ad_name?: string; ad_set_name?: string; campaign_name?: string }

const SAMPLE_CSV = `url,ad_name,ad_set_name,campaign_name
https://yoursite.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_2025,Ad 1 - Image,Lookalike 1%,BFCM 2025
https://yoursite.com/product?utm_source=instagram&utm_medium=paid_social&utm_campaign=bfcm_2025,Ad 2 - Video,Lookalike 2%,BFCM 2025
`

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'launchproof-sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Parse a CSV file into UrlEntry[].
 *  Expected columns (header optional): url, ad_name, ad_set_name, campaign_name
 *  Falls back to treating every non-empty line as a plain URL if no header found.
 */
function parseCsv(text: string): { entries: UrlEntry[]; error: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { entries: [], error: 'CSV file is empty' }

  const firstLower = lines[0].toLowerCase()
  const hasHeader = firstLower.includes('url')
  const dataLines = hasHeader ? lines.slice(1) : lines

  if (hasHeader) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const idx = (name: string) => headers.indexOf(name)
    const urlIdx = idx('url')
    if (urlIdx === -1) return { entries: [], error: 'CSV must have a "url" column' }

    const entries: UrlEntry[] = []
    for (const line of dataLines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const url = cols[urlIdx]
      if (!url) continue
      entries.push({
        url,
        ad_name: cols[idx('ad_name')] || undefined,
        ad_set_name: cols[idx('ad_set_name')] || undefined,
        campaign_name: cols[idx('campaign_name')] || undefined,
      })
    }
    return { entries, error: '' }
  }

  // No header — treat each line as a raw URL
  const entries = dataLines.map(line => ({ url: line.trim() })).filter(e => e.url)
  return { entries, error: '' }
}

export default function NewRunPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [urlMode, setUrlMode] = useState<'paste' | 'csv'>('paste')
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null)

  useEffect(() => { document.title = 'New QA Run — LaunchProof' }, [])

  useEffect(() => {
    api.getProfile()
      .then(p => {
        if (p.plan_tier === 'free') {
          setUsageInfo({ used: p.reports_used, limit: p.reports_limit, plan: p.plan_tier })
        }
      })
      .catch(() => {})
  }, [])
  const [csvFilename, setCsvFilename] = useState('')
  const [csvEntries, setCsvEntries] = useState<UrlEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { entries, error: parseError } = parseCsv(text)
      if (parseError) {
        setError(parseError)
        setCsvEntries([])
      } else {
        setError('')
        setCsvEntries(entries)
      }
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let urls: UrlEntry[]
    if (urlMode === 'csv') {
      if (csvEntries.length === 0) { setError('Upload a CSV file with at least one URL'); return }
      urls = csvEntries
    } else {
      const rawLines = form.urlsRaw.split('\n').map(l => l.trim()).filter(Boolean)
      if (rawLines.length === 0) { setError('Add at least one URL'); return }
      urls = rawLines.map(url => ({ url }))
    }

    if (!form.run_name.trim()) { setError('Give this run a name'); return }
    if (urls.length > 50) { setError('Maximum 50 URLs per run'); return }

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

  const fillSample = () => {
    setForm(f => ({
      ...f,
      run_name: f.run_name || 'My First QA Run — Meta',
      platform: 'meta',
      urlsRaw: 'https://yoursite.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_2025&utm_content=hero_image',
    }))
    setUrlMode('paste')
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline mb-3 block">← Dashboard</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New QA Run</h1>
            <p className="text-slate-500 mt-1">Check your campaign before it goes live</p>
          </div>
          <button
            type="button"
            onClick={fillSample}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 flex-shrink-0 transition-colors"
          >
            Try with sample URL →
          </button>
        </div>
      </div>

      {/* Free-tier usage indicator */}
      {usageInfo && (
        usageInfo.used >= usageInfo.limit ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-2">
            <p className="text-sm font-semibold text-amber-900 mb-1">Free plan limit reached ({usageInfo.used}/{usageInfo.limit} runs)</p>
            <p className="text-xs text-amber-700 mb-3">Upgrade to Pro for unlimited QA runs, API access, and client-shareable reports.</p>
            <Link
              to="/settings"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Upgrade to Pro — $29/mo →
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <div className="flex gap-0.5">
              {Array.from({ length: usageInfo.limit }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${i < usageInfo.used ? 'bg-blue-400' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <span>{usageInfo.used}/{usageInfo.limit} free runs used · {usageInfo.limit - usageInfo.used} remaining</span>
            <Link to="/settings" className="text-blue-600 hover:underline ml-1">Upgrade</Link>
          </div>
        )
      )}

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

        {/* URLs — paste or CSV */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Destination URLs *</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setUrlMode('paste')}
                className={`px-3 py-1.5 font-medium transition-colors ${urlMode === 'paste' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => setUrlMode('csv')}
                className={`px-3 py-1.5 font-medium transition-colors ${urlMode === 'csv' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Upload CSV
              </button>
            </div>
          </div>

          {urlMode === 'paste' ? (
            <>
              <textarea
                {...field('urlsRaw')}
                rows={5}
                placeholder={"https://yoursite.com/landing?utm_source=facebook&utm_medium=cpc&utm_campaign=bfcm\nhttps://yoursite.com/product?utm_source=instagram&utm_medium=paid_social&utm_campaign=bfcm"}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-slate-400">One URL per line, up to 50</p>
                {(() => {
                  const count = form.urlsRaw.split('\n').map(l => l.trim()).filter(Boolean).length
                  if (count === 0) return null
                  return (
                    <p className={`text-xs font-medium ${count > 50 ? 'text-red-600' : 'text-slate-500'}`}>
                      {count} URL{count !== 1 ? 's' : ''}{count > 50 ? ' — max 50' : ''}
                    </p>
                  )
                })()}
              </div>
            </>
          ) : (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg px-4 py-8 text-center cursor-pointer transition-colors"
              >
                {csvEntries.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">{csvFilename}</p>
                    <p className="text-xs text-slate-500 mt-1">{csvEntries.length} URL{csvEntries.length !== 1 ? 's' : ''} loaded</p>
                    <p className="text-xs text-blue-600 mt-2">Click to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600">Click to upload a CSV file</p>
                    <p className="text-xs text-slate-400 mt-1">Columns: url, ad_name, ad_set_name, campaign_name (header optional)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Download sample CSV template
              </button>
              {csvEntries.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {csvEntries.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs font-mono text-slate-600 truncate">{e.url}</p>
                  ))}
                  {csvEntries.length > 5 && (
                    <p className="text-xs text-slate-400 mt-1">…and {csvEntries.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}
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
            Campaign Details (optional — enables naming convention &amp; benchmark checks)
          </summary>
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
              <input
                {...field('campaign_name')}
                placeholder="e.g. meta_conversion_lookalike_spring_Q2_2025"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Used for naming convention validation</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
          </div>
        </details>

        {error && (
          error.toLowerCase().includes('limit reached') || error.toLowerCase().includes('upgrade') ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-amber-900 mb-1">Free plan limit reached</p>
              <p className="text-xs text-amber-700 mb-3">{error}</p>
              <div className="flex gap-2">
                <Link
                  to="/settings"
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Upgrade to Pro →
                </Link>
                <Link
                  to="/dashboard"
                  className="text-xs text-slate-600 hover:text-slate-800 font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )
        )}

        <button
          type="submit"
          disabled={loading || (!!usageInfo && usageInfo.used >= usageInfo.limit)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
        >
          {loading ? 'Running QA checks...' : 'Run QA Check →'}
        </button>
      </form>
    </div>
  )
}
