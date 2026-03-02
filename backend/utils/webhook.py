"""
Generic outbound webhook notification.

POSTs a JSON payload to a user-configured URL when a QA run completes.
Compatible with n8n, Zapier, Make, custom webhook endpoints, and any HTTP server.
Silently no-ops on any failure — never blocks the pipeline.
"""
import httpx
from datetime import datetime, timezone


def send_webhook_notification(
    webhook_url: str,
    run_id: str,
    run_name: str,
    platform: str,
    score: float,
    status: str,
    passed: int,
    failed: int,
    warnings: int,
    run_url: str,
) -> None:
    """
    POST a run-complete event to the user's webhook URL.

    Payload schema:
    {
      "event": "run.completed",
      "run_id": "...",
      "run_name": "...",
      "platform": "meta",
      "readiness_score": 87.5,
      "status": "completed",
      "passed_checks": 15,
      "failed_checks": 2,
      "warning_checks": 1,
      "report_url": "https://...",
      "timestamp": "2025-11-25T10:00:45Z"
    }
    """
    payload = {
        "event": "run.completed",
        "run_id": run_id,
        "run_name": run_name,
        "platform": platform,
        "readiness_score": round(score, 2),
        "status": status,
        "passed_checks": passed,
        "failed_checks": failed,
        "warning_checks": warnings,
        "report_url": run_url,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        resp = httpx.post(
            webhook_url,
            json=payload,
            timeout=10,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "LaunchProof-Webhook/1.0",
                "X-LaunchProof-Event": "run.completed",
            },
        )
        resp.raise_for_status()
    except Exception:
        pass  # never fail the pipeline due to webhook delivery
