import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRunPoller } from '@/hooks/useRunPoller'

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const { status, done } = useRunPoller(runId ?? null)

  useEffect(() => {
    if (done && status?.status === 'completed') {
      navigate(`/runs/${runId}/report`)
    }
  }, [done, status, runId, navigate])

  const progress = status?.progress_pct ?? 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          {/* Animated spinner */}
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <svg className="animate-spin w-full h-full text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">Running QA Checks</h2>
          <p className="text-slate-500 text-sm mb-6">
            Checking UTM parameters, URL structure, ad copy, and link reachability...
          </p>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{progress}% complete</p>

          {/* Live stats */}
          {status && (status.passed_checks !== undefined || status.failed_checks !== undefined) && (
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg py-2">
                <div className="font-bold text-green-700">{status.passed_checks ?? 0}</div>
                <div className="text-green-600 text-xs">Passed</div>
              </div>
              <div className="bg-red-50 rounded-lg py-2">
                <div className="font-bold text-red-700">{status.failed_checks ?? 0}</div>
                <div className="text-red-600 text-xs">Failed</div>
              </div>
              <div className="bg-yellow-50 rounded-lg py-2">
                <div className="font-bold text-yellow-700">{status.warning_checks ?? 0}</div>
                <div className="text-yellow-600 text-xs">Warnings</div>
              </div>
            </div>
          )}

          {status?.status === 'failed' && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Run failed. <a href="/new" className="underline font-medium">Try again →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
