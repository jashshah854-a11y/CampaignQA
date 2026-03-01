"""
Slack webhook notification utility.
Sends a concise run-complete message to a user-configured Slack incoming webhook.
Uses httpx (already a dependency) — no extra package needed.
"""
import httpx


def send_slack_notification(webhook_url: str, run_name: str, score: float, run_url: str) -> None:
    """
    POST a run-complete Block Kit message to a Slack Incoming Webhook URL.
    Silently no-ops on any failure to never block the pipeline.
    """
    score_int = round(score)
    emoji = "✅" if score_int >= 80 else "⚠️" if score_int >= 60 else "🚨"
    label = "Ready to launch" if score_int >= 80 else "Needs attention" if score_int >= 60 else "Critical issues found"

    payload = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *QA Run Complete* — {run_name}",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Score*\n{score_int}/100"},
                    {"type": "mrkdwn", "text": f"*Status*\n{label}"},
                ],
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Report"},
                        "url": run_url,
                        "style": "primary",
                    }
                ],
            },
        ]
    }

    try:
        resp = httpx.post(webhook_url, json=payload, timeout=8)
        resp.raise_for_status()
    except Exception:
        pass  # never fail the pipeline due to Slack
