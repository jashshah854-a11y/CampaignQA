import { Link } from 'react-router-dom'

const CHECKS = [
  { icon: '🔗', label: 'UTM Parameters', desc: 'Source, medium, campaign present and correctly formatted' },
  { icon: '🌐', label: 'URL Reachability', desc: 'Every destination URL returns 200 and loads in under 3s' },
  { icon: '🛡️', label: 'Domain Safety', desc: 'VirusTotal scan — flags malicious or compromised domains' },
  { icon: '📸', label: 'Pixel Tracking', desc: 'Meta, Google, TikTok, LinkedIn pixels detected on landing pages' },
  { icon: '✍️', label: 'Ad Copy Limits', desc: 'Headline and body copy checked against platform character limits' },
  { icon: '📋', label: 'Naming Conventions', desc: 'Campaign and ad names follow structured, consistent conventions' },
  { icon: '⚖️', label: 'Policy Compliance', desc: 'Landing pages scanned for prohibited claims and missing privacy policy' },
  { icon: '📱', label: 'Mobile Readiness', desc: 'Viewport meta, OG tags, and mobile-friendliness signals checked' },
]

const PLATFORMS = ['Meta', 'Google', 'TikTok', 'LinkedIn', 'Multi-platform']

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">LaunchProof</span>
          <div className="flex items-center gap-4">
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
          One misconfigured UTM or missing pixel = wasted ad spend. LaunchProof runs 30+ automated checks on your campaign URLs before you go live — and gives you a readiness score.
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

        {/* Platform pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-8">
          {PLATFORMS.map(p => (
            <span key={p} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">{p}</span>
          ))}
        </div>
      </section>

      {/* Score mockup */}
      <section className="bg-slate-50 py-12 px-6">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
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
            ⚠ 2 critical issues must be fixed before launch: UTM campaign missing · Privacy policy not found
          </div>
        </div>
      </section>

      {/* Checks grid */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-3">30+ automated checks</h2>
        <p className="text-slate-500 text-center mb-10">Everything a performance marketer needs to verify before pressing Go.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHECKS.map(c => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-2xl mb-3">{c.icon}</div>
              <p className="font-semibold text-slate-900 text-sm mb-1">{c.label}</p>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
          ))}
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

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-slate-900 text-center mb-10">Simple pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Free', price: '$0', features: ['Unlimited QA runs', 'All 30+ checks', 'Shareable report links', 'Export PDF'] },
            { name: 'Pro', price: '$29/mo', features: ['Everything in Free', 'Client-branded reports', 'Priority support', 'CSV bulk import'], highlight: true },
            { name: 'Agency', price: '$79/mo', features: ['Everything in Pro', 'Multiple team members', 'White-label reports', 'API access'] },
          ].map(tier => (
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

      {/* CTA */}
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
      <footer className="border-t border-slate-100 py-8 px-6 text-center text-xs text-slate-400">
        <span className="font-semibold text-slate-600">LaunchProof</span> · Pre-launch QA for paid media ·{' '}
        <a href="mailto:jashshah854@gmail.com" className="hover:text-slate-600">Contact</a>
      </footer>
    </div>
  )
}
