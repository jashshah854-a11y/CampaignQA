"""
Email notification utility via Resend REST API.
Uses httpx (already a dependency) — no extra package needed.
Only sends if RESEND_API_KEY is configured.
"""
import httpx
from core.config import get_settings


def send_run_complete_email(to_email: str, run_name: str, score: float, run_url: str) -> None:
    """
    Send a run-complete notification email via Resend.
    Silently no-ops if RESEND_API_KEY is not set.
    """
    settings = get_settings()
    if not settings.resend_api_key:
        return

    score_int = round(score)
    score_color = "#22c55e" if score_int >= 80 else "#f59e0b" if score_int >= 60 else "#ef4444"
    label = "Ready to launch" if score_int >= 80 else "Needs attention" if score_int >= 60 else "Critical issues found"

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:#1e40af;padding:24px 32px">
      <p style="color:#fff;font-size:18px;font-weight:700;margin:0">LaunchProof</p>
      <p style="color:#bfdbfe;font-size:13px;margin:4px 0 0">Pre-launch QA for paid media</p>
    </div>
    <div style="padding:32px">
      <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 4px">Your QA run is complete</p>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">{run_name}</p>

      <div style="text-align:center;background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px">
        <p style="color:{score_color};font-size:56px;font-weight:900;margin:0;line-height:1">{score_int}</p>
        <p style="color:{score_color};font-size:13px;font-weight:600;margin:6px 0 0">{label}</p>
      </div>

      <a href="{run_url}"
         style="display:block;text-align:center;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:14px;border-radius:10px;margin-bottom:24px">
        View Full Report →
      </a>

      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center">
        You're receiving this because you have an account at LaunchProof.
      </p>
    </div>
  </div>
</body>
</html>
"""

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={
                "from": settings.notify_email_from,
                "to": [to_email],
                "subject": f"QA Complete: {run_name} — Score {score_int}/100",
                "html": html,
            },
            timeout=10,
        )
        resp.raise_for_status()
    except Exception:
        pass  # never fail the pipeline due to email
