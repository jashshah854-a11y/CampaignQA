import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white py-4 px-6 flex items-center justify-between">
        <Link to="/" className="font-bold text-slate-900">LaunchProof</Link>
        <Link to="/login" className="text-sm text-blue-600 hover:underline">Sign in →</Link>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12 prose prose-slate">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: March 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">1. Acceptance</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            By creating an account or using LaunchProof ("the Service"), you agree to these Terms of Service.
            If you do not agree, do not use the Service. LaunchProof is operated by an individual developer
            and is provided as-is for paid media professionals.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">2. Description of Service</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            LaunchProof is a pre-launch QA tool for paid advertising campaigns. It analyzes URLs,
            UTM parameters, ad copy, and landing page properties and returns a readiness score.
            Results are informational and do not guarantee ad platform approval.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">3. Free and Paid Plans</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Free accounts are limited to 3 QA runs. Pro and Agency plans are billed monthly via Stripe.
            Subscriptions renew automatically. You may cancel at any time; cancellation takes effect at
            the end of the current billing period. No refunds for partial months.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">4. Acceptable Use</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-2">You agree not to:</p>
          <ul className="text-slate-600 text-sm space-y-1 list-disc pl-5">
            <li>Use the Service to scan URLs you do not own or have authorization to test</li>
            <li>Attempt to reverse-engineer, scrape, or abuse the API beyond reasonable use</li>
            <li>Share your account credentials with others on the Free plan</li>
            <li>Submit URLs containing malware or phishing content</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">5. Data and Reports</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            QA run data is stored to provide the Service and to generate anonymized aggregate benchmarks
            (the "Rule of 10" — no individual run is exposed in benchmarks). You may delete your runs
            at any time. Deleted data is removed within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">6. Disclaimer of Warranties</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. CHECK RESULTS ARE INFORMATIONAL
            ONLY. WE DO NOT GUARANTEE THAT CAMPAIGNS PASSING ALL CHECKS WILL BE APPROVED BY AD PLATFORMS.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">7. Limitation of Liability</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS
            PAID BY YOU IN THE THREE MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">8. Changes</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            We may update these Terms at any time. Continued use after changes constitutes acceptance.
            Material changes will be communicated via the email address on your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">9. Contact</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Questions? Email us at{' '}
            <a href="mailto:jashshah854@gmail.com" className="text-blue-600 hover:underline">
              jashshah854@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
