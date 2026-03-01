"""
Tier 1 Naming Convention Checks — pure string validation, no I/O.
Validates campaign names and ad names follow consistent conventions.
"""
import re
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

# At least one separator (underscore or hyphen), no raw spaces, reasonable length
_SPACES_RE = re.compile(r"\s")
_VALID_CHARS_RE = re.compile(r"^[A-Za-z0-9_\-|.]+$")
# Looks for a date-like token: YYYYMMDD, MMYYYY, YYYY-MM, Q1_2025, 2025, etc.
_DATE_LIKE_RE = re.compile(r"(20\d{2}|Q[1-4]_?20\d{2}|\d{2}[A-Za-z]{3}\d{4})", re.IGNORECASE)


def _check_name(name: str) -> list[str]:
    """Return list of violation messages for a single name string."""
    issues = []
    if _SPACES_RE.search(name):
        issues.append("contains spaces (use underscores or hyphens)")
    if not _VALID_CHARS_RE.match(name):
        bad = set(re.findall(r"[^A-Za-z0-9_\-|.\s]", name))
        issues.append(f"contains special characters: {', '.join(sorted(bad))}")
    if "_" not in name and "-" not in name:
        issues.append("has no separators — use underscores or hyphens between segments")
    if len(name) < 5:
        issues.append("is too short to be descriptive")
    if len(name) > 200:
        issues.append("exceeds 200 characters")
    return issues


class CampaignNamingConventionCheck(BaseCheck):
    check_id = "campaign_naming_convention"
    check_name = "Campaign Naming Convention"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        if not ctx.campaign_name:
            return self._result(
                CheckStatus.skipped,
                "No campaign name provided — skipping naming convention check",
            )

        issues = _check_name(ctx.campaign_name)
        has_date = bool(_DATE_LIKE_RE.search(ctx.campaign_name))

        if not issues and not has_date:
            return self._result(
                CheckStatus.warning,
                f"Campaign name '{ctx.campaign_name}' has valid format but no date/quarter identifier",
                recommendation="Include a date or quarter in your campaign name (e.g. Q2_2025 or 20250601) to make historical reporting easier",
            )
        if issues:
            return self._result(
                CheckStatus.failed,
                f"Campaign name '{ctx.campaign_name}' violates naming conventions",
                recommendation="Use a structured naming convention with no spaces, e.g. meta_conversion_lookalike_spring_Q2_2025",
                affected_items=[f"Campaign name: {v}" for v in issues],
            )
        return self._result(
            CheckStatus.passed,
            f"Campaign name '{ctx.campaign_name}' follows naming conventions",
        )


class AdNamingConventionCheck(BaseCheck):
    check_id = "ad_naming_convention"
    check_name = "Ad & Ad Set Naming Convention"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        violations = []
        for u in ctx.urls:
            for field_label, value in [("ad_name", u.ad_name), ("ad_set_name", u.ad_set_name)]:
                if not value:
                    continue
                issues = _check_name(value)
                if issues:
                    for issue in issues:
                        violations.append(f"{field_label} '{value}' {issue}")

        if not violations:
            # Check if any names were provided at all
            has_any = any(u.ad_name or u.ad_set_name for u in ctx.urls)
            if not has_any:
                return self._result(CheckStatus.skipped, "No ad names provided — skipping ad naming check")
            return self._result(CheckStatus.passed, "All ad and ad set names follow naming conventions")

        return self._result(
            CheckStatus.failed,
            f"{len(violations)} naming issue(s) found in ad or ad set names",
            recommendation="Use structured names with underscores/hyphens, no spaces, and include creative or audience identifiers",
            affected_items=violations,
        )


for cls in [CampaignNamingConventionCheck, AdNamingConventionCheck]:
    CheckRegistry.register(cls())
