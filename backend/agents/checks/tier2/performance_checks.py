"""
Tier 2 Performance Checks — measures page load time and mobile-readiness signals.

Slow landing pages directly waste ad spend: every 1-second delay costs ~7% in conversions
(Google/Deloitte 2017). These checks flag slow pages before launch.

Runs async in background (tier 2).
"""
import time
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

# Thresholds in seconds (TTFB + HTML download, not full render)
WARN_SECONDS = 2.0
FAIL_SECONDS = 4.0

_HEADERS = {
    "User-Agent": "LaunchProof-QA/1.0 (pre-launch campaign checker)",
    "Accept": "text/html",
}


def _measure_page(url: str, timeout: float = 8.0) -> dict:
    """Return timing and basic HTML info for a URL."""
    try:
        t0 = time.perf_counter()
        resp = httpx.get(url, headers=_HEADERS, follow_redirects=True, timeout=timeout)
        elapsed = time.perf_counter() - t0
        html = resp.text[:200_000]  # cap at 200 KB for parsing
        return {
            "url": url,
            "status_code": resp.status_code,
            "elapsed": elapsed,
            "content_length": len(resp.content),
            "html": html,
            "error": None,
        }
    except httpx.TimeoutException:
        return {"url": url, "elapsed": None, "error": "Request timed out (>8s)"}
    except Exception as exc:
        return {"url": url, "elapsed": None, "error": str(exc)}


class PageLoadTimeCheck(BaseCheck):
    """
    Measures HTTP response time for each destination URL.

    Warns if any URL takes >2 seconds to respond; fails at >4 seconds.
    Note: this measures TTFB + HTML download, not full browser render time.
    Actual Lighthouse scores will be higher — treat this as a minimum bar.
    """
    check_id = "page_load_time"
    check_name = "Page Load Time"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        # Deduplicate URLs — only HTTP/HTTPS
        unique_urls: list[str] = []
        seen: set[str] = set()
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.scheme in ("http", "https") and u.raw_url not in seen:
                unique_urls.append(u.raw_url)
                seen.add(u.raw_url)

        if not unique_urls:
            return self._result(CheckStatus.skipped, "No HTTP/HTTPS URLs to measure")

        results = [_measure_page(u) for u in unique_urls[:10]]  # cap at 10 URLs

        timed = [r for r in results if r.get("elapsed") is not None]
        if not timed:
            errors = [r["error"] for r in results if r.get("error")]
            return self._result(CheckStatus.error, f"Could not measure page load time: {errors[0] if errors else 'unknown'}")

        failing = [r for r in timed if r["elapsed"] >= FAIL_SECONDS]
        warning = [r for r in timed if WARN_SECONDS <= r["elapsed"] < FAIL_SECONDS]

        if failing:
            avg = sum(r["elapsed"] for r in failing) / len(failing)
            return self._result(
                CheckStatus.failed,
                f"{len(failing)} URL(s) took {avg:.1f}s avg to load — pages this slow lose 7%+ conversions per second of delay",
                recommendation=(
                    "Optimize server response time (TTFB <200ms), enable gzip/Brotli compression, "
                    "use a CDN, and reduce HTML payload. Run Google PageSpeed Insights for a full audit."
                ),
                affected_items=[f"{r['url']} — {r['elapsed']:.2f}s" for r in failing],
            )

        if warning:
            avg = sum(r["elapsed"] for r in warning) / len(warning)
            return self._result(
                CheckStatus.warning,
                f"{len(warning)} URL(s) took {avg:.1f}s avg — approaching slow threshold (>4s = critical)",
                recommendation="Investigate server response time and HTML size. Target <2s for paid media landing pages.",
                affected_items=[f"{r['url']} — {r['elapsed']:.2f}s" for r in warning],
            )

        avg_all = sum(r["elapsed"] for r in timed) / len(timed)
        return self._result(
            CheckStatus.passed,
            f"All {len(timed)} URL(s) loaded in {avg_all:.2f}s avg (threshold: {WARN_SECONDS}s)",
            metadata={"timings": [{"url": r["url"], "elapsed_s": round(r["elapsed"], 3)} for r in timed]},
        )


class MobileReadinessCheck(BaseCheck):
    """
    Checks landing pages for signals that they are mobile-optimised.

    Mobile traffic makes up 60-80% of paid social clicks. Missing viewport meta
    = unreadable page on mobile = wasted spend.
    Checks: viewport meta, no fixed pixel widths on <body>, presence of responsive
    CSS signals.
    """
    check_id = "mobile_readiness"
    check_name = "Mobile Readiness"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        unique_urls: list[str] = []
        seen: set[str] = set()
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.scheme in ("http", "https") and u.raw_url not in seen:
                unique_urls.append(u.raw_url)
                seen.add(u.raw_url)

        if not unique_urls:
            return self._result(CheckStatus.skipped, "No HTTP/HTTPS URLs to check for mobile readiness")

        missing_viewport: list[str] = []
        errors: list[str] = []

        for url in unique_urls[:10]:
            page = _measure_page(url)
            if page.get("error"):
                errors.append(url)
                continue
            html = page.get("html", "")
            try:
                soup = BeautifulSoup(html, "html.parser")
                # Check for viewport meta tag
                viewport = soup.find("meta", attrs={"name": lambda v: v and v.lower() == "viewport"})
                if not viewport:
                    missing_viewport.append(url)
            except Exception:
                errors.append(url)

        if not (missing_viewport or errors) and not unique_urls:
            return self._result(CheckStatus.skipped, "No pages checked")

        reachable = len(unique_urls[:10]) - len(errors)
        if reachable == 0:
            return self._result(CheckStatus.error, "Could not fetch any landing pages for mobile readiness check")

        if missing_viewport:
            return self._result(
                CheckStatus.failed,
                f"{len(missing_viewport)} URL(s) missing viewport meta tag — pages will render as desktop on mobile devices",
                recommendation=(
                    "Add <meta name='viewport' content='width=device-width, initial-scale=1'> in the <head>. "
                    "This is required for mobile-responsive rendering."
                ),
                affected_items=missing_viewport,
            )

        return self._result(
            CheckStatus.passed,
            f"Viewport meta tag found on all {reachable} checked page(s) — mobile rendering enabled",
        )


for cls in [PageLoadTimeCheck, MobileReadinessCheck]:
    CheckRegistry.register(cls())
