"""
Tier 2 Security Header Checks — validates HTTP security response headers on landing pages.

Google's landing page quality algorithm and ad policies penalise insecure or untrustworthy
pages. Missing HSTS means browsers may not enforce HTTPS. Missing CSP increases XSS risk,
which can lead to ad account suspension if the landing page is flagged as malicious.

Runs async in background (tier 2).
"""
from urllib.parse import urlparse

import httpx

from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

_HEADERS = {
    "User-Agent": "LaunchProof-QA/1.0 (pre-launch campaign checker)",
}


def _get_headers(url: str, timeout: float = 8.0) -> dict:
    """Fetch response headers for a URL (HEAD first, fall back to GET)."""
    try:
        resp = httpx.head(url, headers=_HEADERS, follow_redirects=True, timeout=timeout)
        return {"url": url, "headers": dict(resp.headers), "error": None}
    except Exception:
        pass
    try:
        resp = httpx.get(url, headers=_HEADERS, follow_redirects=True, timeout=timeout)
        return {"url": url, "headers": dict(resp.headers), "error": None}
    except Exception as exc:
        return {"url": url, "headers": {}, "error": str(exc)}


class SecurityHeaderCheck(BaseCheck):
    """
    Checks for HTTP security headers on landing pages.

    Checks:
    - Strict-Transport-Security (HSTS): enforces HTTPS — critical for ad platform trust
    - X-Content-Type-Options: prevents MIME sniffing attacks
    - X-Frame-Options: prevents clickjacking (relevant for iframed checkout pages)

    Missing these doesn't block ads directly, but affects landing page quality scores
    and increases risk of account suspension if pages are compromised.
    """
    check_id = "security_headers"
    check_name = "HTTP Security Headers"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 2

    # Headers and their explanations
    _REQUIRED_HEADERS = {
        "strict-transport-security": "HSTS (forces HTTPS for return visitors)",
        "x-content-type-options": "prevents MIME-type sniffing attacks",
        "x-frame-options": "prevents clickjacking via iframes",
    }

    def execute(self, ctx: RunContext) -> CheckResult:
        # Only check HTTPS URLs (HTTP sites can't serve HSTS)
        unique_https: list[str] = []
        seen: set[str] = set()
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.scheme == "https" and u.raw_url not in seen:
                unique_https.append(u.raw_url)
                seen.add(u.raw_url)

        if not unique_https:
            return self._result(CheckStatus.skipped, "No HTTPS URLs to check for security headers")

        results = [_get_headers(url) for url in unique_https[:10]]
        reachable = [r for r in results if not r["error"]]

        if not reachable:
            return self._result(CheckStatus.error, "Could not fetch headers from any landing page")

        missing_per_url: list[str] = []
        all_missing_headers: set[str] = set()

        for r in reachable:
            lower_headers = {k.lower(): v for k, v in r["headers"].items()}
            missing = [
                label for header, label in self._REQUIRED_HEADERS.items()
                if header not in lower_headers
            ]
            if missing:
                missing_per_url.append(f"{r['url']} — missing: {', '.join(missing)}")
                all_missing_headers.update(missing)

        if missing_per_url:
            # Prioritize HSTS since that's the most impactful
            hsts_missing = any("HSTS" in m for m in missing_per_url)
            return self._result(
                CheckStatus.warning,
                f"{len(missing_per_url)} URL(s) missing security headers. "
                + ("Missing HSTS means browsers may not enforce HTTPS on return visits. " if hsts_missing else "")
                + "Google's Landing Page Experience algorithm factors in page security.",
                recommendation=(
                    "Add these headers to your web server or CDN configuration:\n"
                    "  Strict-Transport-Security: max-age=31536000; includeSubDomains\n"
                    "  X-Content-Type-Options: nosniff\n"
                    "  X-Frame-Options: SAMEORIGIN\n"
                    "Most CDNs (Cloudflare, Fastly, CloudFront) let you set these without code changes."
                ),
                affected_items=missing_per_url[:10],
            )

        return self._result(
            CheckStatus.passed,
            f"All required security headers present on {len(reachable)} checked HTTPS page(s)",
            metadata={"checked_urls": [r["url"] for r in reachable]},
        )


CheckRegistry.register(SecurityHeaderCheck())
