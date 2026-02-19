"""
Tier 2 Reachability Checks — HTTP I/O, run async in background.
"""
import asyncio
import time
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity


async def _check_url(session, url: str, timeout: int = 8) -> dict:
    """HEAD request with redirect following. Returns status info."""
    import httpx
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": "QATool/1.0 (prelaunch-check)"},
        ) as client:
            start = time.monotonic()
            resp = await client.head(url)
            elapsed = int((time.monotonic() - start) * 1000)
            return {
                "url": url,
                "status_code": resp.status_code,
                "redirect_count": len(resp.history),
                "final_url": str(resp.url),
                "elapsed_ms": elapsed,
                "ok": 200 <= resp.status_code < 400,
            }
    except Exception as exc:
        return {
            "url": url,
            "status_code": None,
            "redirect_count": 0,
            "final_url": url,
            "elapsed_ms": 0,
            "ok": False,
            "error": str(exc),
        }


def _run_async(coro):
    """Run coroutine from sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result(timeout=30)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


class UrlReachabilityCheck(BaseCheck):
    check_id = "url_reachable"
    check_name = "Destination URLs Are Reachable"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        async def run_all():
            return await asyncio.gather(*[_check_url(None, u.raw_url) for u in ctx.urls])

        results = _run_async(run_all())
        unreachable = [r for r in results if not r["ok"]]
        slow = [r for r in results if r["ok"] and r["elapsed_ms"] > 3000]

        if unreachable:
            return self._result(
                CheckStatus.failed,
                f"{len(unreachable)} of {len(results)} URL(s) are unreachable or returned an error",
                recommendation="Fix broken destination URLs before launching the campaign",
                affected_items=[f"{r['url']} (status: {r.get('status_code', 'timeout')})" for r in unreachable],
                metadata={"results": results},
            )
        if slow:
            return self._result(
                CheckStatus.warning,
                f"All URLs reachable, but {len(slow)} URL(s) responded slowly (>3s) — may impact Quality Score",
                recommendation="Improve landing page load time for better ad Quality Score and conversion rates",
                affected_items=[f"{r['url']} ({r['elapsed_ms']}ms)" for r in slow],
            )
        return self._result(
            CheckStatus.passed,
            f"All {len(results)} URL(s) are reachable",
            metadata={"avg_ms": int(sum(r["elapsed_ms"] for r in results) / len(results))},
        )


class UrlRedirectDepthCheck(BaseCheck):
    check_id = "url_redirect_depth"
    check_name = "URL Redirect Chain Depth"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2
    MAX_REDIRECTS = 3

    def execute(self, ctx: RunContext) -> CheckResult:
        async def run_all():
            return await asyncio.gather(*[_check_url(None, u.raw_url) for u in ctx.urls])

        results = _run_async(run_all())
        deep_redirects = [r for r in results if r.get("redirect_count", 0) > self.MAX_REDIRECTS]

        if not deep_redirects:
            return self._result(
                CheckStatus.passed,
                f"All URL(s) have redirect chains of {self.MAX_REDIRECTS} hops or fewer",
            )
        return self._result(
            CheckStatus.warning,
            f"{len(deep_redirects)} URL(s) have redirect chains longer than {self.MAX_REDIRECTS} hops — slows page load",
            recommendation="Shorten redirect chains to reduce latency. Each redirect adds 100–300ms load time.",
            affected_items=[f"{r['url']} ({r['redirect_count']} redirects → {r['final_url']})" for r in deep_redirects],
        )


class UtmParameterPreservedThroughRedirectCheck(BaseCheck):
    check_id = "utm_preserved_through_redirect"
    check_name = "UTM Parameters Preserved Through Redirects"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        urls_with_utm = [u for u in ctx.urls if "utm_source" in u.params]
        if not urls_with_utm:
            return self._result(CheckStatus.skipped, "No UTM parameters to check for redirect preservation")

        async def run_all():
            return await asyncio.gather(*[_check_url(None, u.raw_url) for u in urls_with_utm])

        results = _run_async(run_all())

        stripped = []
        for r in results:
            if r["ok"] and r["redirect_count"] > 0:
                if "utm_" not in r["final_url"]:
                    stripped.append(f"{r['url']} → {r['final_url']} (UTM stripped)")

        if not stripped:
            return self._result(
                CheckStatus.passed,
                "UTM parameters appear to be preserved through redirects",
            )
        return self._result(
            CheckStatus.failed,
            f"UTM parameters stripped by redirect on {len(stripped)} URL(s) — campaign attribution will be lost",
            recommendation="Update redirect rules to pass through all query parameters, or use canonical final URLs with UTM params appended directly",
            affected_items=stripped,
        )


# Register all
for cls in [
    UrlReachabilityCheck,
    UrlRedirectDepthCheck,
    UtmParameterPreservedThroughRedirectCheck,
]:
    CheckRegistry.register(cls())
