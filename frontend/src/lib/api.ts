import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL as string

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeader()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) {
      // Session expired — redirect to login
      window.location.href = '/login'
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export interface UrlInput {
  url: string
  ad_name?: string
  ad_set_name?: string
  campaign_name?: string
}

export interface CreateRunPayload {
  run_name: string
  platform: string
  urls: UrlInput[]
  campaign_name?: string
  campaign_objective?: string
  industry_vertical?: string
  headline?: string
  primary_text?: string
  description?: string
}

export interface CheckResult {
  check_id: string
  check_name: string
  check_category: string
  platform: string
  status: 'passed' | 'failed' | 'warning' | 'skipped' | 'error'
  severity: 'critical' | 'major' | 'minor'
  message: string
  recommendation?: string
  affected_items: string[]
  execution_ms: number
}

export interface RunStatus {
  run_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress_pct: number
  readiness_score?: number
  total_checks?: number
  passed_checks?: number
  failed_checks?: number
  warning_checks?: number
}

export interface ReportSummary {
  readiness_score: number
  passed: number
  failed: number
  warnings: number
  errors: number
  by_category: Record<string, Record<string, number>>
  critical_failures: string[]
}

export interface RunReport {
  run_id: string
  run_name: string
  platform: string
  status: string
  created_at: string
  completed_at?: string
  summary: ReportSummary
  checks: CheckResult[]
  urls: { id: string; raw_url: string; ad_name?: string; ad_set_name?: string; campaign_name?: string }[]
  shareable_url?: string
  notes?: string
  is_public?: boolean
  schedule_interval?: string | null
  branding?: { company_name?: string; logo_url?: string } | null
}

export interface CreateRunResponse {
  run_id: string
  status: string
  tier1_results: CheckResult[]
  message: string
}

export const api = {
  createRun: (payload: CreateRunPayload) =>
    apiFetch<CreateRunResponse>('/api/v1/runs', { method: 'POST', body: JSON.stringify(payload) }),

  getRunStatus: (runId: string) =>
    apiFetch<RunStatus>(`/api/v1/runs/${runId}/status`),

  getReport: (runId: string) =>
    apiFetch<RunReport>(`/api/v1/runs/${runId}/report`),

  listRuns: () =>
    apiFetch<unknown[]>('/api/v1/runs'),

  toggleShare: (runId: string, isPublic: boolean) =>
    apiFetch<{ run_id: string; is_public: boolean; shareable_url: string | null }>(`/api/v1/runs/${runId}/share`, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) }),

  getSharedReport: async (token: string): Promise<RunReport> => {
    const r = await fetch(`${BASE_URL}/api/v1/reports/share/${token}`)
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw new Error(err.detail || `API error ${r.status}`)
    }
    return r.json()
  },

  rerun: (runId: string) =>
    apiFetch<CreateRunResponse>(`/api/v1/runs/${runId}/rerun`, { method: 'POST' }),

  deleteRun: (runId: string) =>
    apiFetch<void>(`/api/v1/runs/${runId}`, { method: 'DELETE' }),

  updateRun: (runId: string, data: { notes?: string; schedule_interval?: string | null }) =>
    apiFetch<{ status: string }>(`/api/v1/runs/${runId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getProfile: () =>
    apiFetch<{ id: string; email: string; full_name: string | null; company_name: string | null; logo_url: string | null; slack_webhook_url: string | null; webhook_url: string | null; plan_tier: string; reports_used: number; reports_limit: number; created_at: string }>('/api/v1/profile'),

  updateProfile: (data: { full_name?: string; company_name?: string; logo_url?: string; slack_webhook_url?: string; webhook_url?: string }) =>
    apiFetch<{ status: string }>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  testWebhook: () =>
    apiFetch<{ status: string; webhook_url: string }>('/api/v1/profile/webhook/test', { method: 'POST' }),

  createCheckoutSession: (plan: 'pro' | 'agency') =>
    apiFetch<{ checkout_url: string }>('/api/v1/stripe/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        plan,
        success_url: `${window.location.origin}/dashboard?upgraded=1`,
        cancel_url: `${window.location.origin}/dashboard`,
      }),
    }),

  createBillingPortalSession: () =>
    apiFetch<{ portal_url: string }>('/api/v1/stripe/billing-portal', {
      method: 'POST',
      body: JSON.stringify({ return_url: `${window.location.origin}/settings` }),
    }),

  // ── Benchmark ─────────────────────────────────────────────────────────────
  getBenchmark: (platform: string, industryVertical?: string) => {
    const params = new URLSearchParams({ platform })
    if (industryVertical) params.set('industry_vertical', industryVertical)
    return apiFetch<{ check_id: string; check_category: string; pass_rate_pct: number }[]>(`/api/v1/benchmark?${params}`)
  },

  // ── API Keys ──────────────────────────────────────────────────────────────
  listApiKeys: () =>
    apiFetch<{ id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null }[]>('/api/v1/api-keys'),

  createApiKey: (name: string) =>
    apiFetch<{ key: string; prefix: string; name: string; message: string }>('/api/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteApiKey: (id: string) =>
    apiFetch<void>(`/api/v1/api-keys/${id}`, { method: 'DELETE' }),
}
