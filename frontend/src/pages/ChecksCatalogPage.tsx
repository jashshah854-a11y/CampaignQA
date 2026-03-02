import { Link } from 'react-router-dom'

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
  // UTM — Tier 1
  { id: 'utm_source_present', name: 'UTM Source Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_source is on every URL.' },
  { id: 'utm_medium_present', name: 'UTM Medium Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_medium is on every URL.' },
  { id: 'utm_campaign_present', name: 'UTM Campaign Present', category: 'UTM', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Verifies utm_campaign is on every URL.' },
  { id: 'utm_no_spaces', name: 'UTM Values: No Spaces', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Catches raw spaces in UTM parameter values.' },
  { id: 'utm_case_consistency', name: 'UTM Case Consistency', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Ensures utm_campaign is lowercase across all URLs to prevent GA4 splitting data.' },
  { id: 'utm_source_matches_platform', name: 'UTM Source Matches Platform', category: 'UTM', severity: 'major', tier: 1, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Checks utm_source matches the selected ad platform.' },
  { id: 'utm_no_duplicate_params', name: 'No Duplicate UTM Params', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Detects duplicate query string keys that corrupt analytics.' },
  { id: 'utm_cross_url_consistency', name: 'Cross-URL UTM Consistency', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Flags utm_campaign mismatches across URLs in the same run.' },
  { id: 'utm_content_term_best_practice', name: 'UTM Content & Term Best Practices', category: 'UTM', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns when utm_content or utm_term are missing.' },
  { id: 'platform_utm_medium_alignment', name: 'Platform–Medium Alignment', category: 'UTM', severity: 'major', tier: 1, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Ensures paid_social for social platforms, cpc for search — prevents GA4 channel mis-grouping.' },
  { id: 'utm_id_ga4', name: 'utm_id for GA4 Linking (Google)', category: 'UTM', severity: 'minor', tier: 1, platforms: ['google'], description: 'Warns when manual Google UTMs lack utm_id, which breaks Google Ads ↔ GA4 data linking.' },
  { id: 'click_id_conflict', name: 'Click ID Platform Conflict', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Detects gclid/fbclid/ttclid on the wrong platform — indicates copy-paste errors.' },
  { id: 'utm_query_string_order', name: 'UTM Parameters Early in Query String', category: 'UTM', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns if UTMs are buried after other params — ad servers can truncate long query strings.' },
  { id: 'utm_value_encoding', name: 'UTM Value Encoding', category: 'UTM', severity: 'major', tier: 1, platforms: ['universal'], description: 'Catches %20, +, or raw spaces in UTM values that cause garbled campaign names in analytics.' },
  // URL — Tier 1
  { id: 'https_check', name: 'HTTPS Enforced', category: 'URL', severity: 'critical', tier: 1, platforms: ['universal'], description: 'All destination URLs must use HTTPS — HTTP is blocked by all major ad platforms.' },
  { id: 'url_parseable', name: 'URL Parseable', category: 'URL', severity: 'critical', tier: 1, platforms: ['universal'], description: 'Checks every URL can be parsed (no syntax errors).' },
  { id: 'url_no_fragment', name: 'No Hash Fragment Tracking', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Hash fragments (#) are not sent to servers — UTM params after # are stripped.' },
  { id: 'url_uniform_domain', name: 'Uniform Domain', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'All URLs should point to the same domain unless running multi-domain campaigns.' },
  { id: 'url_excessive_length', name: 'URL Length', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Warns when URLs exceed 2000 characters — some ad servers truncate at this limit.' },
  { id: 'url_no_trailing_spaces', name: 'No Trailing Spaces in URLs', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Raw whitespace at URL end causes 404 errors.' },
  { id: 'url_duplicate', name: 'Duplicate URLs', category: 'URL', severity: 'major', tier: 1, platforms: ['universal'], description: 'Flags identical destination URLs within the same run.' },
  { id: 'trailing_slash_consistency', name: 'Trailing Slash Consistency', category: 'URL', severity: 'minor', tier: 1, platforms: ['universal'], description: 'Mixed trailing slashes (/page/ vs /page) split GA4 page data.' },
  // Creative — Tier 1
  { id: 'meta_headline_length', name: 'Meta Headline Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['meta'], description: 'Headline must be ≤40 characters for Meta ads.' },
  { id: 'meta_primary_text_length', name: 'Meta Primary Text Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['meta'], description: 'Primary text must be ≤125 characters for Meta ads.' },
  { id: 'google_headline_length', name: 'Google Headline Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['google'], description: 'Each headline must be ≤30 characters for Google RSAs.' },
  { id: 'google_description_length', name: 'Google Description Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['google'], description: 'Descriptions must be ≤90 characters for Google ads.' },
  { id: 'tiktok_headline_length', name: 'TikTok Headline Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['tiktok'], description: 'TikTok ad text must be ≤100 characters.' },
  { id: 'linkedin_headline_length', name: 'LinkedIn Headline Length', category: 'Creative', severity: 'major', tier: 1, platforms: ['linkedin'], description: 'LinkedIn intro text must be ≤150 characters.' },
  // Tracking — Tier 2
  { id: 'pixel_present', name: 'Platform Pixel Present', category: 'Tracking', severity: 'critical', tier: 2, platforms: ['meta', 'google', 'tiktok', 'linkedin'], description: 'Scans landing page HTML for the correct platform pixel.' },
  { id: 'gtm_present', name: 'Google Tag Manager Present', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Detects GTM container snippet on landing pages.' },
  { id: 'conversion_event_detected', name: 'Conversion Event Signal', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks for purchase/lead/form conversion event tracking code.' },
  { id: 'privacy_policy_present', name: 'Privacy Policy Link', category: 'Tracking', severity: 'major', tier: 2, platforms: ['universal'], description: 'Meta and Google require a privacy policy link on landing pages.' },
  { id: 'cookie_consent', name: 'Cookie Consent (GDPR)', category: 'Tracking', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Detects CMP signals (CookieYes, OneTrust, etc) for EU audience compliance.' },
  // URL — Tier 2
  { id: 'url_reachability', name: 'URL Reachability', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Verifies every destination URL returns HTTP 200.' },
  { id: 'url_redirect_depth', name: 'Redirect Depth', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if redirect chains exceed 3 hops — each hop adds latency.' },
  { id: 'utm_preserved_through_redirect', name: 'UTM Preserved Through Redirects', category: 'UTM', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks UTM parameters survive all redirect hops.' },
  { id: 'ssl_cert_valid', name: 'SSL Certificate Validity', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Verifies TLS certificates are valid and not expired.' },
  { id: 'ssl_cert_expiry', name: 'SSL Certificate Expiry', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if certificates expire within 30 days, fails within 7 days.' },
  { id: 'canonical_tag', name: 'Canonical Tag', category: 'URL', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Missing canonical tags allow UTM URLs to be indexed by search engines.' },
  { id: 'landing_page_title', name: 'Landing Page Title', category: 'URL', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Fails if page title is 404, error, empty — indicates broken destination.' },
  { id: 'page_load_time', name: 'Page Load Time', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns >2s, fails >4s — every second of delay loses ~7% of conversions.' },
  { id: 'mobile_readiness', name: 'Mobile Readiness', category: 'URL', severity: 'major', tier: 2, platforms: ['universal'], description: 'Checks for viewport meta tag — 60-80% of paid social traffic is mobile.' },
  { id: 'security_headers', name: 'HTTP Security Headers', category: 'URL', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Checks for HSTS, X-Content-Type-Options, X-Frame-Options.' },
  // Content — Tier 2
  { id: 'og_tags', name: 'Open Graph Tags', category: 'Content', severity: 'minor', tier: 2, platforms: ['universal'], description: 'og:title and og:image present — affects how shared links look on social.' },
  { id: 'noindex', name: 'Noindex Detection', category: 'Content', severity: 'major', tier: 2, platforms: ['universal'], description: 'Warns if landing page has noindex — blocks search engine indexing of the paid page.' },
  { id: 'prohibited_claims', name: 'Prohibited Claims', category: 'Content', severity: 'major', tier: 2, platforms: ['universal'], description: 'Scans ad copy and landing page for language that violates Meta/Google policies.' },
  { id: 'cookie_consent_body', name: 'Cookie Consent Signal', category: 'Content', severity: 'minor', tier: 2, platforms: ['universal'], description: 'Scans for GDPR consent management signals.' },
  { id: 'domain_safety', name: 'Domain Safety (VirusTotal)', category: 'Content', severity: 'critical', tier: 2, platforms: ['universal'], description: 'Checks all domains against VirusTotal — flags malware/phishing detections.' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-blue-100 text-blue-700',
}

const CATEGORIES = [...new Set(CHECKS.map(c => c.category))]

export default function ChecksCatalogPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline mb-3 block">← Dashboard</Link>
        <h1 className="text-2xl font-bold text-slate-900">Checks Catalog</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {CHECKS.length} checks across {CATEGORIES.length} categories.
          Tier 1 checks run instantly; Tier 2 checks run in the background (SSL, reachability, pixel detection, etc).
        </p>
      </div>

      {CATEGORIES.map(cat => {
        const catChecks = CHECKS.filter(c => c.category === cat)
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{cat}</h2>
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
