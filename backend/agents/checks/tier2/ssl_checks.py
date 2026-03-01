"""
Tier 2 SSL Checks — validates TLS certificate validity and expiry.
Runs async in background (tier 2).
"""
import ssl
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

WARN_DAYS = 30   # warn if cert expires within 30 days
FAIL_DAYS = 7    # fail if cert expires within 7 days


def _get_cert_info(hostname: str, port: int = 443, timeout: int = 8) -> dict:
    """Retrieve SSL cert expiry info for a hostname."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=timeout) as raw_sock:
            with ctx.wrap_socket(raw_sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                if not cert:
                    return {"hostname": hostname, "valid": False, "days_left": None, "expiry": None, "error": "Empty cert"}
                not_after = str(cert.get("notAfter", ""))
                expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                days_left = (expiry - datetime.now(timezone.utc)).days
                return {
                    "hostname": hostname,
                    "valid": True,
                    "days_left": days_left,
                    "expiry": expiry.strftime("%Y-%m-%d"),
                    "error": None,
                }
    except ssl.SSLCertVerificationError as exc:
        return {"hostname": hostname, "valid": False, "days_left": None, "expiry": None, "error": f"Invalid cert: {exc}"}
    except ssl.SSLError as exc:
        return {"hostname": hostname, "valid": False, "days_left": None, "expiry": None, "error": f"SSL error: {exc}"}
    except OSError as exc:
        # Port 443 not open, or connection refused — skip gracefully
        return {"hostname": hostname, "valid": None, "days_left": None, "expiry": None, "error": f"Connection error: {exc}"}
    except Exception as exc:
        return {"hostname": hostname, "valid": None, "days_left": None, "expiry": None, "error": str(exc)}


class SslCertValidityCheck(BaseCheck):
    """Checks that all destination URL domains have a valid, non-expired SSL certificate."""
    check_id = "ssl_cert_valid"
    check_name = "SSL Certificate Validity"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        # Deduplicate HTTPS hostnames only
        hostnames: dict[str, str] = {}
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.scheme == "https" and parsed.netloc:
                host = parsed.netloc.split(":")[0].lower()
                hostnames[host] = parsed.netloc

        if not hostnames:
            return self._result(CheckStatus.skipped, "No HTTPS URLs to check for SSL validity")

        results = [_get_cert_info(h) for h in hostnames]

        invalid = [r for r in results if r["valid"] is False]
        if invalid:
            return self._result(
                CheckStatus.failed,
                f"{len(invalid)} domain(s) have invalid SSL certificates — ads may be disapproved or landing pages blocked",
                recommendation="Renew or fix the SSL certificate on the affected domains immediately",
                affected_items=[f"{r['hostname']}: {r['error']}" for r in invalid],
            )

        reachable = [r for r in results if r["valid"] is True]
        if not reachable:
            return self._result(CheckStatus.skipped, "Could not connect to any domain on port 443 — SSL check skipped")

        return self._result(
            CheckStatus.passed,
            f"SSL certificates valid on all {len(reachable)} checked domain(s)",
            metadata={"domains": [{"host": r["hostname"], "expires": r["expiry"], "days_left": r["days_left"]} for r in reachable]},
        )


class SslCertExpiryCheck(BaseCheck):
    """Warns if any SSL certificate is expiring within 30 days."""
    check_id = "ssl_cert_expiry"
    check_name = "SSL Certificate Expiry"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 2

    def execute(self, ctx: RunContext) -> CheckResult:
        hostnames: dict[str, str] = {}
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.scheme == "https" and parsed.netloc:
                host = parsed.netloc.split(":")[0].lower()
                hostnames[host] = parsed.netloc

        if not hostnames:
            return self._result(CheckStatus.skipped, "No HTTPS URLs to check for SSL expiry")

        results = [r for r in [_get_cert_info(h) for h in hostnames] if r["valid"] is True]

        if not results:
            return self._result(CheckStatus.skipped, "Could not retrieve cert info for expiry check")

        critical_expiry = [r for r in results if r["days_left"] is not None and r["days_left"] <= FAIL_DAYS]
        warn_expiry = [r for r in results if r["days_left"] is not None and FAIL_DAYS < r["days_left"] <= WARN_DAYS]

        if critical_expiry:
            return self._result(
                CheckStatus.failed,
                f"{len(critical_expiry)} SSL certificate(s) expire in {FAIL_DAYS} days or less — ads will break",
                recommendation="Renew the SSL certificate immediately to avoid campaign disruption",
                affected_items=[f"{r['hostname']}: expires {r['expiry']} ({r['days_left']} days)" for r in critical_expiry],
            )
        if warn_expiry:
            return self._result(
                CheckStatus.warning,
                f"{len(warn_expiry)} SSL certificate(s) expire within {WARN_DAYS} days",
                recommendation="Schedule SSL certificate renewal to avoid landing page errors during the campaign",
                affected_items=[f"{r['hostname']}: expires {r['expiry']} ({r['days_left']} days)" for r in warn_expiry],
            )
        return self._result(
            CheckStatus.passed,
            f"All SSL certificates valid for more than {WARN_DAYS} days",
            metadata={"domains": [{"host": r["hostname"], "expires": r["expiry"], "days_left": r["days_left"]} for r in results]},
        )


for cls in [SslCertValidityCheck, SslCertExpiryCheck]:
    CheckRegistry.register(cls())
