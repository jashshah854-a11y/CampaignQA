import type { CheckResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const statusStyles: Record<string, string> = {
  passed:  'bg-green-50 border-green-200',
  failed:  'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  skipped: 'bg-slate-50 border-slate-200',
  error:   'bg-orange-50 border-orange-200',
}

const statusBadge: Record<string, string> = {
  passed:  'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-slate-100 text-slate-500',
  error:   'bg-orange-100 text-orange-700',
}

const severityBadge: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  major:    'bg-orange-500 text-white',
  minor:    'bg-slate-400 text-white',
}

const statusIcon: Record<string, string> = {
  passed:  '✓',
  failed:  '✗',
  warning: '⚠',
  skipped: '–',
  error:   '!',
}

export function CheckCard({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(check.status === 'failed')

  return (
    <div
      className={cn('border rounded-xl p-4 cursor-pointer transition-all', statusStyles[check.status])}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', statusBadge[check.status])}>
            {statusIcon[check.status]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{check.check_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{check.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', severityBadge[check.severity])}>
            {check.severity.toUpperCase()}
          </span>
          <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-10 space-y-2">
          {check.recommendation && (
            <div className="bg-white bg-opacity-60 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-slate-700 mb-0.5">How to fix</p>
              <p className="text-xs text-slate-600">{check.recommendation}</p>
            </div>
          )}
          {check.affected_items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Affected items ({check.affected_items.length})</p>
              <ul className="space-y-1">
                {check.affected_items.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-xs font-mono text-slate-600 bg-white bg-opacity-50 rounded px-2 py-1 truncate">
                    {item}
                  </li>
                ))}
                {check.affected_items.length > 5 && (
                  <li className="text-xs text-slate-400">+ {check.affected_items.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
