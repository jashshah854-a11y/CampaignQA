import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  created_at: string
  completed_at: string | null
}

const statusPill: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  running:   'bg-blue-100 text-blue-700',
  failed:    'bg-red-100 text-red-700',
  pending:   'bg-slate-100 text-slate-500',
}

const PLATFORM_EMOJI: Record<string, string> = {
  meta: '📘',
  google: '🔵',
  tiktok: '🎵',
  linkedin: '💼',
  multi: '🌐',
  universal: '🌐',
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listRuns().then(data => {
      setRuns(data as RunRow[])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Nav */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CampaignQA</h1>
          <p className="text-slate-500 text-sm">{user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            + New QA Run
          </Link>
          <button
            onClick={signOut}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading your runs...</div>
      ) : runs.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No QA runs yet</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Run your first pre-launch QA check to catch UTM errors, broken links, and ad copy issues before they cost you money.
          </p>
          <Link
            to="/new"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Run your first QA check →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map(run => (
            <Link
              key={run.id}
              to={run.status === 'completed' ? `/runs/${run.id}/report` : `/runs/${run.id}`}
              className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-5">
                {/* Score */}
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{PLATFORM_EMOJI[run.platform] || '📊'}</span>
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
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-slate-300 flex-shrink-0">→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
