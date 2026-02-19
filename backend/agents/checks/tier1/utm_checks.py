"""
Tier 1 UTM Checks — pure string parsing, no I/O.
Runs synchronously at request time.
"""
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

REQUIRED_UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign"]
OPTIONAL_UTM_PARAMS = ["utm_term", "utm_content"]

VALID_UTM_SOURCES = {
    "meta": ["facebook", "fb", "instagram", "meta"],
    "google": ["google", "cpc", "ppc"],
    "tiktok": ["tiktok", "tiktok_ads"],
    "linkedin": ["linkedin"],
    "universal": [],
}

VALID_UTM_MEDIUMS = ["cpc", "paid", "paid_social", "paid_search", "display", "video", "email"]


class UtmSourcePresentCheck(BaseCheck):
    check_id = "utm_source_present"
    check_name = "UTM Source Parameter Present"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        missing = [u.raw_url for u in ctx.urls if "utm_source" not in u.params]
        if not missing:
            return self._result(
                CheckStatus.passed,
                f"utm_source present in all {len(ctx.urls)} URL(s)",
            )
        return self._result(
            CheckStatus.failed,
            f"utm_source missing from {len(missing)} of {len(ctx.urls)} URL(s)",
            recommendation="Add ?utm_source=<platform> to all destination URLs before launching",
            affected_items=missing,
        )


class UtmMediumPresentCheck(BaseCheck):
    check_id = "utm_medium_present"
    check_name = "UTM Medium Parameter Present"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        missing = [u.raw_url for u in ctx.urls if "utm_medium" not in u.params]
        if not missing:
            return self._result(CheckStatus.passed, f"utm_medium present in all {len(ctx.urls)} URL(s)")
        return self._result(
            CheckStatus.failed,
            f"utm_medium missing from {len(missing)} of {len(ctx.urls)} URL(s)",
            recommendation="Add utm_medium=cpc (or paid_social / display) to all destination URLs",
            affected_items=missing,
        )


class UtmCampaignPresentCheck(BaseCheck):
    check_id = "utm_campaign_present"
    check_name = "UTM Campaign Parameter Present"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        missing = [u.raw_url for u in ctx.urls if "utm_campaign" not in u.params]
        if not missing:
            return self._result(CheckStatus.passed, f"utm_campaign present in all {len(ctx.urls)} URL(s)")
        return self._result(
            CheckStatus.failed,
            f"utm_campaign missing from {len(missing)} of {len(ctx.urls)} URL(s)",
            recommendation="Add utm_campaign=<campaign_name> to all destination URLs",
            affected_items=missing,
        )


class UtmNoSpacesCheck(BaseCheck):
    check_id = "utm_no_spaces"
    check_name = "UTM Parameters Free of Spaces"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        bad = []
        for u in ctx.urls:
            for key, val in u.params.items():
                if key.startswith("utm_") and " " in val:
                    bad.append(f"{u.raw_url} ({key}='{val}')")
        if not bad:
            return self._result(CheckStatus.passed, "No spaces found in UTM parameter values")
        return self._result(
            CheckStatus.failed,
            f"Spaces found in UTM values on {len(bad)} URL(s) — will break analytics reporting",
            recommendation="Replace spaces with underscores or hyphens in UTM values (e.g., my_campaign not my campaign)",
            affected_items=bad,
        )


class UtmCaseConsistencyCheck(BaseCheck):
    check_id = "utm_case_consistency"
    check_name = "UTM Parameter Case Consistency"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        case_violations = []
        for u in ctx.urls:
            for key, val in u.params.items():
                if key.startswith("utm_") and val != val.lower():
                    case_violations.append(f"{u.raw_url} ({key}='{val}')")
        if not case_violations:
            return self._result(CheckStatus.passed, "All UTM values are lowercase — consistent")
        return self._result(
            CheckStatus.warning,
            f"Mixed-case UTM values found on {len(case_violations)} URL(s) — may cause duplicate entries in GA4",
            recommendation="Standardize all UTM values to lowercase to prevent duplicate campaign rows in GA4",
            affected_items=case_violations,
        )


class UtmSourceMatchesPlatformCheck(BaseCheck):
    check_id = "utm_source_matches_platform"
    check_name = "UTM Source Matches Selected Platform"
    check_category = "utm"
    platforms = ["meta", "google", "tiktok", "linkedin"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        expected = VALID_UTM_SOURCES.get(ctx.platform.value, [])
        if not expected:
            return self._result(CheckStatus.skipped, "Platform-specific UTM source check not applicable")

        mismatched = []
        for u in ctx.urls:
            source = u.params.get("utm_source", "").lower()
            if source and source not in expected:
                mismatched.append(f"{u.raw_url} (found: utm_source='{source}', expected one of: {expected})")
        if not mismatched:
            return self._result(
                CheckStatus.passed,
                f"utm_source values match expected values for {ctx.platform.value}",
            )
        return self._result(
            CheckStatus.warning,
            f"utm_source value may not match platform on {len(mismatched)} URL(s)",
            recommendation=f"For {ctx.platform.value} campaigns, utm_source should be one of: {expected}",
            affected_items=mismatched,
        )


class UtmNoDuplicateParamsCheck(BaseCheck):
    check_id = "utm_no_duplicate_params"
    check_name = "No Duplicate URL Parameters"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        from urllib.parse import urlparse, parse_qs
        bad = []
        for u in ctx.urls:
            try:
                parsed = urlparse(u.raw_url)
                qs = parse_qs(parsed.query, keep_blank_values=True)
                dupes = [k for k, v in qs.items() if len(v) > 1]
                if dupes:
                    bad.append(f"{u.raw_url} (duplicate params: {dupes})")
            except Exception:
                pass
        if not bad:
            return self._result(CheckStatus.passed, "No duplicate URL parameters found")
        return self._result(
            CheckStatus.failed,
            f"Duplicate query parameters found in {len(bad)} URL(s) — GA4 will report unpredictably",
            recommendation="Remove duplicate parameters from destination URLs",
            affected_items=bad,
        )


# Register all checks
for cls in [
    UtmSourcePresentCheck,
    UtmMediumPresentCheck,
    UtmCampaignPresentCheck,
    UtmNoSpacesCheck,
    UtmCaseConsistencyCheck,
    UtmSourceMatchesPlatformCheck,
    UtmNoDuplicateParamsCheck,
]:
    CheckRegistry.register(cls())
