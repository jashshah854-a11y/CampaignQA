"""
QA Pipeline Executor.
Orchestrates Tier 1 (sync) and Tier 2 (async I/O) checks.
Computes readiness score. Writes results to Supabase.
"""
import importlib
import pkgutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from agents.checks.base import CheckRegistry
from core.models import CheckResult, CheckStatus, RunContext, Severity
from db.supabase_client import get_supabase_admin


def _load_all_checks():
    """Auto-import all check modules so their @register decorators fire."""
    import agents.checks.tier1 as t1_pkg
    import agents.checks.tier2 as t2_pkg
    for pkg in [t1_pkg, t2_pkg]:
        for _, mod_name, _ in pkgutil.iter_modules(pkg.__path__):
            importlib.import_module(f"{pkg.__name__}.{mod_name}")


_load_all_checks()


def calculate_readiness_score(results: list[CheckResult]) -> float:
    """
    Weighted score by severity.
    critical=4pts, major=2pts, minor=1pt.
    Errors do NOT penalize — they are excluded from denominator.
    """
    weights = {Severity.critical: 4, Severity.major: 2, Severity.minor: 1}
    earned = 0
    possible = 0
    for r in results:
        if r.status == CheckStatus.error or r.status == CheckStatus.skipped:
            continue
        w = weights.get(r.severity, 1)
        possible += w
        if r.status == CheckStatus.passed:
            earned += w
        elif r.status == CheckStatus.warning:
            earned += w * 0.5  # warnings count as half credit
    if possible == 0:
        return 100.0
    return round((earned / possible) * 100, 1)


def run_tier1_checks(ctx: RunContext) -> list[CheckResult]:
    """Run Tier 1 checks synchronously in parallel threads."""
    checks = CheckRegistry.get_checks_for_platform(ctx.platform.value, tier=1)
    results = []
    with ThreadPoolExecutor(max_workers=min(len(checks), 8)) as pool:
        futures = {pool.submit(c.run, ctx): c for c in checks}
        for future in as_completed(futures):
            results.append(future.result())
    return results


def run_tier2_checks(ctx: RunContext) -> list[CheckResult]:
    """Run Tier 2 checks synchronously (called from background task)."""
    checks = CheckRegistry.get_checks_for_platform(ctx.platform.value, tier=2)
    results = []
    with ThreadPoolExecutor(max_workers=min(len(checks), 4)) as pool:
        futures = {pool.submit(c.run, ctx): c for c in checks}
        for future in as_completed(futures):
            results.append(future.result())
    return results


def write_check_results(run_id: str, user_id: str, results: list[CheckResult]) -> None:
    """Write check results to Supabase check_results table."""
    db = get_supabase_admin()
    rows = [
        {
            "run_id": run_id,
            "user_id": user_id,
            "check_id": r.check_id,
            "check_category": r.check_category,
            "platform": r.platform,
            "status": r.status.value,
            "severity": r.severity.value,
            "check_name": r.check_name,
            "message": r.message,
            "recommendation": r.recommendation,
            "affected_items": r.affected_items,
            "metadata": r.metadata,
            "execution_ms": r.execution_ms,
        }
        for r in results
    ]
    if rows:
        db.table("check_results").insert(rows).execute()


def update_run_summary(run_id: str, all_results: list[CheckResult], status: str = "completed") -> float:
    """Compute summary stats and update qa_runs table."""
    db = get_supabase_admin()
    score = calculate_readiness_score(all_results)
    passed = sum(1 for r in all_results if r.status == CheckStatus.passed)
    failed = sum(1 for r in all_results if r.status == CheckStatus.failed)
    warnings = sum(1 for r in all_results if r.status == CheckStatus.warning)
    total = len(all_results)

    from datetime import datetime, timezone
    db.table("qa_runs").update({
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "total_checks": total,
        "passed_checks": passed,
        "failed_checks": failed,
        "warning_checks": warnings,
        "readiness_score": score,
    }).eq("id", run_id).execute()

    return score


def _notify_user(user_id: str, run_id: str, run_name: str, score: float) -> None:
    """Send run-complete email and/or Slack notification. Silently no-ops on any failure."""
    try:
        from utils.email import send_run_complete_email
        from utils.slack import send_slack_notification
        from core.config import get_settings
        db = get_supabase_admin()
        profile_row = db.table("profiles").select("email,slack_webhook_url").eq("id", user_id).single().execute()
        profile = profile_row.data or {}
        settings = get_settings()
        origin = settings.cors_origins_list[0].rstrip("/")
        run_url = f"{origin}/runs/{run_id}/report"

        email = profile.get("email")
        if email:
            send_run_complete_email(email, run_name, score, run_url)

        slack_webhook = profile.get("slack_webhook_url")
        if slack_webhook:
            send_slack_notification(slack_webhook, run_name, score, run_url)
    except Exception:
        pass


def run_tier2_background(run_id: str, user_id: str, ctx: RunContext, tier1_results: list[CheckResult]) -> None:
    """
    Background task: runs Tier 2 checks, writes results, updates run summary.
    Called via FastAPI BackgroundTasks after the Tier 1 response is sent.
    """
    db = get_supabase_admin()
    try:
        # Mark as running
        db.table("qa_runs").update({"status": "running"}).eq("id", run_id).execute()

        tier2_results = run_tier2_checks(ctx)
        write_check_results(run_id, user_id, tier2_results)

        all_results = tier1_results + tier2_results
        score = update_run_summary(run_id, all_results, status="completed")

        # Fire-and-forget email notification
        run_row = db.table("qa_runs").select("run_name").eq("id", run_id).single().execute()
        run_name = (run_row.data or {}).get("run_name", "QA Run")
        _notify_user(user_id, run_id, run_name, score)

    except Exception as exc:
        db.table("qa_runs").update({
            "status": "failed",
            "error_message": str(exc),
        }).eq("id", run_id).execute()
