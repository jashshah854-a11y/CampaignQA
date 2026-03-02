import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  score: number
  size?: 'sm' | 'lg'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Poor'
  return 'Critical Issues'
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (target === 0) { setDisplay(0); return }
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3)
      setDisplay(Math.round(eased * target))
      if (pct < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}

export function ScoreGauge({ score, size = 'lg' }: Props) {
  const isLarge = size === 'lg'
  const displayScore = useCountUp(score, isLarge ? 700 : 0)  // no animation for small gauges in list

  return (
    <div className={cn('flex flex-col items-center', isLarge ? 'gap-2' : 'gap-1')}>
      <div className={cn('font-black', getScoreColor(score), isLarge ? 'text-6xl' : 'text-3xl')}>
        {isLarge ? displayScore : score.toFixed(0)}
      </div>
      <div className={cn('text-slate-400', isLarge ? 'text-sm' : 'text-xs')}>/ 100</div>
      <div className={cn('font-semibold', getScoreColor(score), isLarge ? 'text-base' : 'text-sm')}>
        {getScoreLabel(score)}
      </div>

      {/* Progress bar */}
      <div className={cn('w-full bg-slate-100 rounded-full', isLarge ? 'h-3 mt-1' : 'h-2')}>
        <div
          className={cn('h-full rounded-full transition-all duration-700', getBarColor(score))}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  )
}
