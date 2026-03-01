import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { RunReport, CheckResult } from '@/lib/api'
import { ScoreGauge } from '@/components/ScoreGauge'
import { cn } from '@/lib/utils'

type DiffStatus = 'improved' | 'regressed' | 'unchanged' | 'new'

interface CheckDiff {
  checkId: string
  checkName: string
  checkCategory: string
  severity: string
  statusA: string | null
  statusB: string | null
  diff: DiffStatus
}

const STATUS_RANK: Record<string, number> = { passed: 3, warning: 2, skipped: 1, error: 0, failed: 0 }

function diffChecks(a: CheckResult[], b: CheckResult[]): CheckDiff[] {
  const aMap = new Map(a.map(c => [c.check_id, c]))
  const bMap = new Map(b.map(c => [c.check_id, c]))

  const allIds = new Set([...aMap.keys(), ...bMap.keys()])
  const diffs: CheckDiff[] = []

  for (const id of allIds) {
    const ca = aMap.get(id)
    const cb = bMap.get(id)
    const rankA = ca ? (STATUS_RANK[ca.status] ?? 0) : -1
    const rankB = cb ? (STATUS_RANK[cb.status] ?? 0) : -1

    let diff: DiffStatus = 'unchanged'
    if (rankA === -1) diff = 'new'
    else if (rankB > rankA) diff = 'improved'
    else if (rankB < rankA) diff = 'regressed'

    diffs.push({
      checkId: id,
      checkName: cb?.check_name ?? ca?.check_name ?? id,
      checkCategory: cb?.check_category ?? ca?.check_category ?? '',
      severity: cb?.severity ?? ca?.severity ?? 'minor',
      statusA: ca?.status ?? null,
      statusB: cb?.status ?? null,
      diff,
    })
  }

  // Sort: regressed first, then improved, then unchanged
  const order: Record<DiffStatus, number> = { regressed: 0, improved: 1, new: 2, unchanged: 3 }
  return diffs.sort((a, b) => order[a.diff] - order[b.diff])
}

const STATUS_PILL: Record<string, string> = {
  passed:  'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-slate-100 text-slate-400',
  error:   'bg-orange-100 text-orange-700',
}

const DIFF_BADGE: Record<DiffStatus, { label: string; cls: string }> = {
  improved:  { label: '▲ Improved',  cls: 'bg-green-50 text-green-700 border-green-200' },
  regressed: { label: '▼ Regressed', cls: 'bg-red-50 text-red-700 border-red-200' },
  new:       { label: '★ New check', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  unchanged: { label: '— Same',      cls: 'bg-slate-50 text-slate-400 border-slate-200' },
}

function ScoreSummaryCard({ report, label }: { report: RunReport; label: string }) {
  const { summary } = report
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{label}</p>
      <p className="font-bold text-slate-900 text-lg truncate mb-1">{report.run_name}</p>
      <p className="text-xs text-slate-400 mb-5">
        {report.platform.toUpperCase()} · {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <div className="flex items-center gap-6">
        <ScoreGauge score={summary.readiness_score} size="sm" />
        <div className="space-y-1 text-sm">
          <p><span className="text-green-600 font-semibold">{summary.passed}</span> <span className="text-slate-500">passed</span></p>
          <p><span className="text-red-600 font-semibold">{summary.failed}</span> <span className="text-slate-500">failed</span></p>
          <p><span className="text-yellow-600 font-semibold">{summary.warnings}</span> <span className="text-slate-500">warnings</span></p>
        </div>
      </div>
    </div>
  )
}

function ScoreDeltaBadge({ a, b }: { a: RunReport; b: RunReport }) {
  const delta = Math.round(b.summary.readiness_score - a.summary.readiness_score)
  if (delta === 0) return <span className="text-slate-400 text-sm font-medium">No score change</span>
  const positive = delta > 0
  return (
    <span className={cn('text-sm font-bold px-3 py-1 rounded-full', positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
      {positive ? '▲' : '▼'} {Math.abs(delta)} pts
    </span>
  )
}

export default function ComparePage() {
  const [params] = useSearchParams()
  const runA = params.get('a')
  const runB = params.get('b')

  const [reportA, setReportA] = useState<RunReport | null>(null)
  const [reportB, setReportB] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUnchanged, setShowUnchanged] = useState(false)

  useEffect(() => {
    if (!runA || !runB) {
      setError('Two run IDs are required: /compare?a=<id>&b=<id>')
      setLoading(false)
      return
    }
    Promise.all([api.getReport(runA), api.getReport(runB)])
      .then(([a, b]) => { setReportA(a); setReportB(b) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [runA, runB])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading comparison...
      </div>
    )
  }

  if (error || !reportA || !reportB) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Could not load reports'}</p>
          <Link to="/dashboard" className="text-blue-600 underline">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const diffs = diffChecks(reportA.checks, reportB.checks)
  const improved  = diffs.filter(d => d.diff === 'improved').length
  const regressed = diffs.filter(d => d.diff === 'regressed').length
  const unchanged = diffs.filter(d => d.diff === 'unchanged').length

  const visibleDiffs = showUnchanged ? diffs : diffs.filter(d => d.diff !== 'unchanged')

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        <h1 className="text-lg font-bold text-slate-900">Run Comparison</h1>
        <div />
      </div>

      {/* Score cards */}
      <div className="flex gap-4 mb-6 flex-col sm:flex-row">
        <ScoreSummaryCard report={reportA} label="Before (A)" />
        <div className="flex items-center justify-center px-2">
          <ScoreDeltaBadge a={reportA} b={reportB} />
        </div>
        <ScoreSummaryCard report={reportB} label="After (B)" />
      </div>

      {/* Change summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl py-3 text-center">
          <p className="text-2xl font-black text-green-600">{improved}</p>
          <p className="text-xs text-green-600 font-medium">Improved</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl py-3 text-center">
          <p className="text-2xl font-black text-red-600">{regressed}</p>
          <p className="text-xs text-red-600 font-medium">Regressed</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl py-3 text-center">
          <p className="text-2xl font-black text-slate-400">{unchanged}</p>
          <p className="text-xs text-slate-400 font-medium">Unchanged</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-700">Check-by-check diff</p>
        <button
          onClick={() => setShowUnchanged(v => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showUnchanged ? 'Hide unchanged' : `Show all (${unchanged} unchanged)`}
        </button>
      </div>

      {/* Diff table */}
      <div className="space-y-2">
        {visibleDiffs.map(d => {
          const badge = DIFF_BADGE[d.diff]
          return (
            <div
              key={d.checkId}
              className={cn(
                'bg-white rounded-xl border px-4 py-3 flex items-center gap-4',
                d.diff === 'regressed' ? 'border-red-200' : d.diff === 'improved' ? 'border-green-200' : 'border-slate-200',
              )}
            >
              {/* Severity dot */}
              <div className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                d.severity === 'critical' ? 'bg-red-500' : d.severity === 'major' ? 'bg-orange-400' : 'bg-slate-300',
              )} title={d.severity} />

              {/* Check name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{d.checkName}</p>
                <p className="text-xs text-slate-400 capitalize">{d.checkCategory}</p>
              </div>

              {/* Status A */}
              <div className="text-right flex-shrink-0 w-20">
                {d.statusA ? (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_PILL[d.statusA] || STATUS_PILL.skipped)}>
                    {d.statusA}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Arrow */}
              <span className="text-slate-300 text-sm flex-shrink-0">→</span>

              {/* Status B */}
              <div className="text-right flex-shrink-0 w-20">
                {d.statusB ? (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_PILL[d.statusB] || STATUS_PILL.skipped)}>
                    {d.statusB}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Diff badge */}
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0', badge.cls)}>
                {badge.label}
              </span>
            </div>
          )
        })}
        {visibleDiffs.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            All checks have the same result — no changes detected between these runs.
          </div>
        )}
      </div>
    </div>
  )
}
