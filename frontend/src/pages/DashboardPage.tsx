import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { ScoreGauge } from '@/components/ScoreGauge'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface RunRow {
  id: string
  run_name: string
  platform: string
  status: string
  readiness_score: number | null
  passed_checks: number | null
  failed_checks: number | null
  total_checks: number | null
  warning_checks: number | null
  created_at: string
  completed_at: string | null
  share_token: string | null
  is_public: boolean
}

const statusPill: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  running:   'bg-blue-100 text-blue-700',
  failed:    'bg-red-100 text-red-700',
  pending:   'bg-slate-100 text-slate-500',
}

const PLATFORM_EMOJI: Record<string, string> = {
  meta: '📘', google: '🔵', tiktok: '🎵', linkedin: '💼', multi: '🌐', universal: '🌐',
}

const PLAN_BADGE: Record<string, string> = {
  pro:    'bg-blue-100 text-blue-700',
  agency: 'bg-indigo-100 text-indigo-700',
}

/** SVG sparkline for score trend */
function ScoreTrend({ runs }: { runs: RunRow[] }) {
  const scored = runs
    .filter(r => r.status === 'completed' && r.readiness_score !== null)
    .slice(0, 20).reverse()

  if (scored.length < 2) return null

  const scores = scored.map(r => r.readiness_score as number)
  const W = 120, H = 36, PAD = 4
  const minS = Math.min(...scores), maxS = Math.max(...scores)
  const range = maxS - minS || 1

  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((s - minS) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const latest = scores[scores.length - 1]
  const delta  = latest - scores[scores.length - 2]
  const color  = delta >= 0 ? '#22c55e' : '#ef4444'
  const [lx, ly] = pts[pts.length - 1].split(',').map(Number)

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-4">
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-0.5">Score trend · {scored.length} runs</p>
        <p className={cn('text-sm font-semibold', delta >= 0 ? 'text-green-600' : 'text-red-600')}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} pts from last run
        </p>
      </div>
      <svg width={W} height={H} className="flex-shrink-0">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r="3" fill={color} />
      </svg>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-400">Latest</p>
        <p className="text-2xl font-black" style={{ color }}>{Math.round(latest)}</p>
      </div>
    </div>
  )
}

/** Floating context menu for a run row */
function RunMenu({
  runId,
  runStatus,
  shareToken,
  allRuns,
  onDelete,
}: {
  runId: string
  runStatus: string
  shareToken: string | null
  allRuns: RunRow[]
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const otherCompleted = allRuns.filter(r => r.id !== runId && r.status === 'completed')

  const handleRerun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRerunning(true)
    setOpen(false)
    try {
      const res = await api.rerun(runId)
      navigate(`/runs/${res.run_id}`)
    } catch {
      setRerunning(false)
    }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={e => e.preventDefault()}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={rerunning}
        className="text-slate-300 hover:text-slate-500 px-1 text-lg leading-none disabled:opacity-40"
        aria-label="Run options"
      >
        {rerunning ? '…' : '⋯'}
      </button>
      {open && (
        <div className="absolute right-0 top-7 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 min-w-[160px]">
          {!confirming ? (
            <>
              {runStatus === 'completed' && (
                <button
                  onClick={handleRerun}
                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                >
                  ↺ Re-run checks
                </button>
              )}
              {runStatus === 'completed' && shareToken && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    let url: string
                    try {
                      const res = await api.toggleShare(runId, true)
                      void res
                      url = `${window.location.origin}/reports/share/${shareToken}`
                    } catch {
                      url = `${window.location.origin}/reports/share/${shareToken}`
                    }
                    await navigator.clipboard.writeText(url)
                    setCopyMsg('Copied!')
                    setTimeout(() => { setCopyMsg(''); setOpen(false) }, 1500)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {copyMsg || '🔗 Copy share link'}
                </button>
              )}
              {runStatus === 'completed' && otherCompleted.length > 0 && (
                <div className="border-b border-slate-100 pb-1 mb-1">
                  <p className="text-xs text-slate-400 px-4 pt-1 pb-0.5 font-medium">Compare with:</p>
                  {otherCompleted.slice(0, 5).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { navigate(`/compare?a=${runId}&b=${r.id}`); setOpen(false) }}
                      className="w-full text-left px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 truncate"
                    >
                      {r.run_name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setConfirming(true)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Delete run
              </button>
            </>
          ) : (
            <div className="px-4 py-2">
              <p className="text-xs text-slate-600 mb-2">Delete this run?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(runId); setOpen(false) }}
                  className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirming(false); setOpen(false) }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  useEffect(() => { document.title = 'Dashboard — LaunchProof' }, [])
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradingPlan, setUpgradingPlan] = useState<'pro' | 'agency' | null>(null)
  const [upgradeError, setUpgradeError] = useState('')
  const [planTier, setPlanTier] = useState<string>('free')
  const [reportsUsed, setReportsUsed] = useState<number | null>(null)
  const [reportsLimit, setReportsLimit] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const justUpgraded = searchParams.get('upgraded') === '1'

  // Clean the ?upgraded=1 param from URL after a short delay so it doesn't persist on refresh
  useEffect(() => {
    if (!justUpgraded) return
    const t = setTimeout(() => {
      setSearchParams(p => { p.delete('upgraded'); return p }, { replace: true })
    }, 4000)
    return () => clearTimeout(t)
  }, [justUpgraded, setSearchParams])

  // After Stripe checkout, webhook processing is async — re-poll profile until plan_tier upgrades
  useEffect(() => {
    if (!justUpgraded) return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const p = await api.getProfile()
        if (p.plan_tier !== 'free') {
          setPlanTier(p.plan_tier)
          clearInterval(poll)
        }
      } catch { /* ignore */ }
      if (attempts >= 8) clearInterval(poll) // stop after ~16s
    }, 2000)
    return () => clearInterval(poll)
  }, [justUpgraded])

  useEffect(() => {
    api.listRuns().then(data => setRuns(data as RunRow[])).finally(() => setLoading(false))
    api.getProfile().then(p => {
      setPlanTier(p.plan_tier)
      setReportsUsed(p.reports_used)
      setReportsLimit(p.reports_limit)
    }).catch(() => {})
  }, [])

  // 'N' shortcut → new run (only when not focused on an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'n' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.metaKey && !e.ctrlKey) {
        navigate('/new')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const handleUpgrade = async (plan: 'pro' | 'agency') => {
    setUpgradeError('')
    setUpgradingPlan(plan)
    try {
      const { checkout_url } = await api.createCheckoutSession(plan)
      window.location.href = checkout_url
    } catch (err: unknown) {
      setUpgradeError(err instanceof Error ? err.message : 'Could not start checkout')
      setUpgradingPlan(null)
    }
  }

  const handleDelete = async (runId: string) => {
    try {
      await api.deleteRun(runId)
      setRuns(prev => prev.filter(r => r.id !== runId))
    } catch {
      // silent — run stays in list
    }
  }

  const handleExportCsv = () => {
    const headers = ['Run Name', 'Platform', 'Status', 'Score', 'Passed', 'Failed', 'Warnings', 'Total Checks', 'Created', 'Completed']
    const rows = runs.map(r => [
      `"${r.run_name.replace(/"/g, '""')}"`,
      r.platform,
      r.status,
      r.readiness_score !== null ? Math.round(r.readiness_score) : '',
      r.passed_checks ?? '',
      r.failed_checks ?? '',
      r.warning_checks ?? '',
      r.total_checks ?? '',
      new Date(r.created_at).toISOString(),
      r.completed_at ? new Date(r.completed_at).toISOString() : '',
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `launchproof-runs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRowClick = (run: RunRow) => {
    navigate(run.status === 'completed' ? `/runs/${run.id}/report` : `/runs/${run.id}`)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">LaunchProof</h1>
          {planTier !== 'free' && (
            <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize', PLAN_BADGE[planTier])}>
              {planTier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/checks" className="text-sm text-slate-500 hover:text-slate-700">Checks</Link>
          {planTier !== 'free' && (
            <Link to="/api-docs" className="text-sm text-slate-500 hover:text-slate-700">API</Link>
          )}
          <Link to="/settings" className="text-sm text-slate-500 hover:text-slate-700">Settings</Link>
          {planTier === 'free' && reportsUsed !== null && reportsLimit !== null && reportsUsed >= reportsLimit ? (
            <Link
              to="/settings"
              title="Free plan limit reached — upgrade to continue"
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Upgrade to run more →
            </Link>
          ) : (
            <Link
              to="/new"
              title="Shortcut: N"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              + New QA Run
            </Link>
          )}
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">Sign out</button>
        </div>
      </div>

      {upgradeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {upgradeError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading your runs...</div>
      ) : runs.length === 0 ? (
        <div>
          {justUpgraded && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  You're all set! Welcome to LaunchProof {planTier === 'agency' ? 'Agency' : 'Pro'}.
                </p>
                <p className="text-xs text-green-600 mt-0.5">Unlimited runs, client-shareable reports, and API access are now active.</p>
              </div>
            </div>
          )}
          <div className="text-center py-20">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No QA runs yet</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Run your first pre-launch QA check to catch UTM errors, broken links, and ad copy issues before they cost you money.
          </p>
          <Link to="/new" className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
            Run your first QA check →
          </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Run count + CSV export */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{runs.length} run{runs.length !== 1 ? 's' : ''}</p>
            <button
              onClick={handleExportCsv}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              title="Download all runs as CSV"
            >
              Export CSV ↓
            </button>
          </div>

          {/* Post-checkout success banner */}
          {justUpgraded && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  You're all set! Welcome to LaunchProof {planTier === 'agency' ? 'Agency' : 'Pro'}.
                </p>
                <p className="text-xs text-green-600 mt-0.5">Unlimited runs, client-shareable reports, and API access are now active.</p>
              </div>
            </div>
          )}

          <ScoreTrend runs={runs} />

          {/* Upgrade banner — only shown to free users */}
          {planTier === 'free' && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white mb-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Upgrade for client sharing &amp; team access</p>
                  <p className="text-blue-100 text-sm mt-0.5">
                    Share QA reports with clients · Bulk CSV · Priority checks
                    {reportsUsed !== null && reportsLimit !== null && (
                      <span className="ml-2 text-blue-200">· {reportsUsed}/{reportsLimit} free runs used</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={upgradingPlan !== null}
                    className="bg-white text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60 transition-colors"
                  >
                    {upgradingPlan === 'pro' ? 'Redirecting…' : 'Pro — $29/mo'}
                  </button>
                  <button
                    onClick={() => handleUpgrade('agency')}
                    disabled={upgradingPlan !== null}
                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    {upgradingPlan === 'agency' ? 'Redirecting…' : 'Agency — $79/mo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Platform filter tabs — shown when 2+ distinct platforms */}
          {(() => {
            const platforms = [...new Set(runs.map(r => r.platform))]
            if (platforms.length < 2) return null
            const tabs = [{ id: 'all', label: 'All' }, ...platforms.map(p => ({ id: p, label: (PLATFORM_EMOJI[p] || '') + ' ' + p.charAt(0).toUpperCase() + p.slice(1) }))]
            return (
              <div className="flex gap-2 mb-4 flex-wrap">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setPlatformFilter(t.id)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                      platformFilter === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Search */}
          {runs.length > 3 && (
            <div className="mb-4">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search runs by name or platform…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Run list */}
          <div className="space-y-3">
            {runs.filter(r =>
              (platformFilter === 'all' || r.platform === platformFilter) &&
              (!search || r.run_name.toLowerCase().includes(search.toLowerCase()) || r.platform.toLowerCase().includes(search.toLowerCase()))
            ).map(run => (
              <div
                key={run.id}
                onClick={() => handleRowClick(run)}
                className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-5">
                  <div className="w-24 flex-shrink-0">
                    {run.readiness_score !== null ? (
                      <ScoreGauge score={run.readiness_score} size="sm" />
                    ) : (
                      <div className="text-center">
                        <div className="text-2xl font-black text-slate-300">–</div>
                        <div className="text-xs text-slate-400">No score</div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{PLATFORM_EMOJI[run.platform] || '📊'}</span>
                      <h3 className="font-semibold text-slate-900 truncate">{run.run_name}</h3>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', statusPill[run.status] || statusPill.pending)}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(run.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {run.passed_checks !== null && (
                        <span className="ml-3">
                          <span className="text-green-600">{run.passed_checks} passed</span>
                          {run.failed_checks ? <span className="text-red-600 ml-2">{run.failed_checks} failed</span> : null}
                          {run.warning_checks ? <span className="text-yellow-600 ml-2">{run.warning_checks} warned</span> : null}
                          {run.total_checks ? <span className="text-slate-400 ml-2">/ {run.total_checks} checks</span> : null}
                        </span>
                      )}
                    </div>
                  </div>
                  <RunMenu runId={run.id} runStatus={run.status} shareToken={run.share_token} allRuns={runs} onDelete={handleDelete} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
