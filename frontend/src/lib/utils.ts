import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

export function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200'
  if (score >= 60) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export function statusIcon(status: string): string {
  switch (status) {
    case 'passed': return '✓'
    case 'failed': return '✗'
    case 'warning': return '⚠'
    case 'skipped': return '–'
    case 'error': return '!'
    default: return '?'
  }
}

export function severityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'CRITICAL'
    case 'major': return 'MAJOR'
    case 'minor': return 'MINOR'
    default: return severity.toUpperCase()
  }
}
