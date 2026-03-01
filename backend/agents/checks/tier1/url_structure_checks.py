"""
Tier 1 URL Structure Checks — parsing only, no network I/O.
"""
from urllib.parse import urlparse
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity


class HttpsCheck(BaseCheck):
    check_id = "url_uses_https"
    check_name = "Destination URLs Use HTTPS"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        http_urls = [u.raw_url for u in ctx.urls if u.raw_url.startswith("http://")]
        if not http_urls:
            return self._result(CheckStatus.passed, f"All {len(ctx.urls)} URL(s) use HTTPS")
        return self._result(
            CheckStatus.failed,
            f"{len(http_urls)} URL(s) use HTTP — ad platforms reject HTTP destination URLs",
            recommendation="Update all destination URLs to use HTTPS",
            affected_items=http_urls,
        )


class UrlParseableCheck(BaseCheck):
    check_id = "url_parseable"
    check_name = "Destination URLs Are Valid"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        invalid = []
        for u in ctx.urls:
            try:
                parsed = urlparse(u.raw_url)
                if not parsed.scheme or not parsed.netloc:
                    invalid.append(u.raw_url)
            except Exception:
                invalid.append(u.raw_url)
        if not invalid:
            return self._result(CheckStatus.passed, f"All {len(ctx.urls)} URL(s) have valid structure")
        return self._result(
            CheckStatus.failed,
            f"{len(invalid)} URL(s) have invalid format",
            recommendation="Ensure all URLs include https:// and a valid domain",
            affected_items=invalid,
        )


class UrlHasFragmentCheck(BaseCheck):
    check_id = "url_no_fragment"
    check_name = "URLs Do Not Use Hash Fragments for Tracking"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        fragment_urls = []
        for u in ctx.urls:
            parsed = urlparse(u.raw_url)
            if parsed.fragment:
                fragment_urls.append(u.raw_url)
        if not fragment_urls:
            return self._result(CheckStatus.passed, "No hash fragments used — URL tracking parameters will work correctly")
        return self._result(
            CheckStatus.warning,
            f"{len(fragment_urls)} URL(s) contain # fragments — UTM params after # are not sent to servers",
            recommendation="Move UTM parameters before # fragments, or remove fragments if not needed for the landing page",
            affected_items=fragment_urls,
        )


class UrlUniformDomainCheck(BaseCheck):
    check_id = "url_uniform_domain"
    check_name = "All URLs Point to Same Domain"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        if len(ctx.urls) < 2:
            return self._result(CheckStatus.skipped, "Only one URL provided — domain consistency check skipped")
        domains = set()
        for u in ctx.urls:
            try:
                parsed = urlparse(u.raw_url)
                domains.add(parsed.netloc.lower().lstrip("www."))
            except Exception:
                pass
        if len(domains) <= 1:
            return self._result(CheckStatus.passed, f"All URLs point to the same domain: {list(domains)[0] if domains else 'unknown'}")
        return self._result(
            CheckStatus.warning,
            f"URLs point to {len(domains)} different domains: {', '.join(sorted(domains))}",
            recommendation="Verify that multiple domains are intentional (e.g. split testing) and not a copy-paste error",
            metadata={"domains": sorted(domains)},
        )


class UrlExcessiveLengthCheck(BaseCheck):
    check_id = "url_length"
    check_name = "URL Length Within Platform Limits"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1
    MAX_LENGTH = 2000  # Most browsers/platforms cap around 2000-2048

    def execute(self, ctx: RunContext) -> CheckResult:
        long_urls = [u.raw_url for u in ctx.urls if len(u.raw_url) > self.MAX_LENGTH]
        if not long_urls:
            return self._result(CheckStatus.passed, f"All URL(s) are within the {self.MAX_LENGTH} character limit")
        return self._result(
            CheckStatus.failed,
            f"{len(long_urls)} URL(s) exceed {self.MAX_LENGTH} characters — may be truncated by browsers",
            recommendation="Use a URL shortener or reduce the number of query parameters",
            affected_items=[u[:100] + "..." for u in long_urls],
        )


class UrlNoTrailingSpacesCheck(BaseCheck):
    check_id = "url_no_whitespace"
    check_name = "URLs Free of Whitespace"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        bad = [u.raw_url for u in ctx.urls if u.raw_url != u.raw_url.strip() or " " in u.raw_url]
        if not bad:
            return self._result(CheckStatus.passed, "No whitespace found in any URL")
        return self._result(
            CheckStatus.failed,
            f"{len(bad)} URL(s) contain whitespace — will cause broken links",
            recommendation="Remove spaces from URLs. Use %20 for encoded spaces or remove them entirely.",
            affected_items=bad,
        )


class UrlDuplicateCheck(BaseCheck):
    """Catches duplicate destination URLs within the same run.
    Identical URLs inflate check counts and often indicate a copy-paste error.
    """
    check_id = "url_no_duplicates"
    check_name = "No Duplicate Destination URLs"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        seen: dict[str, int] = {}
        for u in ctx.urls:
            normalized = u.raw_url.strip().rstrip("/").lower()
            seen[normalized] = seen.get(normalized, 0) + 1

        dupes = {url: count for url, count in seen.items() if count > 1}
        if not dupes:
            return self._result(CheckStatus.passed, f"All {len(ctx.urls)} URL(s) are unique")
        return self._result(
            CheckStatus.failed,
            f"{len(dupes)} duplicate URL(s) found — removes variation from A/B tests and wastes budget",
            recommendation="Ensure each URL in the run is unique. Each ad variant should have a distinct destination URL.",
            affected_items=[f"{url} (×{count})" for url, count in dupes.items()],
        )


class UtmQueryStringOrderCheck(BaseCheck):
    """Warns when UTM parameters are buried after other query parameters.
    Some ad servers truncate long query strings — UTM params should come first.
    """
    check_id = "utm_query_string_order"
    check_name = "UTM Parameters Early in Query String"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        from urllib.parse import urlparse, parse_qsl
        bad: list[str] = []
        for u in ctx.urls:
            try:
                parsed = urlparse(u.raw_url)
                pairs = parse_qsl(parsed.query, keep_blank_values=True)
                keys = [k for k, _ in pairs]
                utm_indices = [i for i, k in enumerate(keys) if k.startswith("utm_")]
                non_utm_before = any(i < min(utm_indices) for i in range(len(keys)) if not keys[i].startswith("utm_"))
                if utm_indices and non_utm_before:
                    bad.append(u.raw_url)
            except Exception:
                pass
        if not bad:
            return self._result(CheckStatus.passed, "UTM parameters appear early in the query string")
        return self._result(
            CheckStatus.warning,
            f"UTM parameters are not first in the query string on {len(bad)} URL(s)",
            recommendation="Place UTM parameters before other query parameters (e.g. ?utm_source=…&other_param=…) to prevent truncation",
            affected_items=bad,
        )


# Register all
for cls in [
    HttpsCheck,
    UrlParseableCheck,
    UrlHasFragmentCheck,
    UrlUniformDomainCheck,
    UrlExcessiveLengthCheck,
    UrlNoTrailingSpacesCheck,
    UrlDuplicateCheck,
    UtmQueryStringOrderCheck,
]:
    CheckRegistry.register(cls())
