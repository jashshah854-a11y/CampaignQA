"""
Tier 2 Open Graph / Social Preview Checks.
Fetches landing pages and verifies og:title, og:image, og:description are present.
Missing OG tags = broken social previews when ads link to the page.
"""
import asyncio
import re
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

_OG_TITLE_RE = re.compile(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', re.IGNORECASE)
_OG_IMAGE_RE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', re.IGNORECASE)
_OG_DESC_RE = re.compile(r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)', re.IGNORECASE)
# Also match reversed attribute order (content before property)
_OG_TITLE_RE2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title', re.IGNORECASE)
_OG_IMAGE_RE2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', re.IGNORECASE)
_OG_DESC_RE2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description', re.IGNORECASE)


def _has_og(html: str, *patterns) -> bool:
    return any(p.search(html) for p in patterns)


async def _fetch_head(url: str, timeout: int = 10) -> dict:
    """Fetch first 50KB of HTML (enough to capture <head> tags)."""
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
                chunks = []
                size = 0
                async for chunk in resp.aiter_bytes(4096):
                    chunks.append(chunk)
                    size += len(chunk)
                    if size >= 50_000:
                        break
                html = b"".join(chunks).decode("utf-8", errors="replace")
                return {"url": url, "html": html}
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


class OpenGraphTagsCheck(BaseCheck):
    check_id = "og_tags_present"
    check_name = "Open Graph / Social Preview Tags Present"
    check_category = "tracking"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        # Deduplicate by host
        seen: set[str] = set()
        urls_to_check = []
        for u in ctx.urls:
            if u.host and u.host not in seen:
                seen.add(u.host)
                urls_to_check.append(u)

        async def run_all():
            return await asyncio.gather(*[_fetch_head(u.raw_url) for u in urls_to_check])

        results = _run_async(run_all())

        missing_title: list[str] = []
        missing_image: list[str] = []
        missing_desc: list[str] = []

        for r in results:
            if r.get("error") or not r["html"]:
                continue
            html = r["html"]
            url = r["url"]
            if not _has_og(html, _OG_TITLE_RE, _OG_TITLE_RE2):
                missing_title.append(url)
            if not _has_og(html, _OG_IMAGE_RE, _OG_IMAGE_RE2):
                missing_image.append(url)
            if not _has_og(html, _OG_DESC_RE, _OG_DESC_RE2):
                missing_desc.append(url)

        fetchable = [r for r in results if not r.get("error") and r["html"]]
        if not fetchable:
            return self._result(CheckStatus.skipped, "Could not fetch landing pages to check OG tags")

        all_missing = list(set(missing_title + missing_image + missing_desc))
        if not all_missing:
            return self._result(
                CheckStatus.passed,
                f"og:title, og:image, og:description present on all {len(fetchable)} checked landing page(s)",
            )

        affected: list[str] = []
        for url in sorted(all_missing):
            parts = []
            if url in missing_title:
                parts.append("og:title")
            if url in missing_image:
                parts.append("og:image")
            if url in missing_desc:
                parts.append("og:description")
            affected.append(f"{url} — missing: {', '.join(parts)}")

        return self._result(
            CheckStatus.warning,
            f"Missing OG tags on {len(all_missing)} landing page(s) — social previews may appear broken when shared",
            recommendation="Add og:title, og:image (min 1200×630px), and og:description to all landing pages. These control how your ad's destination looks when shared on social platforms.",
            affected_items=affected,
        )


CheckRegistry.register(OpenGraphTagsCheck())
