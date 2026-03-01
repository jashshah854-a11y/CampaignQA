"""
Tier 2 VirusTotal Checks — domain safety via VirusTotal API.
Skipped gracefully when VIRUSTOTAL_API_KEY is not configured.
"""
import asyncio
from urllib.parse import urlparse
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity
from core.config import get_settings


async def _check_domain(domain: str, api_key: str) -> dict:
    """Query VirusTotal v3 domain report."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.virustotal.com/api/v3/domains/{domain}",
                headers={"x-apikey": api_key},
            )
            if resp.status_code == 404:
                return {"domain": domain, "malicious": 0, "suspicious": 0, "status": "unknown"}
            if resp.status_code == 429:
                return {"domain": domain, "error": "rate_limited"}
            resp.raise_for_status()
            data = resp.json()
            stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
            return {
                "domain": domain,
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "status": "ok",
            }
    except Exception as exc:
        return {"domain": domain, "error": str(exc)}


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result(timeout=30)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


class VirusTotalDomainSafetyCheck(BaseCheck):
    check_id = "virustotal_domain_safety"
    check_name = "Domain Safety Check (VirusTotal)"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        api_key = get_settings().virustotal_api_key
        if not api_key:
            return self._result(
                CheckStatus.skipped,
                "Domain safety check skipped — VIRUSTOTAL_API_KEY not configured",
            )

        # Deduplicate domains
        domains = list({urlparse(u.raw_url).netloc.lower().split(":")[0] for u in ctx.urls if u.raw_url})
        if not domains:
            return self._result(CheckStatus.skipped, "No domains to check")

        async def run_all():
            # VirusTotal free tier: 4 req/min — add a small delay between calls
            results = []
            for i, domain in enumerate(domains):
                if i > 0:
                    await asyncio.sleep(0.3)
                results.append(await _check_domain(domain, api_key))
            return results

        results = _run_async(run_all())

        flagged = [r for r in results if r.get("malicious", 0) > 0]
        suspicious = [r for r in results if r.get("malicious", 0) == 0 and r.get("suspicious", 0) > 2]
        errors = [r for r in results if "error" in r]

        if flagged:
            return self._result(
                CheckStatus.failed,
                f"{len(flagged)} domain(s) flagged as malicious by VirusTotal — do NOT launch",
                recommendation="These domains are flagged by multiple antivirus engines. Verify your destination URLs are correct and have not been compromised.",
                affected_items=[
                    f"{r['domain']} ({r['malicious']} malicious, {r.get('suspicious', 0)} suspicious detections)"
                    for r in flagged
                ],
                metadata={"results": results},
            )
        if suspicious:
            return self._result(
                CheckStatus.warning,
                f"{len(suspicious)} domain(s) have suspicious detections on VirusTotal",
                recommendation="Review these domains — they have suspicious (but not confirmed malicious) signals.",
                affected_items=[f"{r['domain']} ({r['suspicious']} suspicious)" for r in suspicious],
                metadata={"results": results},
            )
        if errors and len(errors) == len(results):
            return self._result(
                CheckStatus.error,
                "VirusTotal API returned errors for all domains",
                metadata={"errors": [r.get("error") for r in errors]},
            )

        clean_count = len(results) - len(errors)
        return self._result(
            CheckStatus.passed,
            f"All {clean_count} domain(s) are clean according to VirusTotal",
            metadata={"results": results},
        )


CheckRegistry.register(VirusTotalDomainSafetyCheck())
