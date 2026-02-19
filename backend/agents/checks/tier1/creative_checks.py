"""
Tier 1 Creative Checks — ad copy character limits and format validation.
Runs synchronously at request time.
"""
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

# Character limits by platform
LIMITS = {
    "meta": {
        "headline": 40,
        "primary_text": 125,
        "description": 30,
    },
    "google": {
        "headline": 30,
        "description": 90,
    },
    "tiktok": {
        "primary_text": 100,
        "description": 100,
    },
    "linkedin": {
        "headline": 70,
        "primary_text": 150,
        "description": 70,
    },
}

# Recommended (soft) limits
RECOMMENDED = {
    "meta": {
        "primary_text": 80,  # truncated at 125, but <80 shows without "see more"
    },
}


class HeadlineCharLimitCheck(BaseCheck):
    check_id = "headline_char_limit"
    check_name = "Headline Character Limit"
    check_category = "creative"
    platforms = ["meta", "google", "linkedin"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        limit = LIMITS.get(ctx.platform.value, {}).get("headline")
        if not limit:
            return self._result(CheckStatus.skipped, "Headline limit not applicable for this platform")
        if not ctx.headline:
            return self._result(
                CheckStatus.warning,
                "Headline not provided — cannot check character limit",
                recommendation="Provide headline text to enable this check",
            )
        length = len(ctx.headline)
        if length <= limit:
            return self._result(
                CheckStatus.passed,
                f"Headline is {length}/{limit} characters — within limit",
            )
        return self._result(
            CheckStatus.failed,
            f"Headline is {length} characters — exceeds {ctx.platform.value} limit of {limit}",
            recommendation=f"Shorten headline to {limit} characters or fewer",
            affected_items=[ctx.headline],
            metadata={"length": length, "limit": limit, "overage": length - limit},
        )


class PrimaryTextCharLimitCheck(BaseCheck):
    check_id = "primary_text_char_limit"
    check_name = "Primary Text / Ad Copy Character Limit"
    check_category = "creative"
    platforms = ["meta", "tiktok", "linkedin"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        limit = LIMITS.get(ctx.platform.value, {}).get("primary_text")
        if not limit:
            return self._result(CheckStatus.skipped, "Primary text limit not applicable for this platform")
        if not ctx.primary_text:
            return self._result(
                CheckStatus.warning,
                "Primary text not provided — cannot check character limit",
                recommendation="Provide ad copy text to enable this check",
            )
        length = len(ctx.primary_text)
        rec_limit = RECOMMENDED.get(ctx.platform.value, {}).get("primary_text")

        if length > limit:
            return self._result(
                CheckStatus.failed,
                f"Primary text is {length} characters — exceeds {ctx.platform.value} hard limit of {limit}",
                recommendation=f"Shorten primary text to {limit} characters — ad will not serve above this limit",
                affected_items=[ctx.primary_text[:80] + "..."],
                metadata={"length": length, "limit": limit, "overage": length - limit},
            )
        if rec_limit and length > rec_limit:
            return self._result(
                CheckStatus.warning,
                f"Primary text is {length} characters — within hard limit ({limit}) but exceeds recommended {rec_limit}. Text will be truncated with 'see more' on mobile.",
                recommendation=f"Consider shortening to {rec_limit} characters for full mobile display",
                metadata={"length": length, "limit": limit, "recommended": rec_limit},
            )
        return self._result(
            CheckStatus.passed,
            f"Primary text is {length}/{limit} characters — within limit",
        )


class DescriptionCharLimitCheck(BaseCheck):
    check_id = "description_char_limit"
    check_name = "Description Character Limit"
    check_category = "creative"
    platforms = ["meta", "google"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        limit = LIMITS.get(ctx.platform.value, {}).get("description")
        if not limit:
            return self._result(CheckStatus.skipped, "Description limit not applicable for this platform")
        if not ctx.description:
            return self._result(
                CheckStatus.warning,
                "Description not provided — cannot check character limit",
                recommendation="Provide description text to enable this check",
            )
        length = len(ctx.description)
        if length <= limit:
            return self._result(CheckStatus.passed, f"Description is {length}/{limit} characters — within limit")
        return self._result(
            CheckStatus.failed,
            f"Description is {length} characters — exceeds {ctx.platform.value} limit of {limit}",
            recommendation=f"Shorten description to {limit} characters or fewer",
            affected_items=[ctx.description],
            metadata={"length": length, "limit": limit, "overage": length - limit},
        )


class CtaPresenceCheck(BaseCheck):
    check_id = "cta_in_copy"
    check_name = "Call-to-Action Present in Ad Copy"
    check_category = "creative"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    CTA_KEYWORDS = [
        "shop now", "learn more", "sign up", "get started", "try free",
        "buy now", "download", "book now", "contact us", "get quote",
        "apply now", "subscribe", "discover", "explore", "click",
    ]

    def execute(self, ctx: RunContext) -> CheckResult:
        text = " ".join(filter(None, [ctx.headline, ctx.primary_text, ctx.description])).lower()
        if not text.strip():
            return self._result(CheckStatus.skipped, "No ad copy provided — CTA check skipped")
        found = [kw for kw in self.CTA_KEYWORDS if kw in text]
        if found:
            return self._result(
                CheckStatus.passed,
                f"CTA found in ad copy: '{found[0]}'",
                metadata={"ctas_found": found},
            )
        return self._result(
            CheckStatus.warning,
            "No clear call-to-action detected in ad copy",
            recommendation="Add a direct CTA (e.g. 'Shop Now', 'Get Started', 'Learn More') to improve CTR",
        )


class EmojiInHeadlineCheck(BaseCheck):
    check_id = "emoji_in_headline"
    check_name = "Emoji Usage in Headline"
    check_category = "creative"
    platforms = ["meta", "tiktok", "linkedin"]
    severity = Severity.minor
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        if not ctx.headline:
            return self._result(CheckStatus.skipped, "No headline provided")
        import emoji
        has_emoji = any(char in emoji.EMOJI_DATA for char in ctx.headline)
        if has_emoji:
            return self._result(
                CheckStatus.warning,
                "Emoji detected in headline — may render inconsistently across devices and placements",
                recommendation="Test emoji rendering on mobile before launch; some placements strip emoji",
            )
        return self._result(CheckStatus.passed, "No emoji in headline — renders consistently across placements")


# Register all checks
for cls in [
    HeadlineCharLimitCheck,
    PrimaryTextCharLimitCheck,
    DescriptionCharLimitCheck,
    CtaPresenceCheck,
]:
    CheckRegistry.register(cls())
