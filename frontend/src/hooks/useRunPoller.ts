import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { RunStatus } from '@/lib/api'

export function useRunPoller(runId: string | null) {
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [done, setDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!runId) return

    const poll = async () => {
      try {
        const s = await api.getRunStatus(runId)
        setStatus(s)
        if (s.status === 'completed' || s.status === 'failed') {
          setDone(true)
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {
        // silently retry on transient errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runId])

  return { status, done }
}
