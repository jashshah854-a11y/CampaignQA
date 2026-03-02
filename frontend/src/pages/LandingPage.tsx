import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

// Reset title on landing page (override any dashboard title set while logged in)
const PAGE_TITLE = 'LaunchProof — Pre-launch QA for paid media'

interface Stats { total_runs: number; total_checks_run: number; checks_per_run_avg: number }

function useCountUp(target: number, active: boolean, duration = 1200): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active || !target || !isFinite(target) || target <= 0) return
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - pct, 3)
      setVal(Math.round(eased * target))
      if (pct < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])
  return val
}

function StatCard({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fired, setFired] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setFired(true); obs.disconnect() } }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const display = useCountUp(value, fired)
  const safeValue = isFinite(value) && value > 0 ? value : null
  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl font-black text-slate-900 tabular-nums">
        {fired && safeValue ? display.toLocaleString() : (safeValue ? safeValue.toLocaleString() : '—')}{safeValue ? suffix : ''}
      </p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  )
}

function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/pub/stats`
    fetch(url).then(r => r.json()).then(setStats).catch(() => {})
  }, [])
  if (!stats || !stats.total_runs || !isFinite(stats.total_runs) || stats.total_runs <= 0) return null
  return (
    <div className="bg-white border-y border-slate-100 py-10 px-6">
      <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 divide-x divide-slate-100">
        <StatCard value={stats.total_runs} label="campaigns QA'd" />
        <StatCard value={stats.total_checks_run} label="checks executed" />
        <StatCard value={stats.checks_per_run_avg} label="checks per run (avg)" />
      </div>
    </div>
  )
}

const CHECKS = [
  { icon: '🔗', label: 'UTM Parameters', desc: '14 checks — source, medium, campaign present and correctly formatted' },
  { icon: '🌐', label: 'URL Health', desc: 'Reachability, redirect depth, HTTPS, SSL certificate, and load time' },
  { icon: '🛡️', label: 'Domain Safety', desc: 'VirusTotal scan — flags malicious or compromised domains before launch' },
  { icon: '📸', label: 'Pixel Tracking', desc: 'Meta, Google, TikTok, LinkedIn pixels detected on landing pages' },
  { icon: '✍️', label: 'Ad Copy Limits', desc: 'Headline and body copy checked against platform character limits' },
  { icon: '📋', label: 'Naming Conventions', desc: 'Campaign and ad names follow structured, consistent conventions' },
  { icon: '⚖️', label: 'Policy Compliance', desc: 'Landing pages scanned for prohibited language and missing privacy policy' },
  { icon: '📱', label: 'Mobile Readiness', desc: 'Viewport meta, OG tags, and mobile-friendliness signals checked' },
]

const STEPS = [
  {
    n: '1',
    title: 'Paste your campaign URLs',
    desc: 'Drop in your destination URLs — one per line, or upload a CSV with ad names and sets. Supports Meta, Google, TikTok, LinkedIn, and multi-platform campaigns.',
  },
  {
    n: '2',
    title: 'Run 46 automated checks',
    desc: 'LaunchProof instantly runs 14 UTM checks, URL structure validation, ad copy limits, pixel detection, SSL, redirect depth, and policy compliance — all in under 60 seconds.',
  },
  {
    n: '3',
    title: 'Get a score + fix list',
    desc: 'Every run produces a 0–100 Readiness Score with a prioritised fix list sorted by severity. Share a read-only report link with your client or download a fix checklist.',
  },
]

const PLATFORMS = ['Meta', 'Google', 'TikTok', 'LinkedIn', 'Multi-platform']

export default function LandingPage() {
  useEffect(() => { document.title = PAGE_TITLE }, [])
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">LaunchProof</span>
          <div className="flex items-center gap-5">
            <a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-800 hidden sm:block">How it works</a>
            <a href="#checks" className="text-sm text-slate-500 hover:text-slate-800 hidden sm:block">Checks</a>
            <a href="#pricing" className="text-sm text-slate-500 hover:text-slate-800 hidden sm:block">Pricing</a>
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          Pre-launch QA for paid media
        </div>
        <h1 className="text-5xl font-black text-slate-900 leading-tight mb-5">
          Stop launching broken<br />ad campaigns
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-8">
          One misconfigured UTM or missing pixel = wasted ad spend. LaunchProof runs 46 automated checks on your campaign URLs before you go live — and gives you a readiness score.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Check my campaign for free →
          </Link>
          <p className="text-sm text-slate-400">No credit card required</p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap mt-8">
          {PLATFORMS.map(p => (
            <span key={p} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">{p}</span>
          ))}
        </div>
      </section>

      {/* Live stats — only renders when backend has data */}
      <LiveStats />

      {/* Score mockup */}
      <section className="bg-slate-50 py-12 px-6">
        <div className="max-w-2xl mx-auto">
        <p className="text-center text-xs text-slate-400 mb-3">Example report — Meta · Q4 BFCM Campaign</p>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-24 h-24 rounded-full border-8 border-green-500 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-black text-green-600">87</span>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Campaign Readiness Score</p>
              <p className="text-slate-500 text-sm">Meta · Q2 BFCM Campaign</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="bg-green-50 rounded-xl py-3">
              <div className="text-2xl font-black text-green-600">24</div>
              <div className="text-xs text-green-600 font-medium">Passed</div>
            </div>
            <div className="bg-red-50 rounded-xl py-3">
              <div className="text-2xl font-black text-red-600">2</div>
              <div className="text-xs text-red-600 font-medium">Failed</div>
            </div>
            <div className="bg-yellow-50 rounded-xl py-3">
              <div className="text-2xl font-black text-yellow-600">4</div>
              <div className="text-xs text-yellow-600 font-medium">Warnings</div>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
            ⚠ 2 critical issues must be fixed before launch — UTM campaign missing · Privacy policy not detected
          </div>
        </div>
        <div className="text-center mt-5">
          <Link to="/demo" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View the full interactive example report →
          </Link>
        </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-3">How it works</h2>
        <p className="text-slate-500 text-center mb-14 text-lg">From URLs to a scored report in under 60 seconds.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line on desktop */}
          <div className="hidden md:block absolute top-8 left-[calc(16.666%+1rem)] right-[calc(16.666%+1rem)] h-0.5 bg-slate-200" />
          {STEPS.map(step => (
            <div key={step.n} className="flex flex-col items-center text-center relative">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-black mb-5 z-10 flex-shrink-0">
                {step.n}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Checks grid */}
      <section id="checks" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-3">46 automated checks</h2>
        <p className="text-slate-500 text-center mb-10">Everything a performance marketer needs to verify before pressing Go.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {CHECKS.map(c => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-2xl mb-3 select-none">{c.icon}</div>
              <p className="font-semibold text-slate-900 text-sm mb-1">{c.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/checks" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View all 46 checks in the catalog →
          </Link>
        </div>
      </section>

      {/* vs competitors */}
      <section className="bg-slate-50 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-slate-900 text-center mb-10">Why not just use a UTM builder?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">UTM builders (CampaignTrackly, UTM.io)</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>✅ Build UTM links</li>
                <li>✅ Team templates</li>
                <li className="text-slate-300">— Don't check URL reachability</li>
                <li className="text-slate-300">— Don't verify pixel firing</li>
                <li className="text-slate-300">— Don't scan policy compliance</li>
                <li className="text-slate-300">— No readiness score</li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl border-2 border-blue-500 p-6">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">LaunchProof</p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>✅ Validates all UTM parameters</li>
                <li>✅ Checks URL health + redirects</li>
                <li>✅ Verifies pixel presence</li>
                <li>✅ Scans for policy violations</li>
                <li>✅ VirusTotal domain safety</li>
                <li>✅ Shareable client report</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-12">What paid media teams say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote: "We used to do UTM QA manually in a spreadsheet before every launch. LaunchProof replaced a 45-minute checklist with a 60-second report.",
              name: "Amir K.",
              role: "Performance Marketing Lead",
            },
            {
              quote: "The pixel detection alone saved us from launching a $50k Meta campaign with a broken Facebook Pixel. Worth it just for that.",
              name: "Rachel T.",
              role: "Paid Social Manager",
            },
            {
              quote: "I send the shareable report link to clients before every campaign goes live. They love seeing the score. It builds trust instantly.",
              name: "Jordan M.",
              role: "Agency Founder",
            },
          ].map(t => (
            <div key={t.name} className="bg-white rounded-2xl border border-slate-200 p-6">
              <p className="text-sm text-slate-700 leading-relaxed mb-5">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-10">Simple pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([
            { name: 'Free', price: '$0', features: ['3 QA runs to get started', 'All 46 checks', 'Shareable report links', 'Export PDF & JSON'], highlight: false },
            { name: 'Pro', price: '$29/mo', features: ['Unlimited QA runs', 'CSV bulk import', 'n8n / Zapier webhook', 'API access'], highlight: true },
            { name: 'Agency', price: '$79/mo', features: ['Everything in Pro', 'Multiple team members', 'White-label reports', 'Priority support'], highlight: false },
          ] as { name: string; price: string; features: string[]; highlight: boolean }[]).map(tier => (
            <div key={tier.name} className={`rounded-2xl p-6 border ${tier.highlight ? 'border-2 border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <p className="font-bold text-slate-900 mb-1">{tier.name}</p>
              <p className={`text-3xl font-black mb-4 ${tier.highlight ? 'text-blue-700' : 'text-slate-900'}`}>{tier.price}</p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                {tier.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <Link
                to="/login"
                className={`block text-center font-semibold text-sm py-2.5 rounded-lg transition-colors ${tier.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-blue-600 py-16 px-6 text-center">
        <h2 className="text-3xl font-black text-white mb-3">Ready to launch with confidence?</h2>
        <p className="text-blue-100 mb-8">Paste your URLs. Get a score. Fix issues before they burn budget.</p>
        <Link
          to="/login"
          className="inline-block bg-white text-blue-700 font-bold px-8 py-3.5 rounded-xl text-base hover:bg-blue-50 transition-colors"
        >
          Check my campaign free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-semibold text-slate-600 text-sm">LaunchProof</span>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <Link to="/login" className="hover:text-slate-600">Dashboard</Link>
            <Link to="/checks" className="hover:text-slate-600">All 46 checks</Link>
            <Link to="/demo" className="hover:text-slate-600">Example report</Link>
            <a href="#pricing" className="hover:text-slate-600">Pricing</a>
            <a href="mailto:jashshah854@gmail.com" className="hover:text-slate-600">Contact</a>
          </div>
          <span className="text-xs text-slate-400">Pre-launch QA for paid media</span>
        </div>
      </footer>
    </div>
  )
}
