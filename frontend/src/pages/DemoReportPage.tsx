import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCard } from '@/components/CheckCard'
import { ScoreGauge } from '@/components/ScoreGauge'
import { cn } from '@/lib/utils'
import type { CheckResult } from '@/lib/api'

const CATEGORY_LABELS: Record<string, string> = {
  utm: 'UTM Parameters',
  url: 'URL Structure',
  creative: 'Ad Creative',
  tracking: 'Tracking',
}

const DEMO_CHECKS: CheckResult[] = [
  // Failed — critical
  {
    check_id: 'pixel_platform_present',
    check_name: 'Platform Pixel Present',
    check_category: 'tracking',
    platform: 'meta',
    status: 'failed',
    severity: 'critical',
    message: 'Facebook Pixel (fbq) not detected on example.com/shop. Conversions will not be tracked in Meta Ads Manager.',
    recommendation: 'Add the Meta Pixel base code to the landing page <head> tag, or install it via Google Tag Manager.',
    affected_items: [
      'https://example.com/shop?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_retargeting&utm_content=carousel_v1',
      'https://example.com/shop?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_retargeting&utm_content=video_v2',
    ],
    execution_ms: 1243,
  },
  // Failed — major
  {
    check_id: 'privacy_policy_present',
    check_name: 'Privacy Policy Link',
    check_category: 'tracking',
    platform: 'meta',
    status: 'failed',
    severity: 'major',
    message: "No privacy policy link found on the landing page. Meta's ad policies require a privacy policy for data-collecting ads.",
    recommendation: 'Add a link to your privacy policy in the footer of the landing page.',
    affected_items: ['example.com/shop'],
    execution_ms: 892,
  },
  // Warnings
  {
    check_id: 'url_redirect_depth',
    check_name: 'Redirect Depth',
    check_category: 'url',
    platform: 'meta',
    status: 'warning',
    severity: 'major',
    message: '3-hop redirect chain detected before the final destination. Each hop adds ~50ms and may cause ad platform link failures.',
    recommendation: 'Use direct destination URLs. Reduce redirect chains to 1 hop maximum.',
    affected_items: ['https://go.example.com/bfcm → https://www.example.com/shop → https://example.com/shop'],
    execution_ms: 1876,
  },
  {
    check_id: 'cookie_consent',
    check_name: 'Cookie Consent (GDPR)',
    check_category: 'tracking',
    platform: 'meta',
    status: 'warning',
    severity: 'minor',
    message: 'No cookie consent management platform (CMP) detected. Required for EU audiences under GDPR.',
    recommendation: 'Add a CMP such as CookieYes, OneTrust, or Cookiebot.',
    affected_items: [],
    execution_ms: 987,
  },
  {
    check_id: 'canonical_tag',
    check_name: 'Canonical Tag',
    check_category: 'url',
    platform: 'meta',
    status: 'warning',
    severity: 'minor',
    message: 'Landing page is missing a canonical tag. UTM-tagged URLs may be indexed as duplicate content.',
    recommendation: 'Add <link rel="canonical" href="https://example.com/shop" /> to the page <head>.',
    affected_items: ['https://example.com/shop'],
    execution_ms: 1102,
  },
  {
    check_id: 'utm_content_term_best_practice',
    check_name: 'UTM Content & Term Best Practices',
    check_category: 'utm',
    platform: 'meta',
    status: 'warning',
    severity: 'minor',
    message: 'utm_content is present but utm_term is not set. Adding utm_term helps identify audience segments in reports.',
    recommendation: 'Add utm_term to identify audience or creative variants (e.g., utm_term=lookalike_30d).',
    affected_items: [],
    execution_ms: 12,
  },
  // Passed
  { check_id: 'utm_source_present', check_name: 'UTM Source Present', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'critical', message: 'utm_source=facebook is present on all 2 URLs.', affected_items: [], execution_ms: 8 },
  { check_id: 'utm_medium_present', check_name: 'UTM Medium Present', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'critical', message: 'utm_medium=paid_social is present on all 2 URLs.', affected_items: [], execution_ms: 6 },
  { check_id: 'utm_campaign_present', check_name: 'UTM Campaign Present', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'critical', message: 'utm_campaign=bfcm_retargeting is present on all 2 URLs.', affected_items: [], execution_ms: 7 },
  { check_id: 'url_uses_https', check_name: 'HTTPS Enforced', check_category: 'url', platform: 'meta', status: 'passed', severity: 'critical', message: 'All 2 URLs use HTTPS — no HTTP destinations.', affected_items: [], execution_ms: 5 },
  { check_id: 'url_parseable', check_name: 'URL Parseable', check_category: 'url', platform: 'meta', status: 'passed', severity: 'critical', message: 'All 2 URLs parsed successfully — no syntax errors.', affected_items: [], execution_ms: 4 },
  { check_id: 'url_reachable', check_name: 'URL Reachability', check_category: 'url', platform: 'meta', status: 'passed', severity: 'critical', message: 'Both destination URLs returned HTTP 200 OK.', affected_items: [], execution_ms: 1341 },
  { check_id: 'ssl_cert_valid', check_name: 'SSL Certificate Validity', check_category: 'url', platform: 'meta', status: 'passed', severity: 'critical', message: 'SSL certificate for example.com is valid and trusted.', affected_items: [], execution_ms: 423 },
  { check_id: 'landing_page_title', check_name: 'Landing Page Title', check_category: 'url', platform: 'meta', status: 'passed', severity: 'critical', message: 'Landing page title "BFCM Sale — Up to 60% Off" looks healthy.', affected_items: [], execution_ms: 1243 },
  { check_id: 'utm_source_matches_platform', check_name: 'UTM Source Matches Platform', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'utm_source=facebook correctly matches the Meta platform.', affected_items: [], execution_ms: 9 },
  { check_id: 'utm_no_spaces', check_name: 'UTM Values: No Spaces', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'No raw spaces found in any UTM parameter values.', affected_items: [], execution_ms: 11 },
  { check_id: 'utm_case_consistency', check_name: 'UTM Case Consistency', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'All utm_campaign values are lowercase — no GA4 data splitting.', affected_items: [], execution_ms: 8 },
  { check_id: 'utm_no_duplicate_params', check_name: 'No Duplicate UTM Params', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'No duplicate query string keys detected across any URLs.', affected_items: [], execution_ms: 7 },
  { check_id: 'utm_cross_url_consistency', check_name: 'Cross-URL UTM Consistency', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'utm_campaign is consistent across all URLs: bfcm_retargeting.', affected_items: [], execution_ms: 6 },
  { check_id: 'utm_medium_platform_alignment', check_name: 'Platform–Medium Alignment', check_category: 'utm', platform: 'meta', status: 'passed', severity: 'major', message: 'utm_medium=paid_social is correct for Meta — prevents GA4 channel mis-grouping.', affected_items: [], execution_ms: 8 },
  { check_id: 'utm_preserved_through_redirect', check_name: 'UTM Preserved Through Redirects', check_category: 'url', platform: 'meta', status: 'passed', severity: 'major', message: 'All UTM parameters are intact after all redirect hops.', affected_items: [], execution_ms: 1876 },
  { check_id: 'ssl_cert_expiry', check_name: 'SSL Certificate Expiry', check_category: 'url', platform: 'meta', status: 'passed', severity: 'major', message: 'SSL certificate expires in 284 days — no action needed.', affected_items: [], execution_ms: 423 },
  { check_id: 'url_no_fragment', check_name: 'No Hash Fragment Tracking', check_category: 'url', platform: 'meta', status: 'passed', severity: 'major', message: 'No hash fragments (#) found — UTM params are server-visible.', affected_items: [], execution_ms: 5 },
  { check_id: 'url_no_whitespace', check_name: 'No Trailing Whitespace in URLs', check_category: 'url', platform: 'meta', status: 'passed', severity: 'major', message: 'No trailing whitespace detected in any destination URL.', affected_items: [], execution_ms: 4 },
  { check_id: 'url_no_duplicates', check_name: 'Duplicate URLs', check_category: 'url', platform: 'meta', status: 'passed', severity: 'major', message: 'No duplicate destination URLs found — each ad points to a unique URL.', affected_items: [], execution_ms: 5 },
  { check_id: 'headline_char_limit', check_name: 'Headline Character Limit', check_category: 'creative', platform: 'meta', status: 'passed', severity: 'critical', message: "Headline is 34 characters — within Meta's 40-character limit.", affected_items: [], execution_ms: 3 },
  { check_id: 'primary_text_char_limit', check_name: 'Primary Text Character Limit', check_category: 'creative', platform: 'meta', status: 'passed', severity: 'major', message: "Primary text is 187 characters — within Meta's 500-character limit.", affected_items: [], execution_ms: 3 },
  { check_id: 'cta_in_copy', check_name: 'CTA in Ad Copy', check_category: 'creative', platform: 'meta', status: 'passed', severity: 'minor', message: 'Call-to-action phrase detected in headline: "Shop Now".', affected_items: [], execution_ms: 4 },
  { check_id: 'gtm_present', check_name: 'Google Tag Manager Present', check_category: 'tracking', platform: 'meta', status: 'passed', severity: 'major', message: 'GTM container detected on the landing page.', affected_items: [], execution_ms: 1243 },
]

// Derived at module load — stays in sync with DEMO_CHECKS automatically
const DEMO_BY_CATEGORY = DEMO_CHECKS.reduce<Record<string, Record<string, number>>>((acc, c) => {
  if (!acc[c.check_category]) acc[c.check_category] = { passed: 0, failed: 0, warning: 0, error: 0, skipped: 0 }
  acc[c.check_category][c.status] = (acc[c.check_category][c.status] ?? 0) + 1
  return acc
}, {})

const DEMO_URLS = [
  {
    id: 'u1',
    raw_url: 'https://example.com/shop?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_retargeting&utm_content=carousel_v1',
    ad_name: 'Carousel v1 — Retargeting',
    ad_set_name: 'BFCM 30-Day Visitors',
  },
  {
    id: 'u2',
    raw_url: 'https://example.com/shop?utm_source=facebook&utm_medium=paid_social&utm_campaign=bfcm_retargeting&utm_content=video_v2',
    ad_name: 'Video v2 — Retargeting',
    ad_set_name: 'BFCM 30-Day Visitors',
  },
]

const SORTED_CHECKS = [...DEMO_CHECKS].sort((a, b) => {
  const statusOrder: Record<string, number> = { failed: 0, warning: 1, error: 2, passed: 3, skipped: 4 }
  const sevOrder: Record<string, number> = { critical: 0, major: 1, minor: 2 }
  if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
  return sevOrder[a.severity] - sevOrder[b.severity]
})

export default function DemoReportPage() {
  useEffect(() => { document.title = 'Example QA Report — LaunchProof' }, [])
  const [activeFilter, setActiveFilter] = useState('all')

  const passed = DEMO_CHECKS.filter(c => c.status === 'passed').length
  const failed = DEMO_CHECKS.filter(c => c.status === 'failed').length
  const warnings = DEMO_CHECKS.filter(c => c.status === 'warning').length

  const categories = [...new Set(DEMO_CHECKS.map(c => c.check_category))]

  const filtered = SORTED_CHECKS.filter(c => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'failed') return c.status === 'failed'
    if (activeFilter === 'warning') return c.status === 'warning'
    return c.check_category === activeFilter
  })

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Demo banner */}
      <div className="bg-blue-600 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-semibold text-white">This is an example report</p>
            <p className="text-xs text-blue-100">See what LaunchProof produces for a real Meta campaign QA run.</p>
          </div>
        </div>
        <Link
          to="/login"
          className="flex-shrink-0 bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Try free →
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <Link to="/" className="text-sm text-blue-600 hover:underline mb-2 block">
            ← Back to home
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Q4 Retargeting — BFCM Weekend</h1>
          <p className="text-slate-500 text-sm mt-1">META · Nov 25, 2024 · 29 checks in 47s</p>
        </div>
      </div>

      {/* Score + summary strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-8">
          <div className="flex-shrink-0 w-40">
            <ScoreGauge score={87.2} size="lg" />
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-xl py-4">
              <div className="text-3xl font-black text-green-600">{passed}</div>
              <div className="text-xs text-green-600 font-medium mt-1">Passed</div>
            </div>
            <div className="bg-red-50 rounded-xl py-4">
              <div className="text-3xl font-black text-red-600">{failed}</div>
              <div className="text-xs text-red-600 font-medium mt-1">Failed</div>
            </div>
            <div className="bg-yellow-50 rounded-xl py-4">
              <div className="text-3xl font-black text-yellow-600">{warnings}</div>
              <div className="text-xs text-yellow-600 font-medium mt-1">Warnings</div>
            </div>
          </div>
        </div>

        {/* Critical failures alert */}
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-red-800 mb-1">
            ⚠ 1 critical issue must be fixed before launch
          </p>
          <ul className="text-xs text-red-700 space-y-0.5">
            <li>• Platform Pixel Present</li>
          </ul>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">By Category</h3>
        <div className="space-y-3">
          {Object.entries(DEMO_BY_CATEGORY).map(([cat, counts]) => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0)
            const p = counts.passed || 0
            const pct = total > 0 ? Math.round((p / total) * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-28 text-xs font-medium text-slate-600">{CATEGORY_LABELS[cat] || cat}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full', pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 w-12 text-right">{p}/{total}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Checked URLs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Checked URLs <span className="text-slate-400 font-normal">(2)</span>
        </h3>
        <div className="space-y-1.5">
          {DEMO_URLS.map(u => (
            <div key={u.id} className="flex items-start gap-2">
              <span className="text-xs font-mono text-blue-600 truncate flex-1 min-w-0" title={u.raw_url}>
                {u.raw_url}
              </span>
              {(u.ad_name || u.ad_set_name) && (
                <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                  {[u.ad_name, u.ad_set_name].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checks with filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700">All Checks</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: `All (${DEMO_CHECKS.length})` },
              { id: 'failed', label: `Failed (${failed})` },
              { id: 'warning', label: `Warnings (${warnings})` },
              ...categories.map(c => ({ id: c, label: CATEGORY_LABELS[c] || c })),
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                  activeFilter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(c => <CheckCard key={c.check_id} check={c} />)}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
        <p className="text-base font-bold text-blue-900 mb-1">Ready to QA your own campaigns?</p>
        <p className="text-sm text-blue-700 mb-5">
          Get a report like this for your campaigns in under 60 seconds. Free for your first 3 runs.
        </p>
        <Link
          to="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          Start free — no credit card →
        </Link>
      </div>
    </div>
  )
}
