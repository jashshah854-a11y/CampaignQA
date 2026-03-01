"""
Tier 2 Policy Compliance Checks — fetches landing page HTML and scans
for signals that would violate Meta/Google ad policies.
"""
import asyncio
import re
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity


# ── Keyword lists ──────────────────────────────────────────────────────────────
# Patterns that Meta and Google flag in landing pages / ad copy
_GUARANTEED_RE = re.compile(
    r"\b(guaranteed?|100\s*%\s*(free|results?|success)|risk[\s-]?free|no[\s-]?risk)\b",
    re.IGNORECASE,
)
_BEFORE_AFTER_RE = re.compile(r"\bbefore\b.{0,80}\bafter\b", re.IGNORECASE | re.DOTALL)
_PROHIBITED_CLAIMS_RE = re.compile(
    r"\b(cure[sd]?|miracle|instant\s+results?|lose\s+\d+\s+(lbs?|pounds?|kg)\s+in|"
    r"make\s+\$\d+\s+(a\s+day|per\s+day|daily)|work\s+from\s+home\s+and\s+earn)\b",
    re.IGNORECASE,
)
_PRIVACY_POLICY_RE = re.compile(r"privacy[\s\-]?policy|privacy[\s\-]?notice", re.IGNORECASE)


async def _fetch_html(url: str, timeout: int = 10) -> dict:
    import httpx
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LaunchProof/1.0)"},
        ) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                return {"url": url, "error": f"HTTP {resp.status_code}", "html": ""}
            # Limit to first 100 KB to avoid memory issues
            html = resp.text[:100_000]
            return {"url": url, "html": html, "status_code": resp.status_code}
    except Exception as exc:
        return {"url": url, "error": str(exc), "html": ""}


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result(timeout=60)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


class PrivacyPolicyPresentCheck(BaseCheck):
    check_id = "privacy_policy_present"
    check_name = "Privacy Policy Link on Landing Page"
    check_category = "tracking"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        # Deduplicate URLs by host to avoid redundant fetches
        seen_hosts: set[str] = set()
        urls_to_check = []
        for u in ctx.urls:
            if u.host and u.host not in seen_hosts:
                seen_hosts.add(u.host)
                urls_to_check.append(u)

        async def run_all():
            return await asyncio.gather(*[_fetch_html(u.raw_url) for u in urls_to_check])

        results = _run_async(run_all())

        missing = []
        for r in results:
            if r.get("error") or not r["html"]:
                continue
            if not _PRIVACY_POLICY_RE.search(r["html"]):
                missing.append(r["url"])

        if not missing:
            fetchable = [r for r in results if not r.get("error")]
            if not fetchable:
                return self._result(CheckStatus.skipped, "Could not fetch landing pages to check for privacy policy")
            return self._result(
                CheckStatus.passed,
                f"Privacy policy link found on all {len(fetchable)} checked landing page(s)",
            )

        return self._result(
            CheckStatus.failed,
            f"Privacy policy link missing on {len(missing)} landing page(s) — required by Meta and Google",
            recommendation="Add a clearly visible link to your Privacy Policy on all landing pages. Required to run ads on Meta, Google, TikTok, and LinkedIn.",
            affected_items=missing,
        )


class ProhibitedClaimsCheck(BaseCheck):
    check_id = "prohibited_claims"
    check_name = "Prohibited Claims & Policy Violations"
    check_category = "creative"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        seen_hosts: set[str] = set()
        urls_to_check = []
        for u in ctx.urls:
            if u.host and u.host not in seen_hosts:
                seen_hosts.add(u.host)
                urls_to_check.append(u)

        async def run_all():
            return await asyncio.gather(*[_fetch_html(u.raw_url) for u in urls_to_check])

        results = _run_async(run_all())

        violations: list[str] = []

        # Also check ad copy fields on the run context
        copy_to_check = " ".join(filter(None, [ctx.headline, ctx.primary_text, ctx.description]))

        for text, label in [(copy_to_check, "Ad copy")]:
            if not text:
                continue
            if m := _GUARANTEED_RE.search(text):
                violations.append(f"{label}: contains '{m.group()}' — misleading guarantee claims may get ads rejected")
            if m := _PROHIBITED_CLAIMS_RE.search(text):
                violations.append(f"{label}: contains prohibited claim '{m.group()}'")

        for r in results:
            if r.get("error") or not r["html"]:
                continue
            label = f"Landing page ({r['url']})"
            html = r["html"]
            if _BEFORE_AFTER_RE.search(html):
                violations.append(f"{label}: before/after comparison content detected — prohibited in health/fitness ads")
            if m := _PROHIBITED_CLAIMS_RE.search(html):
                violations.append(f"{label}: prohibited claim detected — '{m.group()}'")

        if not violations:
            return self._result(
                CheckStatus.passed,
                "No obvious prohibited claims detected in ad copy or landing pages",
            )

        return self._result(
            CheckStatus.warning,
            f"{len(violations)} potential policy violation(s) detected",
            recommendation="Review flagged content against Meta and Google ad policies before launching. Policy violations can result in ad rejection or account suspension.",
            affected_items=violations,
        )


for cls in [PrivacyPolicyPresentCheck, ProhibitedClaimsCheck]:
    CheckRegistry.register(cls())
