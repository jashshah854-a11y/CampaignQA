import { Link } from 'react-router-dom'

const BASE = import.meta.env.VITE_API_URL as string

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  )
}

function Section({ title, method, path, desc, children }: {
  title: string
  method: string
  path: string
  desc: string
  children: React.ReactNode
}) {
  const methodColor: Record<string, string> = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColor[method] || 'bg-slate-100 text-slate-600'}`}>
          {method}
        </span>
        <code className="text-xs text-slate-500 font-mono">{path}</code>
      </div>
      <p className="text-sm text-slate-500 mb-4">{desc}</p>
      {children}
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Nav */}
      <div className="mb-8">
        <Link to="/settings" className="text-sm text-blue-600 hover:underline mb-3 block">← Settings</Link>
        <h1 className="text-2xl font-bold text-slate-900">API Reference</h1>
        <p className="text-slate-500 mt-1 text-sm">Create and retrieve QA runs programmatically. Requires a Pro or Agency plan.</p>
      </div>

      {/* Auth */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">Authentication</h2>
        <p className="text-sm text-blue-700 mb-3">
          All requests must include your API key in the <code className="bg-blue-100 px-1 rounded font-mono text-xs">X-API-Key</code> header.
          Generate keys in <Link to="/settings" className="underline">Settings → API Keys</Link>.
        </p>
        <Code>{`X-API-Key: lp_your_api_key_here`}</Code>
        <p className="text-xs text-blue-600 mt-2">Keys start with <code className="font-mono">lp_</code> and are 43 characters total.</p>
      </div>

      {/* Base URL */}
      <div className="bg-slate-50 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">Base URL</span>
        <code className="text-xs font-mono text-slate-700">{BASE}/api/v1/pub</code>
      </div>

      {/* Create run */}
      <Section
        title="Create a QA Run"
        method="POST"
        path="/api/v1/pub/runs"
        desc="Submit URLs for QA checking. Returns run_id immediately — Tier 1 checks are synchronous, Tier 2 runs in background."
      >
        <Code>{`curl -X POST ${BASE}/api/v1/pub/runs \\
  -H "X-API-Key: lp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "run_name": "Black Friday — Meta",
    "platform": "meta",
    "urls": [
      {
        "url": "https://yoursite.com/lp?utm_source=facebook&utm_medium=paid_social&utm_campaign=bf2025",
        "ad_name": "Creative_A",
        "ad_set_name": "Lookalike_25_54",
        "campaign_name": "bf2025_meta_conversion"
      }
    ],
    "campaign_objective": "conversion",
    "industry_vertical": "ecommerce",
    "headline": "Up to 60% off — today only",
    "primary_text": "Shop the biggest sale of the year. Limited stock."
  }'`}</Code>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-600">Request body</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {[
              ['run_name', 'string', 'required', 'Name shown in the dashboard'],
              ['platform', 'string', 'required', 'meta · google · tiktok · linkedin · multi'],
              ['urls', 'array', 'required', 'Array of URL objects (max 50). Each has url (required), ad_name, ad_set_name, campaign_name (all optional)'],
              ['campaign_name', 'string', 'optional', 'Validates naming conventions'],
              ['campaign_objective', 'string', 'optional', 'awareness · traffic · conversion · retargeting'],
              ['industry_vertical', 'string', 'optional', 'ecommerce · saas · lead_gen · app_install · other'],
              ['headline', 'string', 'optional', 'Ad headline — enables character limit checks'],
              ['primary_text', 'string', 'optional', 'Ad body copy — enables character limit checks'],
              ['description', 'string', 'optional', 'Ad description'],
            ].map(([field, type, req, desc]) => (
              <div key={field} className="grid grid-cols-[1fr_1fr_4fr] text-xs px-3 py-2 border-b border-slate-100 last:border-0">
                <code className="font-mono text-slate-800">{field}</code>
                <span className="text-slate-400">{type} · <span className={req === 'required' ? 'text-red-500' : 'text-slate-400'}>{req}</span></span>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Response</p>
          <Code>{`{
  "run_id": "uuid-of-the-run",
  "status": "running",
  "tier1_results": [ /* instant check results */ ],
  "message": "QA run started via API. 12 instant checks complete."
}`}</Code>
        </div>
      </Section>

      {/* Poll status */}
      <Section
        title="Poll Run Status"
        method="GET"
        path="/api/v1/pub/runs/{run_id}/status"
        desc="Check if a run has completed. Recommended poll interval: 3–5 seconds."
      >
        <Code>{`curl ${BASE}/api/v1/pub/runs/{run_id}/status \\
  -H "X-API-Key: lp_your_key"`}</Code>
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Response</p>
          <Code>{`{
  "run_id": "uuid",
  "status": "completed",        // pending | running | completed | failed
  "progress_pct": 100,
  "readiness_score": 87.5,
  "total_checks": 18,
  "passed_checks": 15,
  "failed_checks": 2,
  "warning_checks": 1
}`}</Code>
        </div>
      </Section>

      {/* Get report */}
      <Section
        title="Get Report"
        method="GET"
        path="/api/v1/pub/runs/{run_id}/report"
        desc="Fetch the full scored QA report once status == 'completed'."
      >
        <Code>{`curl ${BASE}/api/v1/pub/runs/{run_id}/report \\
  -H "X-API-Key: lp_your_key"`}</Code>
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Response (abbreviated)</p>
          <Code>{`{
  "run_id": "uuid",
  "run_name": "Black Friday — Meta",
  "platform": "meta",
  "status": "completed",
  "created_at": "2025-11-25T10:00:00Z",
  "summary": {
    "readiness_score": 87.5,
    "passed": 15,
    "failed": 2,
    "warnings": 1,
    "critical_failures": ["SSL Certificate Invalid"],
    "by_category": {
      "utm": { "passed": 4, "failed": 1, "warning": 0 },
      "url": { "passed": 3, "failed": 0, "warning": 1 }
    }
  },
  "checks": [
    {
      "check_id": "utm_presence",
      "check_name": "UTM Parameter Presence",
      "check_category": "utm",
      "platform": "meta",
      "status": "passed",
      "severity": "critical",
      "message": "All 3 required UTM parameters found on all URLs.",
      "recommendation": null,
      "affected_items": [],
      "execution_ms": 2
    }
  ]
}`}</Code>
        </div>
      </Section>

      {/* List runs */}
      <Section
        title="List Recent Runs"
        method="GET"
        path="/api/v1/pub/runs"
        desc="Returns your 20 most recent runs, newest first."
      >
        <Code>{`curl ${BASE}/api/v1/pub/runs \\
  -H "X-API-Key: lp_your_key"`}</Code>
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Response</p>
          <Code>{`[
  {
    "id": "uuid",
    "run_name": "Black Friday — Meta",
    "platform": "meta",
    "status": "completed",
    "readiness_score": 87.5,
    "passed_checks": 15,
    "failed_checks": 2,
    "created_at": "2025-11-25T10:00:00Z",
    "completed_at": "2025-11-25T10:00:45Z"
  }
]`}</Code>
        </div>
      </Section>

      {/* Workflow example */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Complete workflow (shell)</h3>
        <Code>{`#!/bin/bash
API_KEY="lp_your_key"
BASE="${BASE}/api/v1/pub"

# 1. Create run
RUN_ID=$(curl -s -X POST "$BASE/runs" \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"run_name":"CI Check","platform":"meta","urls":[{"url":"https://example.com?utm_source=facebook&utm_medium=paid_social&utm_campaign=test"}]}' \\
  | jq -r '.run_id')

echo "Run started: $RUN_ID"

# 2. Poll until complete
while true; do
  STATUS=$(curl -s "$BASE/runs/$RUN_ID/status" -H "X-API-Key: $API_KEY" | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 4
done

# 3. Get score
SCORE=$(curl -s "$BASE/runs/$RUN_ID/report" -H "X-API-Key: $API_KEY" | jq '.summary.readiness_score')
echo "Readiness score: $SCORE"

# 4. Fail CI if score below threshold
python3 -c "import sys; sys.exit(0 if $SCORE >= 75 else 1)"
echo "CI check passed!"`}</Code>
      </div>

      {/* Rate limits */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
        <p className="font-semibold mb-1">Rate limits &amp; limits</p>
        <ul className="text-xs space-y-1 text-amber-700">
          <li>• Max 50 URLs per run</li>
          <li>• Recommended poll interval: 3–5 seconds</li>
          <li>• Max 5 API keys per account</li>
          <li>• Runs are available in the dashboard alongside API-created runs</li>
        </ul>
      </div>
    </div>
  )
}
