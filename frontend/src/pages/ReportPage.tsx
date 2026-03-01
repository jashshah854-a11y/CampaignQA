import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { RunReport, CheckResult } from '@/lib/api'
import { CheckCard } from '@/components/CheckCard'
import { ScoreGauge } from '@/components/ScoreGauge'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  utm: 'UTM Parameters',
  url: 'URL Structure',
  creative: 'Ad Creative',
  budget: 'Budget',
  tracking: 'Tracking',
  audience: 'Audience',
}

export default function ReportPage({ shared = false }: { shared?: boolean }) {
  const { runId, token } = useParams<{ runId?: string; token?: string }>()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [shareMsg, setShareMsg] = useState('')

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = shared && token
          ? await api.getSharedReport(token)
          : await api.getReport(runId!)
        setReport(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [runId, token, shared])

  const handleEnableShare = async () => {
    if (!report || !runId) return
    try {
      await api.toggleShare(runId, true)
      const newReport = await api.getReport(runId)
      setReport(newReport)
      if (newReport.shareable_url) {
        await navigator.clipboard.writeText(newReport.shareable_url)
        setShareMsg('Link copied!')
        setTimeout(() => setShareMsg(''), 3000)
      }
    } catch {
      setShareMsg('Could not enable sharing')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading report...</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Report not found'}</p>
          <Link to="/dashboard" className="text-blue-600 underline">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const { summary, checks } = report

  // Filter checks
  const filteredChecks: CheckResult[] = checks.filter(c => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'failed') return c.status === 'failed'
    if (activeFilter === 'warning') return c.status === 'warning'
    return c.check_category === activeFilter
  })

  // Category tabs
  const categories = [...new Set(checks.map(c => c.check_category))]

  const failedCount = checks.filter(c => c.status === 'failed').length
  const warningCount = checks.filter(c => c.status === 'warning').length

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          {!shared && (
            <Link to="/dashboard" className="text-sm text-blue-600 hover:underline mb-2 block">
              ← Back to dashboard
            </Link>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{report.run_name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {report.platform.toUpperCase()} · {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {!shared && (
          <div className="text-right flex flex-col items-end gap-2">
            <div className="flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors"
                title="Save as PDF via your browser's Print dialog"
              >
                Export PDF
              </button>
              <button
                onClick={handleEnableShare}
                className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Share Report
              </button>
            </div>
            {shareMsg && <p className="text-xs text-green-600">{shareMsg}</p>}
          </div>
        )}
      </div>

      {/* Score + summary strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-8">
          <div className="flex-shrink-0 w-40">
            <ScoreGauge score={summary.readiness_score} size="lg" />
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-xl py-4">
              <div className="text-3xl font-black text-green-600">{summary.passed}</div>
              <div className="text-xs text-green-600 font-medium mt-1">Passed</div>
            </div>
            <div className="bg-red-50 rounded-xl py-4">
              <div className="text-3xl font-black text-red-600">{summary.failed}</div>
              <div className="text-xs text-red-600 font-medium mt-1">Failed</div>
            </div>
            <div className="bg-yellow-50 rounded-xl py-4">
              <div className="text-3xl font-black text-yellow-600">{summary.warnings}</div>
              <div className="text-xs text-yellow-600 font-medium mt-1">Warnings</div>
            </div>
          </div>
        </div>

        {/* Critical failures alert */}
        {summary.critical_failures.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm font-semibold text-red-800 mb-1">
              ⚠ {summary.critical_failures.length} critical issue{summary.critical_failures.length > 1 ? 's' : ''} must be fixed before launch
            </p>
            <ul className="text-xs text-red-700 space-y-0.5">
              {summary.critical_failures.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">By Category</h3>
        <div className="space-y-3">
          {Object.entries(summary.by_category).map(([cat, counts]) => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0)
            const passed = counts.passed || 0
            const pct = total > 0 ? Math.round((passed / total) * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-28 text-xs font-medium text-slate-600">{CATEGORY_LABELS[cat] || cat}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full', pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 w-12 text-right">{passed}/{total}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Check list with filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700">All Checks</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: `All (${checks.length})` },
              failedCount > 0 && { id: 'failed', label: `Failed (${failedCount})` },
              warningCount > 0 && { id: 'warning', label: `Warnings (${warningCount})` },
              ...categories.map(c => ({ id: c, label: CATEGORY_LABELS[c] || c })),
            ].filter(Boolean).map((f) => {
              const item = f as { id: string; label: string }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveFilter(item.id)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                    activeFilter === item.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          {filteredChecks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No checks match this filter</p>
          ) : (
            filteredChecks.map(c => <CheckCard key={c.check_id} check={c} />)
          )}
        </div>
      </div>

      {/* CTA for shared reports */}
      {shared && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-blue-900 mb-1">Want to QA your own campaigns?</p>
          <p className="text-xs text-blue-700 mb-4">Check UTM parameters, ad copy limits, and URL health before every launch.</p>
          <Link
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            Try CampaignQA Free →
          </Link>
        </div>
      )}
    </div>
  )
}
