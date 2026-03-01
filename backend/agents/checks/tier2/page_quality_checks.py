"""
Tier 2 Page Quality Checks — fetch landing pages and inspect meta tags.

Checks:
- NoindexCheck: landing page must NOT have robots noindex (ad platforms penalize it)
- ViewportMetaCheck: landing page must have <meta name="viewport"> for mobile ads
"""
import asyncio
import re
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

_NOINDEX_RE = re.compile(
    r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex',
    re.IGNORECASE,
)
_NOINDEX_RE2 = re.compile(
    r'<meta[^>]+content=["\'][^"\']*noindex[^"\']*["\'][^>]+name=["\']robots',
    re.IGNORECASE,
)
_VIEWPORT_RE = re.compile(
    r'<meta[^>]+name=["\']viewport["\']',
    re.IGNORECASE,
)


async def _fetch_head(url: str, timeout: int = 10) -> dict:
    import httpx
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LaunchProof/1.0)"},
        ) as client:
            async with client.stream("GET", url) as resp:
                if resp.status_code >= 400:
                    return {"url": url, "error": f"HTTP {resp.status_code}", "html": ""}
                chunks, size = [], 0
                async for chunk in resp.aiter_bytes(4096):
                    chunks.append(chunk)
                    size += len(chunk)
                    if size >= 30_000:
                        break
                return {"url": url, "html": b"".join(chunks).decode("utf-8", errors="replace")}
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


def _unique_by_host(ctx: RunContext):
    seen: set[str] = set()
    out = []
    for u in ctx.urls:
        if u.host and u.host not in seen:
            seen.add(u.host)
            out.append(u)
    return out


class NoindexCheck(BaseCheck):
    check_id = "landing_page_not_noindex"
    check_name = "Landing Page Not Blocked from Search Engines"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls_to_check = _unique_by_host(ctx)

        async def run_all():
            return await asyncio.gather(*[_fetch_head(u.raw_url) for u in urls_to_check])

        results = _run_async(run_all())
        noindexed = [
            r["url"] for r in results
            if not r.get("error") and r["html"]
            and (_NOINDEX_RE.search(r["html"]) or _NOINDEX_RE2.search(r["html"]))
        ]
        fetchable = [r for r in results if not r.get("error") and r["html"]]

        if not fetchable:
            return self._result(CheckStatus.skipped, "Could not fetch landing pages to check robots meta")

        if noindexed:
            return self._result(
                CheckStatus.failed,
                f"{len(noindexed)} landing page(s) have robots noindex — ad platforms may penalize or reject",
                recommendation="Remove 'noindex' from the robots meta tag on your landing pages. Ad quality scores are affected by crawlability.",
                affected_items=noindexed,
            )
        return self._result(
            CheckStatus.passed,
            f"No noindex robots meta tag found on {len(fetchable)} landing page(s)",
        )


class ViewportMetaCheck(BaseCheck):
    check_id = "landing_page_viewport_meta"
    check_name = "Mobile Viewport Meta Tag Present"
    check_category = "url"
    platforms = ["meta", "tiktok", "universal"]
    severity = Severity.minor
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls_to_check = _unique_by_host(ctx)

        async def run_all():
            return await asyncio.gather(*[_fetch_head(u.raw_url) for u in urls_to_check])

        results = _run_async(run_all())
        missing = [
            r["url"] for r in results
            if not r.get("error") and r["html"] and not _VIEWPORT_RE.search(r["html"])
        ]
        fetchable = [r for r in results if not r.get("error") and r["html"]]

        if not fetchable:
            return self._result(CheckStatus.skipped, "Could not fetch landing pages to check viewport meta")

        if missing:
            return self._result(
                CheckStatus.warning,
                f"{len(missing)} landing page(s) missing <meta name=\"viewport\"> — poor mobile experience will hurt ad Quality Score",
                recommendation='Add <meta name="viewport" content="width=device-width, initial-scale=1"> to all landing page <head> sections.',
                affected_items=missing,
            )
        return self._result(
            CheckStatus.passed,
            f"Mobile viewport meta tag present on all {len(fetchable)} landing page(s)",
        )


for cls in [NoindexCheck, ViewportMetaCheck]:
    CheckRegistry.register(cls())
