"""
Tier 2 Page Content Checks — fetches landing page HTML and validates structural signals.

These checks catch issues that directly cause ad waste or platform policy violations
without being covered by the UTM/URL/SSL/policy checks.

Runs async in background (tier 2).
"""
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

_HEADERS = {
    "User-Agent": "LaunchProof-QA/1.0 (pre-launch campaign checker)",
    "Accept": "text/html,application/xhtml+xml",
}

# Title patterns that indicate a broken or placeholder page
_BAD_TITLE_RE = re.compile(
    r"^(404|403|error|not found|access denied|page not found|coming soon|"
    r"untitled|blank|home|index|test|placeholder|lorem ipsum|\s*)$",
    re.IGNORECASE,
)

# Cookie consent signals — presence of any of these suggests GDPR compliance
_COOKIE_CONSENT_SIGNALS = [
    "cookie",
    "gdpr",
    "consent",
    "cookiebot",
    "onetrust",
    "cookieyes",
    "usercentrics",
    "complianz",
    "didomi",
    "cookieinformation",
    "trustarc",
]


def _fetch_page(url: str, timeout: float = 8.0) -> dict:
    try:
        resp = httpx.get(url, headers=_HEADERS, follow_redirects=True, timeout=timeout)
        html = resp.text[:150_000]
        return {"url": url, "html": html, "status_code": resp.status_code, "error": None}
    except httpx.TimeoutException:
        return {"url": url, "html": "", "status_code": None, "error": "Timed out"}
    except Exception as exc:
        return {"url": url, "html": "", "status_code": None, "error": str(exc)}


def _unique_hosts(ctx: RunContext) -> list[str]:
    """Return one URL per unique host to avoid redundant fetches."""
    seen: set[str] = set()
    result: list[str] = []
    for u in ctx.urls:
        parsed = urlparse(u.raw_url)
        if parsed.scheme in ("http", "https") and parsed.netloc not in seen:
            seen.add(parsed.netloc)
            result.append(u.raw_url)
    return result[:10]


class CanonicalTagCheck(BaseCheck):
    """
    Checks that landing pages have a canonical <link> tag.

    Missing canonical tags can cause search engines to index UTM-parameterised URLs,
    confuse attribution, and create duplicate content issues that affect Quality Score.
    """
    check_id = "canonical_tag"
    check_name = "Canonical Tag Present"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls = _unique_hosts(ctx)
        if not urls:
            return self._result(CheckStatus.skipped, "No HTTP/HTTPS URLs to check for canonical tags")

        missing: list[str] = []
        errors: list[str] = []

        for url in urls:
            page = _fetch_page(url)
            if page["error"] or not page["html"]:
                errors.append(url)
                continue
            soup = BeautifulSoup(page["html"], "html.parser")
            canonical = soup.find("link", rel=lambda r: r and "canonical" in r)
            if not canonical:
                missing.append(url)

        reachable = len(urls) - len(errors)
        if reachable == 0:
            return self._result(CheckStatus.error, "Could not fetch landing pages for canonical tag check")

        if missing:
            return self._result(
                CheckStatus.warning,
                f"{len(missing)} landing page(s) missing <link rel='canonical'> — UTM URLs may be indexed by search engines",
                recommendation=(
                    "Add <link rel='canonical' href='https://yoursite.com/landing-page'> in <head> "
                    "to tell search engines which URL is canonical. This prevents UTM-parameterised URLs "
                    "from being indexed and diluting page authority."
                ),
                affected_items=missing,
            )

        return self._result(
            CheckStatus.passed,
            f"Canonical tag found on all {reachable} checked landing page(s)",
        )


class CookieConsentCheck(BaseCheck):
    """
    Checks for cookie consent signals on landing pages.

    Running ads to EU audiences without a GDPR-compliant cookie consent mechanism
    risks Meta/Google ad account suspension and regulatory fines. This check scans
    for signals of known consent management platforms (CMPs).
    """
    check_id = "cookie_consent"
    check_name = "Cookie Consent / GDPR Signal"
    check_category = "tracking"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls = _unique_hosts(ctx)
        if not urls:
            return self._result(CheckStatus.skipped, "No HTTP/HTTPS URLs to check for cookie consent")

        missing: list[str] = []
        found: list[str] = []
        errors: list[str] = []

        for url in urls:
            page = _fetch_page(url)
            if page["error"] or not page["html"]:
                errors.append(url)
                continue
            html_lower = page["html"].lower()
            detected = [signal for signal in _COOKIE_CONSENT_SIGNALS if signal in html_lower]
            if detected:
                found.append(f"{url} ({detected[0]})")
            else:
                missing.append(url)

        reachable = len(urls) - len(errors)
        if reachable == 0:
            return self._result(CheckStatus.error, "Could not fetch landing pages for cookie consent check")

        if missing:
            return self._result(
                CheckStatus.warning,
                f"{len(missing)} landing page(s) show no cookie consent signals — may violate GDPR for EU ad audiences",
                recommendation=(
                    "Install a consent management platform (CookieYes, CookieBot, OneTrust, or similar) "
                    "on all landing pages. This is legally required for EU audiences and enforced by Meta/Google "
                    "for conversion tracking."
                ),
                affected_items=missing,
            )

        return self._result(
            CheckStatus.passed,
            f"Cookie consent signals detected on {len(found)} landing page(s)",
            metadata={"detected": found},
        )


class LandingPageTitleCheck(BaseCheck):
    """
    Validates that landing page <title> tags are not empty, generic, or error indicators.

    A title of '404', 'Error', or a blank string means the ad is sending traffic to
    a broken or misconfigured page — direct ad spend waste.
    """
    check_id = "landing_page_title"
    check_name = "Landing Page Title"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls = _unique_hosts(ctx)
        if not urls:
            return self._result(CheckStatus.skipped, "No HTTP/HTTPS URLs to check for page title")

        broken: list[str] = []
        errors: list[str] = []
        titles: list[str] = []

        for url in urls:
            page = _fetch_page(url)
            if page["error"] or not page["html"]:
                errors.append(url)
                continue
            soup = BeautifulSoup(page["html"], "html.parser")
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else ""
            titles.append(f"{url} → '{title}'")

            if not title or _BAD_TITLE_RE.match(title):
                broken.append(f"{url} (title: '{title or 'empty'}')")

        reachable = len(urls) - len(errors)
        if reachable == 0:
            return self._result(CheckStatus.error, "Could not fetch landing pages to check titles")

        if broken:
            return self._result(
                CheckStatus.failed,
                f"{len(broken)} landing page(s) have a missing, blank, or error-indicating title tag — likely sending ad traffic to a broken page",
                recommendation=(
                    "Fix the landing page title to reflect the page content. "
                    "A 404/error title means your ad destination is broken — pause the campaign immediately."
                ),
                affected_items=broken,
            )

        return self._result(
            CheckStatus.passed,
            f"Landing page title tags present and non-generic on all {reachable} checked page(s)",
            metadata={"titles": titles},
        )


for cls in [CanonicalTagCheck, CookieConsentCheck, LandingPageTitleCheck]:
    CheckRegistry.register(cls())
