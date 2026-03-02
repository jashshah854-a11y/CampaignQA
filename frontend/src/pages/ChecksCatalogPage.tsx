import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface CheckSpec {
  id: string
  name: string
  category: string
  severity: 'critical' | 'major' | 'minor'
  tier: 1 | 2
  platforms: string[]
  description: string
}

const CHECKS: CheckSpec[] = [
  // ── UTM — Tier 1 ────────────────────────────────────────────────────────────
  { id: 'utm_source_present', name: 'UTM Source Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_source is on every destination URL.' },
  { id: 'utm_medium_present', name: 'UTM Medium Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_medium is on every destination URL.' },
  { id: 'utm_campaign_present', name: 'UTM Campaign Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_campaign is on every destination URL.' },
  { id: 'utm_no_spaces', name: 'UTM Values: No Spaces', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Catches raw spaces in UTM parameter values.' },
  { id: 'utm_case_consistency', name: 'UTM Case Consistency', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Ensures utm_campaign is lowercase across all URLs to prevent GA4 splitting data.' },
  { id: 'utm_source_matches_platform', name: 'UTM Source Matches Platform', category: 'UTM', severity: 'major', tier: 1, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Checks utm_source matches the selected ad platform.' },
  { id: 'utm_no_duplicate_params', name: 'No Duplicate UTM Params', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Detects duplicate query string keys that corrupt analytics.' },
  { id: 'utm_cross_url_consistency', name: 'Cross-URL UTM Consistency', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Flags utm_campaign mismatches across URLs in the same run.' },
  { id: 'utm_content_term_best_practice', name: 'UTM Content & Term Best Practices', category: 'UTM', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns when utm_content or utm_term are missing.' },
  { id: 'utm_medium_platform_alignment', name: 'Platform–Medium Alignment', category: 'UTM', severity: 'major', tier: 1, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Ensures paid_social for social platforms, cpc for search — prevents GA4 channel mis-grouping.' },
  { id: 'utm_id_ga4', name: 'utm_id for GA4 Linking', category: 'UTM', severity: 'minor', tier: 1, platforms: ['google'], description: 'Warns when manual Google UTMs lack utm_id, which breaks Google Ads ↔ GA4 data linking.' },
  { id: 'click_id_conflict', name: 'Click ID Platform Conflict', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Detects gclid/fbclid/ttclid on the wrong platform — indicates copy-paste errors.' },
  { id: 'utm_query_string_order', name: 'UTM Parameters Early in Query String', category: 'UTM', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns if UTMs are buried after other params — ad servers can truncate long query strings.' },
  { id: 'utm_value_encoding', name: 'UTM Value Encoding', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Catches %20, +, or raw spaces in UTM values that cause garbled campaign names in analytics.' },
  // ── URL — Tier 1 ────────────────────────────────────────────────────────────
  { id: 'url_uses_https', name: 'HTTPS Enforced', category: 'URL', severity: 'critical', tier: 1, platforms: ['universal'], description: 'All destination URLs must use HTTPS — HTTP is blocked by all major ad platforms.' },
  { id: 'url_parseable', name: 'URL Parseable', category: 'URL', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Checks every URL can be parsed (no syntax errors).' },
  { id: 'url_no_fragment', name: 'No Hash Fragment Tracking', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Hash fragments (#) are not sent to servers — UTM params after # are stripped.' },
  { id: 'url_uniform_domain', name: 'Uniform Domain', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'All URLs should point to the same domain unless running multi-domain campaigns.' },
  { id: 'url_length', name: 'URL Length', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns when URLs exceed 2000 characters — some ad servers truncate at this limit.' },
  { id: 'url_no_whitespace', name: 'No Trailing Whitespace in URLs', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Raw whitespace at URL end causes 404 errors.' },
  { id: 'url_no_duplicates', name: 'Duplicate URLs', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Flags identical destination URLs within the same run.' },
  { id: 'trailing_slash_consistency', name: 'Trailing Slash Consistency', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Mixed trailing slashes (/page/ vs /page) split GA4 page data.' },
  // ── Creative — Tier 1 ───────────────────────────────────────────────────────
  { id: 'headline_char_limit', name: 'Headline Character Limit', category: 'Creative', severity: 'critical', tier: 1, platforms: ['meta', 'google', 'linkedin'], description: 'Checks headline against platform-specific character limits (Meta 40, Google 30, LinkedIn 150).' },
  { id: 'primary_text_char_limit', name: 'Primary Text Character Limit', category: 'Creative', severity: 'major', tier: 1, platforms: ['meta', 'tiktok', 'linkedin'], description: 'Checks primary ad copy against platform hard limits and warns at recommended limits.' },
  { id: 'description_char_limit', name: 'Description Character Limit', category: 'Creative', severity: 'major', tier: 1, platforms: ['meta', 'google'], description: 'Descriptions must be within platform character limits (Meta 30 / Google 90).' },
  { id: 'cta_in_copy', name: 'CTA in Ad Copy', category: 'Creative', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns when no call-to-action phrase is detected in headline or primary text.' },
  { id: 'emoji_in_headline', name: 'Emoji in Headline', category: 'Creative', severity: 'minor', tier: 1, platforms: ['meta', 'google', 'linkedin'], description: 'Flags emojis in headlines — some platforms strip them, causing unexpected truncation.' },
  // ── Tracking — Tier 2 ───────────────────────────────────────────────────────
  { id: 'pixel_platform_present', name: 'Platform Pixel Present', category: 'Tracking', severity: 'critical', tier: 2, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Scans landing page HTML for the correct platform pixel/tag.' },
  { id: 'gtm_present', name: 'Google Tag Manager Present', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Detects GTM container snippet on landing pages.' },
  { id: 'pixel_conversion_event', name: 'Conversion Event Signal', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks for purchase/lead/form conversion event tracking code.' },
  { id: 'privacy_policy_present', name: 'Privacy Policy Link', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Meta and Google require a privacy policy link on landing pages.' },
  { id: 'cookie_consent', name: 'Cookie Consent (GDPR)', category: 'Tracking', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Detects CMP signals (CookieYes, OneTrust, etc) for EU audience compliance.' },
  // ── URL — Tier 2 ────────────────────────────────────────────────────────────
  { id: 'url_reachable', name: 'URL Reachability', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Verifies every destination URL returns HTTP 200.' },
  { id: 'url_redirect_depth', name: 'Redirect Depth', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if redirect chains exceed 3 hops — each hop adds latency.' },
  { id: 'utm_preserved_through_redirect', name: 'UTM Preserved Through Redirects', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks UTM parameters survive all redirect hops.' },
  { id: 'ssl_cert_valid', name: 'SSL Certificate Validity', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Verifies TLS certificates are valid and not expired.' },
  { id: 'ssl_cert_expiry', name: 'SSL Certificate Expiry', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if certificates expire within 30 days, fails within 7 days.' },
  { id: 'canonical_tag', name: 'Canonical Tag', category: 'URL', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Missing canonical tags allow UTM URLs to be indexed by search engines.' },
  { id: 'landing_page_title', name: 'Landing Page Title', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Fails if page title is 404, error, or empty — indicates broken destination.' },
  { id: 'page_load_time', name: 'Page Load Time', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns >2s, fails >4s — every second of delay loses ~7% of conversions.' },
  { id: 'mobile_readiness', name: 'Mobile Readiness', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks for viewport meta tag — 60-80% of paid social traffic is mobile.' },
  { id: 'security_headers', name: 'HTTP Security Headers', category: 'URL', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Checks for HSTS, X-Content-Type-Options, X-Frame-Options.' },
  // ── Content — Tier 2 ────────────────────────────────────────────────────────
  { id: 'og_tags_present', name: 'Open Graph Tags', category: 'Content', severity: 'minor', tier: 2, platforms: ['universal'], description: 'og:title and og:image present — affects how shared links look on social.' },
  { id: 'landing_page_not_noindex', name: 'Noindex Detection', category: 'Content', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if landing page has noindex — can reduce Quality Score and ad visibility.' },
  { id: 'prohibited_claims', name: 'Prohibited Claims', category: 'Content', severity: 'major', tier: 2, platforms: ['universal'], description: 'Scans ad copy and landing page for language that violates Meta/Google policies.' },
  { id: 'virustotal_domain_safety', name: 'Domain Safety (VirusTotal)', category: 'Content', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Checks all domains against VirusTotal — flags malware/phishing detections.' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-blue-100 text-blue-700',
}

const CATEGORIES = [...new Set(CHECKS.map(c => c.category))]

export default function ChecksCatalogPage() {
  useEffect(() => { document.title = 'Checks Catalog — LaunchProof' }, [])
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all')

  const q = search.toLowerCase()
  const filtered = CHECKS.filter(c => {
    if (severityFilter !== 'all' && c.severity !== severityFilter) return false
    if (tierFilter !== 'all' && c.tier !== tierFilter) return false
    if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false
    return true
  })

  const visibleCategories = CATEGORIES.filter(cat => filtered.some(c => c.category === cat))

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline mb-3 block">← Dashboard</Link>
        <h1 className="text-2xl font-bold text-slate-900">Checks Catalog</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {CHECKS.length} checks across {CATEGORIES.length} categories.
          Tier 1 checks run instantly; Tier 2 checks run in the background (SSL, reachability, pixel detection, etc).
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search checks…"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'critical', 'major', 'minor'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                severityFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {s === 'all' ? 'All severity' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button
            onClick={() => setTierFilter(tierFilter === 'all' ? 1 : tierFilter === 1 ? 2 : 'all')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              tierFilter !== 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {tierFilter === 'all' ? 'All tiers' : `Tier ${tierFilter} only`}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No checks match your search.{' '}
          <button onClick={() => { setSearch(''); setSeverityFilter('all'); setTierFilter('all') }} className="text-blue-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          {search || severityFilter !== 'all' || tierFilter !== 'all' ? (
            <p className="text-xs text-slate-400 mb-4">{filtered.length} of {CHECKS.length} checks</p>
          ) : null}

          {visibleCategories.map(cat => {
            const catChecks = filtered.filter(c => c.category === cat)
            return (
              <div key={cat} className="mb-8">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {cat} <span className="text-slate-400 font-normal normal-case">({catChecks.length})</span>
                </h2>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {catChecks.map((check, i) => (
                    <div
                      key={check.id}
                      className={`flex items-start gap-4 px-5 py-4 ${i < catChecks.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-slate-900">{check.name}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[check.severity]}`}>
                            {check.severity}
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            Tier {check.tier}
                          </span>
                          {check.platforms.filter(p => p !== 'universal').length > 0 && (
                            <span className="text-xs text-slate-400">
                              {check.platforms.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{check.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
        <p className="text-sm font-semibold text-blue-900 mb-1">All checks run automatically on every QA run</p>
        <p className="text-xs text-blue-700 mb-3">No configuration needed. Platform-specific checks only fire for the selected platform.</p>
        <Link
          to="/new"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          Run a QA Check →
        </Link>
      </div>
    </div>
  )
}
