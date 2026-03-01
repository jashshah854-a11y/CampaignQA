import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useRunPoller } from '@/hooks/useRunPoller'
import { api } from '@/lib/api'

const PHASE_MESSAGES = [
  'Parsing UTM parameters…',
  'Validating URL structure…',
  'Checking ad copy character limits…',
  'Verifying naming conventions…',
  'Testing URL reachability…',
  'Checking SSL certificates…',
  'Detecting tracking pixels…',
  'Scanning for policy violations…',
  'Running VirusTotal domain checks…',
  'Checking OG tags and mobile readiness…',
  'Calculating readiness score…',
]

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const { status, done } = useRunPoller(runId ?? null)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [retrying, setRetrying] = useState(false)

  // Cycle through phase messages every 2.5s for a sense of progress
  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIdx(i => (i + 1) % PHASE_MESSAGES.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (done && status?.status === 'completed') {
      navigate(`/runs/${runId}/report`)
    }
  }, [done, status, runId, navigate])

  const handleRetry = async () => {
    if (!runId) return
    setRetrying(true)
    try {
      const res = await api.rerun(runId)
      navigate(`/runs/${res.run_id}`)
    } catch {
      setRetrying(false)
    }
  }

  const progress = status?.progress_pct ?? 0
  const failed = status?.status === 'failed'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          {failed ? (
            <>
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">QA Run Failed</h2>
              <p className="text-slate-500 text-sm mb-6">
                Something went wrong during the checks. You can retry with the same URLs.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
                >
                  {retrying ? 'Starting…' : 'Retry Run'}
                </button>
                <Link
                  to="/new"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
                >
                  New Run
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Animated spinner */}
              <div className="w-16 h-16 mx-auto mb-6 relative">
                <svg className="animate-spin w-full h-full text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Running QA Checks</h2>
              <p className="text-slate-500 text-sm mb-1 h-5 transition-all">
                {PHASE_MESSAGES[phaseIdx]}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 my-5">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mb-6">{progress}% complete</p>

              {/* Live stats */}
              {status && (status.passed_checks !== undefined || status.failed_checks !== undefined) && (
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
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
            </>
          )}
        </div>

        <p className="text-center mt-4">
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
