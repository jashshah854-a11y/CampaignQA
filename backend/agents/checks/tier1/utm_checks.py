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


class UtmCrossUrlConsistencyCheck(BaseCheck):
    """Detects utm_campaign (or utm_medium/utm_source) mismatches across URLs in the same run.
    E.g. one URL has utm_campaign=bfcm, another has utm_campaign=BFCM or black_friday_2025.
    This causes split attribution in GA4 — all ads in the same campaign should share the same values.
    """
    check_id = "utm_cross_url_consistency"
    check_name = "UTM Campaign Consistency Across URLs"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    _PARAMS_TO_CHECK = ["utm_campaign", "utm_medium", "utm_source"]

    def execute(self, ctx: RunContext) -> CheckResult:
        if len(ctx.urls) < 2:
            return self._result(CheckStatus.skipped, "Only one URL — cross-URL consistency check skipped")

        violations: list[str] = []
        for param in self._PARAMS_TO_CHECK:
            values = {}
            for u in ctx.urls:
                v = u.params.get(param)
                if v:
                    values.setdefault(v.lower(), []).append(u.raw_url)

            if len(values) > 1:
                summary = ", ".join(f"'{v}' ({len(urls)} URL{'s' if len(urls) > 1 else ''})"
                                    for v, urls in values.items())
                violations.append(f"{param} has {len(values)} different values: {summary}")

        if not violations:
            return self._result(
                CheckStatus.passed,
                "UTM campaign, medium, and source values are consistent across all URLs",
            )
        return self._result(
            CheckStatus.failed,
            f"{len(violations)} UTM parameter(s) are inconsistent across URLs — will split attribution in GA4",
            recommendation="All URLs in the same ad set should share the same utm_campaign, utm_medium, and utm_source values",
            affected_items=violations,
        )


class UtmContentTermBestPracticeCheck(BaseCheck):
    """
    Warns when utm_content and utm_term are missing.
    - utm_content: identifies which ad creative (critical for A/B testing)
    - utm_term: keyword for search campaigns (Google/Bing)
    Severity is minor — informational nudge, not a hard fail.
    """
    check_id = "utm_content_term_best_practice"
    check_name = "UTM Content & Term Parameters (Best Practice)"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        missing_content = [u.raw_url for u in ctx.urls if "utm_content" not in u.params]
        missing_term = (
            [u.raw_url for u in ctx.urls if "utm_term" not in u.params]
            if ctx.platform.value in ("google",)
            else []
        )

        issues: list[str] = []
        if missing_content:
            issues.append(f"utm_content missing on {len(missing_content)} URL(s) — can't distinguish creatives in GA4")
        if missing_term:
            issues.append(f"utm_term missing on {len(missing_term)} URL(s) — keyword data lost for search campaigns")

        if not issues:
            return self._result(
                CheckStatus.passed,
                "utm_content and utm_term are present — full attribution tracking enabled",
            )
        return self._result(
            CheckStatus.warning,
            "; ".join(issues),
            recommendation="Add utm_content=<creative_variant> to all URLs to enable A/B reporting. Add utm_term={{keyword}} for search campaigns.",
            affected_items=list(dict.fromkeys(missing_content + missing_term)),
        )


class PlatformUtmMediumAlignmentCheck(BaseCheck):
    """
    Checks that utm_medium matches the platform type.
    Meta/TikTok/LinkedIn → paid_social (not cpc)
    Google → cpc or paid_search (not paid_social)
    Mismatches cause channel-split errors in GA4's default channel grouping.
    """
    check_id = "utm_medium_platform_alignment"
    check_name = "UTM Medium Matches Platform Type"
    check_category = "utm"
    platforms = ["meta", "google", "tiktok", "linkedin"]
    severity = Severity.major
    tier = 1

    _SOCIAL_MEDIUMS = {"paid_social", "social", "paid-social"}
    _SEARCH_MEDIUMS = {"cpc", "paid_search", "ppc", "paid-search"}
    _SOCIAL_PLATFORMS = {"meta", "tiktok", "linkedin"}
    _SEARCH_PLATFORMS = {"google"}

    def execute(self, ctx: RunContext) -> CheckResult:
        platform = ctx.platform.value
        mismatched: list[str] = []

        for u in ctx.urls:
            medium = u.params.get("utm_medium", "").lower()
            if not medium:
                continue

            if platform in self._SOCIAL_PLATFORMS and medium in self._SEARCH_MEDIUMS:
                mismatched.append(
                    f"{u.raw_url} (utm_medium='{medium}' on {platform} — use 'paid_social')"
                )
            elif platform in self._SEARCH_PLATFORMS and medium in self._SOCIAL_MEDIUMS:
                mismatched.append(
                    f"{u.raw_url} (utm_medium='{medium}' on {platform} — use 'cpc')"
                )

        if not mismatched:
            return self._result(
                CheckStatus.passed,
                f"utm_medium values match expected type for {platform} campaigns",
            )
        return self._result(
            CheckStatus.failed,
            f"utm_medium mismatch on {len(mismatched)} URL(s) — GA4 will mis-classify channel",
            recommendation=(
                "Use utm_medium=paid_social for Meta/TikTok/LinkedIn ads. "
                "Use utm_medium=cpc for Google search. "
                "Mismatches break GA4's default channel grouping report."
            ),
            affected_items=mismatched,
        )


class UtmIdGa4Check(BaseCheck):
    """
    Checks for utm_id parameter on Google platform campaigns using manual UTM tagging.

    Google Analytics 4 uses utm_id to link manual UTM sessions to Google Ads campaigns
    when auto-tagging (gclid) is disabled. Without utm_id, Google Ads cost data and
    GA4 campaign data cannot be linked in the GA4 reporting UI.

    Only flagged when: platform=google AND utm_source=google AND no gclid (auto-tag off).
    """
    check_id = "utm_id_ga4"
    check_name = "utm_id Parameter for GA4 (Google)"
    check_category = "utm"
    platforms = ["google"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        if ctx.platform.value != "google":
            return self._result(CheckStatus.skipped, "utm_id check only applies to Google platform")

        missing_utm_id: list[str] = []
        has_auto_tag: list[str] = []

        for u in ctx.urls:
            params = u.params
            if "gclid" in params:
                has_auto_tag.append(u.raw_url)
                continue  # auto-tagging is active — utm_id not needed
            if "utm_source" in params and "utm_id" not in params:
                missing_utm_id.append(u.raw_url)

        if has_auto_tag and not missing_utm_id:
            return self._result(
                CheckStatus.passed,
                f"Auto-tagging (gclid) detected on {len(has_auto_tag)} URL(s) — utm_id not required",
            )

        if missing_utm_id:
            return self._result(
                CheckStatus.warning,
                f"{len(missing_utm_id)} Google URL(s) using manual UTMs without utm_id — Google Ads ↔ GA4 data linking will fail",
                recommendation=(
                    "Add utm_id={{campaignid}} to your Google Ads URL template, or enable auto-tagging "
                    "in Google Ads settings. Without utm_id, cost data from Google Ads cannot be linked "
                    "to sessions in GA4 reporting."
                ),
                affected_items=missing_utm_id,
            )

        return self._result(CheckStatus.passed, "All Google URLs have utm_id or use auto-tagging")


class ClickIdConflictCheck(BaseCheck):
    """
    Detects click ID parameters (gclid, fbclid, ttclid, li_fat_id) alongside manual UTMs.

    Click IDs indicate platform auto-tagging is active. Using both auto-tagging AND manual
    UTMs on the same URL is fine, but having gclid on a Meta/TikTok URL (or fbclid on
    Google) signals that a URL was incorrectly copied from another platform's ad.
    """
    check_id = "click_id_conflict"
    check_name = "Click ID Platform Conflict"
    check_category = "utm"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    _PLATFORM_CLICK_IDS: dict[str, str] = {
        "gclid": "google",
        "fbclid": "meta",
        "ttclid": "tiktok",
        "li_fat_id": "linkedin",
        "msclkid": "microsoft",
    }

    def execute(self, ctx: RunContext) -> CheckResult:
        platform = ctx.platform.value
        conflicts: list[str] = []

        for u in ctx.urls:
            params = u.params
            for click_id, click_platform in self._PLATFORM_CLICK_IDS.items():
                if click_id in params and platform not in (click_platform, "multi", "universal"):
                    conflicts.append(
                        f"{u.raw_url} — contains {click_id} ({click_platform} click ID) in a {platform} campaign"
                    )

        if not conflicts:
            return self._result(
                CheckStatus.passed,
                "No cross-platform click ID conflicts detected",
            )

        return self._result(
            CheckStatus.failed,
            f"{len(conflicts)} URL(s) contain a click ID from a different platform — likely a copy-paste error",
            recommendation=(
                "Remove or replace the mismatched click ID. Having another platform's click ID (e.g. fbclid "
                "in a Google campaign) means this URL was copied from a different platform's ad and not updated."
            ),
            affected_items=conflicts,
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
    UtmCrossUrlConsistencyCheck,
    UtmContentTermBestPracticeCheck,
    PlatformUtmMediumAlignmentCheck,
    UtmIdGa4Check,
    ClickIdConflictCheck,
]:
    CheckRegistry.register(cls())
