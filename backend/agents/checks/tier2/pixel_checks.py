"""
Tier 2 Pixel & Conversion Tracking Checks.
Fetches landing page HTML and scans for platform pixel/tag signatures.

Limitation: static HTML scanning only. Pixels loaded exclusively via
server-side rendering or via GTM data layers may not be visible here.
When GTM is present but a pixel is not found directly, we issue a warning
rather than a hard failure — GTM could be loading it dynamically.
"""
import asyncio
import time

import httpx

from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

# ── Pixel signatures by platform ──────────────────────────────────────────────

PIXEL_SIGNATURES: dict[str, list[str]] = {
    "meta": [
        "connect.facebook.net/en_US/fbevents.js",
        "connect.facebook.net/signals/config/",
        "fbq('init'",
        'fbq("init"',
    ],
    "google": [
        "googletagmanager.com/gtag/js",
        "gtag('config', 'G-",
        'gtag("config", "G-',
        "google-analytics.com/analytics.js",
        "google-analytics.com/g/collect",
    ],
    "tiktok": [
        "analytics.tiktok.com/i18n/pixel",
        "ttq.load(",
        "tiktok-pixel",
    ],
    "linkedin": [
        "snap.licdn.com/li.lms-analytics",
        "_linkedin_partner_id",
        "linkedin_partner_id =",
    ],
}

GTM_SIGNATURES = [
    "googletagmanager.com/gtm.js",
    "GTM-",
]

# Conversion event signatures — what fires on a conversion/lead page
CONVERSION_SIGNATURES: dict[str, list[str]] = {
    "meta": [
        "fbq('track'",
        'fbq("track"',
        "fbq('trackCustom'",
        'fbq("trackCustom"',
    ],
    "google": [
        "gtag('event'",
        'gtag("event"',
        "ga('send', 'event'",
        'ga("send", "event"',
    ],
    "tiktok": [
        "ttq.track(",
    ],
    "linkedin": [
        "lintrk(",
        "_linkedin_data_partner_ids",
    ],
}

# Campaign objectives where we enforce conversion event check
CONVERSION_OBJECTIVES = {"conversion", "lead_gen", "retargeting", "app_install"}

FETCH_TIMEOUT = 10  # seconds


# ── HTML fetcher ───────────────────────────────────────────────────────────────

async def _fetch_html(url: str) -> dict:
    """GET the page and return its text body. Returns empty string on error."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=FETCH_TIMEOUT,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; CampaignQA/1.0; +https://campaignqa.io)"
                )
            },
        ) as client:
            start = time.monotonic()
            resp = await client.get(url)
            elapsed = int((time.monotonic() - start) * 1000)
            return {
                "url": url,
                "html": resp.text,
                "status_code": resp.status_code,
                "elapsed_ms": elapsed,
                "ok": 200 <= resp.status_code < 400,
                "error": None,
            }
    except Exception as exc:
        return {
            "url": url,
            "html": "",
            "status_code": None,
            "elapsed_ms": 0,
            "ok": False,
            "error": str(exc),
        }


def _run_async(coro):
    """Run a coroutine from a sync context (mirrors reachability_checks pattern)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result(timeout=60)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def _fetch_unique_pages(ctx: RunContext) -> list[dict]:
    """Fetch HTML for each unique URL. Deduplicates by raw URL."""
    unique_urls = list({u.raw_url for u in ctx.urls})

    async def run_all():
        return await asyncio.gather(*[_fetch_html(url) for url in unique_urls])

    return _run_async(run_all())


def _has_gtm(html: str) -> bool:
    return any(sig in html for sig in GTM_SIGNATURES)


# ── Check 1: Platform Pixel Present ───────────────────────────────────────────

class PlatformPixelPresentCheck(BaseCheck):
    check_id = "pixel_platform_present"
    check_name = "Platform Tracking Pixel Installed"
    check_category = "tracking"
    platforms = ["meta", "google", "tiktok", "linkedin"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        signatures = PIXEL_SIGNATURES.get(ctx.platform.value)
        if not signatures:
            return self._result(CheckStatus.skipped, "Pixel check not configured for this platform")

        pages = _fetch_unique_pages(ctx)
        fetch_errors = [p for p in pages if not p["ok"]]
        fetchable = [p for p in pages if p["ok"]]

        if not fetchable:
            urls_str = ", ".join(p["url"] for p in fetch_errors)
            return self._result(
                CheckStatus.error,
                f"Could not fetch landing page(s) to check for pixel — {urls_str}",
                recommendation="Ensure destination URLs are publicly accessible",
            )

        missing_pixel = []
        gtm_fallback = []

        for page in fetchable:
            html = page["html"]
            found = any(sig in html for sig in signatures)
            if found:
                continue
            if _has_gtm(html):
                gtm_fallback.append(page["url"])
            else:
                missing_pixel.append(page["url"])

        fetch_error_note = (
            f" ({len(fetch_errors)} page(s) could not be fetched)" if fetch_errors else ""
        )

        if missing_pixel:
            platform_label = {
                "meta": "Meta Pixel (fbevents.js)",
                "google": "Google Analytics 4 / gtag.js",
                "tiktok": "TikTok Pixel",
                "linkedin": "LinkedIn Insight Tag",
            }.get(ctx.platform.value, ctx.platform.value + " pixel")

            return self._result(
                CheckStatus.failed,
                f"{platform_label} not detected on {len(missing_pixel)} landing page(s){fetch_error_note}",
                recommendation=(
                    f"Install the {platform_label} on your destination page(s) before launching. "
                    "Without it, campaign conversion data will not be attributed."
                ),
                affected_items=missing_pixel,
                metadata={"gtm_present_on": gtm_fallback},
            )

        if gtm_fallback:
            platform_label = ctx.platform.value.capitalize() + " pixel"
            return self._result(
                CheckStatus.warning,
                (
                    f"{platform_label} not found directly in HTML on {len(gtm_fallback)} page(s), "
                    f"but GTM is installed — pixel may be loading via GTM{fetch_error_note}"
                ),
                recommendation=(
                    "Verify in GTM that the pixel tag is configured and firing on All Pages. "
                    "Use the GTM Preview mode or browser extension to confirm."
                ),
                affected_items=gtm_fallback,
                metadata={"gtm_present_on": gtm_fallback},
            )

        return self._result(
            CheckStatus.passed,
            f"{ctx.platform.value.capitalize()} tracking pixel detected on all {len(fetchable)} page(s){fetch_error_note}",
            metadata={"pages_checked": len(fetchable)},
        )


# ── Check 2: Google Tag Manager Present ───────────────────────────────────────

class GoogleTagManagerPresentCheck(BaseCheck):
    check_id = "gtm_present"
    check_name = "Google Tag Manager Installed"
    check_category = "tracking"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        pages = _fetch_unique_pages(ctx)
        fetchable = [p for p in pages if p["ok"]]

        if not fetchable:
            return self._result(
                CheckStatus.error,
                "Could not fetch landing page(s) to check for GTM",
                recommendation="Ensure destination URLs are publicly accessible",
            )

        missing_gtm = [p["url"] for p in fetchable if not _has_gtm(p["html"])]

        if not missing_gtm:
            return self._result(
                CheckStatus.passed,
                f"Google Tag Manager detected on all {len(fetchable)} page(s)",
            )

        return self._result(
            CheckStatus.warning,
            f"GTM not detected on {len(missing_gtm)} of {len(fetchable)} page(s)",
            recommendation=(
                "GTM is the recommended way to manage all tracking tags in one place. "
                "Without it, adding/updating pixels requires code deployments."
            ),
            affected_items=missing_gtm,
        )


# ── Check 3: Conversion Event Detected ────────────────────────────────────────

class ConversionEventDetectedCheck(BaseCheck):
    check_id = "pixel_conversion_event"
    check_name = "Conversion Event Tracking Detected"
    check_category = "tracking"
    platforms = ["meta", "google", "tiktok", "linkedin"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        objective = (ctx.campaign_objective or "").lower().replace(" ", "_")
        if objective not in CONVERSION_OBJECTIVES:
            return self._result(
                CheckStatus.skipped,
                f"Conversion event check skipped — campaign objective is '{ctx.campaign_objective or 'not set'}' (only runs for conversion/lead_gen/retargeting/app_install)",
            )

        signatures = CONVERSION_SIGNATURES.get(ctx.platform.value)
        if not signatures:
            return self._result(CheckStatus.skipped, "Conversion event signatures not configured for this platform")

        pages = _fetch_unique_pages(ctx)
        fetchable = [p for p in pages if p["ok"]]

        if not fetchable:
            return self._result(
                CheckStatus.error,
                "Could not fetch landing page(s) to check for conversion events",
                recommendation="Ensure destination URLs are publicly accessible",
            )

        no_events = []
        gtm_possible = []

        for page in fetchable:
            html = page["html"]
            found = any(sig in html for sig in signatures)
            if found:
                continue
            if _has_gtm(html):
                gtm_possible.append(page["url"])
            else:
                no_events.append(page["url"])

        if no_events:
            event_examples = {
                "meta": "fbq('track', 'Lead') or fbq('track', 'Purchase')",
                "google": "gtag('event', 'generate_lead') or gtag('event', 'purchase')",
                "tiktok": "ttq.track('CompletePayment') or ttq.track('SubmitForm')",
                "linkedin": "lintrk('track', { conversion_id: ... })",
            }.get(ctx.platform.value, "platform conversion event")

            return self._result(
                CheckStatus.failed,
                (
                    f"No {ctx.platform.value.capitalize()} conversion events detected on "
                    f"{len(no_events)} page(s) — campaign objective is '{ctx.campaign_objective}'"
                ),
                recommendation=(
                    f"Add a conversion event to your landing/thank-you page. Example: {event_examples}. "
                    "Without this, the platform cannot optimize toward your campaign objective."
                ),
                affected_items=no_events,
                metadata={"gtm_present_on": gtm_possible},
            )

        if gtm_possible:
            return self._result(
                CheckStatus.warning,
                (
                    f"No inline conversion events found on {len(gtm_possible)} page(s), "
                    "but GTM is present — conversion events may be firing via GTM triggers"
                ),
                recommendation=(
                    "Verify in GTM that a conversion event fires on the correct trigger "
                    "(e.g., thank-you page URL, form submit). Use GTM Preview to confirm."
                ),
                affected_items=gtm_possible,
            )

        return self._result(
            CheckStatus.passed,
            f"Conversion event tracking detected on all {len(fetchable)} page(s)",
            metadata={"pages_checked": len(fetchable)},
        )


# ── Register ───────────────────────────────────────────────────────────────────

for cls in [
    PlatformPixelPresentCheck,
    GoogleTagManagerPresentCheck,
    ConversionEventDetectedCheck,
]:
    CheckRegistry.register(cls())
