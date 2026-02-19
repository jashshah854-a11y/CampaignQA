"""
Tier 1 Budget Checks — validates campaign budget fields.
"""
from agents.checks.base import BaseCheck, CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity

PLATFORM_MINIMUMS = {
    "meta": 1.00,
    "google": 1.00,
    "tiktok": 20.00,  # TikTok minimum daily budget
    "linkedin": 10.00,  # LinkedIn minimum daily budget
}


class BudgetMinimumCheck(BaseCheck):
    check_id = "budget_above_platform_minimum"
    check_name = "Daily Budget Above Platform Minimum"
    check_category = "budget"
    platforms = ["meta", "google", "tiktok", "linkedin"]
    severity = Severity.critical
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        budget_str = ctx.extra.get("daily_budget")
        if budget_str is None:
            return self._result(
                CheckStatus.warning,
                "Daily budget not provided — cannot validate minimum",
                recommendation="Provide daily_budget to enable this check",
            )
        try:
            budget = float(str(budget_str).replace("$", "").replace(",", ""))
        except (ValueError, TypeError):
            return self._result(
                CheckStatus.failed,
                f"Daily budget value '{budget_str}' is not a valid number",
                recommendation="Enter a numeric daily budget value",
            )
        minimum = PLATFORM_MINIMUMS.get(ctx.platform.value, 1.00)
        if budget >= minimum:
            return self._result(
                CheckStatus.passed,
                f"Daily budget ${budget:.2f} meets {ctx.platform.value} minimum of ${minimum:.2f}",
            )
        return self._result(
            CheckStatus.failed,
            f"Daily budget ${budget:.2f} is below {ctx.platform.value} minimum of ${minimum:.2f}",
            recommendation=f"Increase daily budget to at least ${minimum:.2f} for {ctx.platform.value} campaigns",
            metadata={"budget": budget, "minimum": minimum},
        )


class BudgetIsNumericCheck(BaseCheck):
    check_id = "budget_is_numeric"
    check_name = "Budget Fields Are Numeric"
    check_category = "budget"
    platforms = ["universal"]
    severity = Severity.major
    tier = 1

    def execute(self, ctx: RunContext) -> CheckResult:
        budget = ctx.extra.get("daily_budget") or ctx.extra.get("lifetime_budget")
        if budget is None:
            return self._result(CheckStatus.skipped, "No budget fields provided")
        try:
            float(str(budget).replace("$", "").replace(",", ""))
            return self._result(CheckStatus.passed, f"Budget value '{budget}' is a valid number")
        except (ValueError, TypeError):
            return self._result(
                CheckStatus.failed,
                f"Budget value '{budget}' is not numeric",
                recommendation="Enter a plain numeric value for budget (e.g. 50 or 50.00)",
            )


# Register all
for cls in [BudgetMinimumCheck, BudgetIsNumericCheck]:
    CheckRegistry.register(cls())
