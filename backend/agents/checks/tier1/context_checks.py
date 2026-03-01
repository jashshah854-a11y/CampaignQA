"""
Tier 1 Context Checks — industry vertical and campaign objective alignment.
Pure logic, no I/O. Surfaces targeted recommendations based on campaign intent.
"""
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity


class IndustryVerticalContextCheck(BaseCheck):
    """
    Provides industry-specific guidance based on the declared industry_vertical.
    Ecommerce, SaaS, lead-gen, and app-install each have distinct QA requirements
    that universal checks don't cover.
    """
    check_id = "industry_vertical_context"
    check_name = "Industry-Specific Pre-Launch Checklist"
    check_category = "url"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    _INDUSTRY_GUIDANCE: dict[str, dict] = {
        "ecommerce": {
            "signals": ["shop", "product", "cart", "checkout", "buy", "store"],
            "missing_signal_msg": "Ecommerce campaigns should link to product or category pages, not the homepage",
            "recommendation": (
                "For ecommerce: (1) Link to specific product/category pages, not homepage. "
                "(2) Add utm_content=<creative_variant> to enable A/B testing. "
                "(3) Verify cart abandonment pixel is on the checkout page. "
                "(4) Check that dynamic product ads have inventory feed connected."
            ),
        },
        "saas": {
            "signals": ["trial", "demo", "signup", "register", "start", "free"],
            "missing_signal_msg": "SaaS campaigns should land on a trial/demo/signup page, not the homepage",
            "recommendation": (
                "For SaaS: (1) Landing page should have a clear free trial or demo CTA. "
                "(2) Add the tracking pixel to the signup confirmation page, not just the landing page. "
                "(3) Set utm_content to the experiment variant for conversion rate testing. "
                "(4) Verify that the landing page loads in < 2s — SaaS buyers are impatient."
            ),
        },
        "lead_gen": {
            "signals": ["contact", "form", "quote", "consult", "schedule", "book", "apply"],
            "missing_signal_msg": "Lead gen campaigns should link to a form or booking page, not a generic page",
            "recommendation": (
                "For lead gen: (1) Destination URL should contain a visible contact form above the fold. "
                "(2) Add a call tracking number and verify it appears on the page. "
                "(3) Ensure thank-you page after form submit has the conversion pixel. "
                "(4) Add utm_term={{keyword}} for search campaigns to track which keywords generate leads."
            ),
        },
        "app_install": {
            "signals": ["app", "download", "install", "play", "apple", "google"],
            "missing_signal_msg": "App install campaigns should link to App Store / Play Store or a smart redirect",
            "recommendation": (
                "For app install campaigns: (1) Use platform deep links or a smart redirect service "
                "(Branch, AppsFlyer). (2) Ensure the destination URL is a valid App Store or Play Store URL. "
                "(3) Add a mobile measurement partner (MMP) SDK to track installs accurately. "
                "(4) Verify the app store listing has recent screenshots and a high average rating."
            ),
        },
    }

    def execute(self, ctx: RunContext) -> CheckResult:
        vertical = (ctx.industry_vertical or "").lower().strip()
        if not vertical or vertical not in self._INDUSTRY_GUIDANCE:
            return self._result(
                CheckStatus.skipped,
                "No industry vertical specified — contextual checks skipped",
                recommendation="Set industry_vertical to one of: ecommerce, saas, lead_gen, app_install for targeted QA tips",
            )

        guide = self._INDUSTRY_GUIDANCE[vertical]
        signals = guide["signals"]

        # Check if any URL path contains expected signals for this industry
        missing_signal_urls = []
        for u in ctx.urls:
            path_and_host = (u.host + u.path).lower()
            if not any(s in path_and_host for s in signals):
                missing_signal_urls.append(u.raw_url)

        if missing_signal_urls and len(missing_signal_urls) == len(ctx.urls):
            # All URLs seem to miss the expected signal — warn
            return self._result(
                CheckStatus.warning,
                f"{guide['missing_signal_msg']}",
                recommendation=guide["recommendation"],
                affected_items=missing_signal_urls[:5],
            )

        return self._result(
            CheckStatus.passed,
            f"URLs look appropriate for {vertical} campaigns",
            recommendation=guide["recommendation"],
            metadata={"industry_vertical": vertical},
        )


class CampaignObjectiveAlignmentCheck(BaseCheck):
    """
    Validates that the campaign objective is consistent with:
    1. The UTM medium used (conversion campaigns shouldn't use display medium)
    2. The ad copy (awareness campaigns shouldn't use hard CTAs like 'Buy Now')
    """
    check_id = "campaign_objective_alignment"
    check_name = "Campaign Objective vs. Creative Alignment"
    check_category = "creative"
    platforms = ["universal"]
    severity = Severity.minor
    tier = 1

    _CONVERSION_CTAS = {"buy now", "shop now", "order now", "get quote", "apply now", "book now", "sign up", "start free"}
    _AWARENESS_MEDIUMS = {"display", "video", "social", "paid_social"}
    _CONVERSION_OBJECTIVES = {"conversion", "conversions", "purchase", "lead", "lead_gen"}
    _AWARENESS_OBJECTIVES = {"awareness", "reach", "views", "brand_awareness"}

    def execute(self, ctx: RunContext) -> CheckResult:
        objective = (ctx.campaign_objective or "").lower().strip()
        if not objective:
            return self._result(CheckStatus.skipped, "No campaign objective specified — alignment check skipped")

        issues: list[str] = []

        # Check 1: awareness objective + conversion-heavy UTM medium
        if objective in self._AWARENESS_OBJECTIVES:
            for u in ctx.urls:
                medium = u.params.get("utm_medium", "").lower()
                if medium == "cpc":
                    issues.append(
                        f"utm_medium=cpc on an awareness campaign may signal misclassified intent — "
                        f"consider utm_medium=display or video for brand awareness"
                    )
                    break  # report once

        # Check 2: conversion objective + no strong CTA in ad copy
        if objective in self._CONVERSION_OBJECTIVES:
            copy = " ".join(filter(None, [ctx.headline, ctx.primary_text, ctx.description])).lower()
            if copy.strip() and not any(cta in copy for cta in self._CONVERSION_CTAS):
                issues.append(
                    "Conversion objective but no strong conversion CTA detected in ad copy "
                    "(e.g. 'Shop Now', 'Sign Up', 'Get Quote')"
                )

        if not issues:
            return self._result(
                CheckStatus.passed,
                f"Campaign objective '{objective}' is consistent with creative and UTM settings",
                metadata={"objective": objective},
            )
        return self._result(
            CheckStatus.warning,
            f"Campaign objective alignment issue: {issues[0]}",
            recommendation="Ensure your UTM medium, ad copy CTAs, and campaign objective tell a consistent story",
            affected_items=issues,
            metadata={"objective": objective},
        )


for cls in [IndustryVerticalContextCheck, CampaignObjectiveAlignmentCheck]:
    CheckRegistry.register(cls())
