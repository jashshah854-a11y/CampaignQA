import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white py-4 px-6 flex items-center justify-between">
        <Link to="/" className="font-bold text-slate-900">LaunchProof</Link>
        <Link to="/login" className="text-sm text-blue-600 hover:underline">Sign in →</Link>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: March 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">What we collect</h2>
          <ul className="text-slate-600 text-sm space-y-2 list-disc pl-5">
            <li><strong>Account data:</strong> email address (via magic-link login through Supabase Auth)</li>
            <li><strong>Profile data:</strong> full name, company name (optional, set by you in Settings)</li>
            <li><strong>QA run data:</strong> destination URLs, UTM parameters, ad copy, and platform you submit for checking</li>
            <li><strong>Billing data:</strong> handled entirely by Stripe — we do not store card numbers or bank details</li>
            <li><strong>Usage data:</strong> run count, timestamps, and feature usage to operate the free-tier limit and benchmarks</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How we use it</h2>
          <ul className="text-slate-600 text-sm space-y-2 list-disc pl-5">
            <li>To run the QA checks you request and return results to you</li>
            <li>To send run-complete notifications (if you have a RESEND_API_KEY configured)</li>
            <li>To generate anonymized aggregate benchmarks — your data only contributes once at least 10 other tenants have run checks on the same platform (Rule of 10)</li>
            <li>To enforce free-plan limits and process billing</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Third-party services</h2>
          <div className="space-y-3">
            {[
              { name: 'Supabase', use: 'Authentication, database, and file storage. Data stored in US East.' },
              { name: 'Stripe', use: "Payment processing. Subject to Stripe's own privacy policy." },
              { name: 'Railway', use: 'Backend hosting. Code and compute only — no user data persisted on Railway.' },
              { name: 'Vercel', use: 'Frontend hosting. No personal data stored.' },
              { name: 'Resend', use: 'Transactional email for run-complete notifications.' },
              { name: 'VirusTotal', use: 'Domain safety checks. Only the URL hostname is sent, not full URLs with UTM params.' },
            ].map(({ name, use }) => (
              <div key={name} className="flex gap-3 text-sm">
                <span className="font-medium text-slate-700 w-24 flex-shrink-0">{name}</span>
                <span className="text-slate-500">{use}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Data retention and deletion</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            You can delete individual runs from your dashboard at any time. To delete your account and
            all associated data, email us and we'll remove everything within 7 days.
            Anonymized aggregate benchmark data (with no individual identifiers) may persist.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Shared reports</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            When you enable public sharing on a report, anyone with the link can view it — including
            the destination URLs, UTM parameters, and check results. Only enable sharing on runs
            you are comfortable making accessible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Cookies</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            We use a single session cookie from Supabase Auth to keep you logged in. No advertising
            or analytics tracking cookies are set by us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Contact</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Privacy questions or deletion requests:{' '}
            <a href="mailto:jashshah854@gmail.com" className="text-blue-600 hover:underline">
              jashshah854@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
