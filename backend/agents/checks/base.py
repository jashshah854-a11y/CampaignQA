"""
Base class and registry for all QA checks.
Every check is a class that inherits from BaseCheck.
Registration is automatic via CheckRegistry.register().
"""
import time
from abc import ABC, abstractmethod
from core.models import CheckResult, CheckStatus, RunContext, Severity


class BaseCheck(ABC):
    # Stable slug — must match check_definitions seed data
    check_id: str = ""
    check_name: str = ""
    check_category: str = ""  # utm | tracking | creative | audience | budget | url
    platforms: list[str] = ["universal"]
    severity: Severity = Severity.major
    tier: int = 1  # 1=sync, 2=async I/O, 3=platform API

    @abstractmethod
    def execute(self, ctx: RunContext) -> CheckResult:
        """Run the check. Must return a CheckResult. Must not raise."""
        ...

    def _result(
        self,
        status: CheckStatus,
        message: str,
        recommendation: str = "",
        affected_items: list[str] = None,
        metadata: dict = None,
        execution_ms: int = 0,
    ) -> CheckResult:
        return CheckResult(
            check_id=self.check_id,
            check_name=self.check_name,
            check_category=self.check_category,
            platform=",".join(self.platforms),
            status=status,
            severity=self.severity,
            message=message,
            recommendation=recommendation or None,
            affected_items=affected_items or [],
            metadata=metadata or {},
            execution_ms=execution_ms,
        )

    def run(self, ctx: RunContext) -> CheckResult:
        """Wrapper that times execution and catches all exceptions."""
        start = time.monotonic()
        try:
            result = self.execute(ctx)
        except Exception as exc:
            result = self._result(
                status=CheckStatus.error,
                message=f"Check error: {exc}",
                execution_ms=int((time.monotonic() - start) * 1000),
            )
        result.execution_ms = int((time.monotonic() - start) * 1000)
        return result


class CheckRegistry:
    _checks: dict[str, BaseCheck] = {}

    @classmethod
    def register(cls, check: BaseCheck) -> None:
        cls._checks[check.check_id] = check

    @classmethod
    def get_checks_for_platform(cls, platform: str, tier: int = None) -> list[BaseCheck]:
        results = []
        for check in cls._checks.values():
            if platform in check.platforms or "universal" in check.platforms:
                if tier is None or check.tier == tier:
                    results.append(check)
        return results

    @classmethod
    def all_definitions(cls) -> list[dict]:
        return [
            {
                "check_id": c.check_id,
                "check_name": c.check_name,
                "category": c.check_category,
                "platforms": c.platforms,
                "severity": c.severity,
                "tier": c.tier,
            }
            for c in cls._checks.values()
        ]
