from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, Any
from enum import Enum
from datetime import datetime
import uuid


# ── Enums ─────────────────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class CheckStatus(str, Enum):
    passed = "passed"
    failed = "failed"
    warning = "warning"
    skipped = "skipped"
    error = "error"


class Severity(str, Enum):
    critical = "critical"
    major = "major"
    minor = "minor"


class Platform(str, Enum):
    meta = "meta"
    google = "google"
    tiktok = "tiktok"
    linkedin = "linkedin"
    multi = "multi"
    universal = "universal"


class PlanTier(str, Enum):
    free = "free"
    pro = "pro"
    agency = "agency"


# ── Check Engine Models ────────────────────────────────────────────────────────

class ParsedUrl(BaseModel):
    raw_url: str
    host: str = ""
    path: str = ""
    params: dict[str, str] = {}
    ad_name: Optional[str] = None
    ad_set_name: Optional[str] = None
    campaign_name: Optional[str] = None
    parse_error: Optional[str] = None


class RunContext(BaseModel):
    run_id: str
    user_id: str
    platform: Platform
    urls: list[ParsedUrl]
    campaign_name: Optional[str] = None
    campaign_objective: Optional[str] = None
    industry_vertical: Optional[str] = None
    # Ad copy fields for character-limit checks
    headline: Optional[str] = None
    primary_text: Optional[str] = None
    description: Optional[str] = None
    # Raw metadata passed through
    extra: dict[str, Any] = {}


class CheckResult(BaseModel):
    check_id: str
    check_name: str
    check_category: str
    platform: str
    status: CheckStatus
    severity: Severity
    message: str
    recommendation: Optional[str] = None
    affected_items: list[str] = []
    metadata: dict[str, Any] = {}
    execution_ms: int = 0


# ── API Request/Response Models ────────────────────────────────────────────────

class UrlInput(BaseModel):
    url: str
    ad_name: Optional[str] = None
    ad_set_name: Optional[str] = None
    campaign_name: Optional[str] = None


class CreateRunRequest(BaseModel):
    run_name: str
    platform: Platform
    urls: list[UrlInput]
    campaign_name: Optional[str] = None
    campaign_objective: Optional[str] = None  # awareness|traffic|conversion|retargeting
    industry_vertical: Optional[str] = None   # ecommerce|saas|lead_gen|app_install
    headline: Optional[str] = None
    primary_text: Optional[str] = None
    description: Optional[str] = None

    @field_validator("urls")
    @classmethod
    def urls_not_empty(cls, v):
        if not v:
            raise ValueError("At least one URL is required")
        if len(v) > 50:
            raise ValueError("Maximum 50 URLs per run")
        return v


class RunStatusResponse(BaseModel):
    run_id: str
    status: RunStatus
    progress_pct: int
    readiness_score: Optional[float] = None
    total_checks: Optional[int] = None
    passed_checks: Optional[int] = None
    failed_checks: Optional[int] = None
    warning_checks: Optional[int] = None


class CheckResultResponse(BaseModel):
    check_id: str
    check_name: str
    check_category: str
    platform: str
    status: CheckStatus
    severity: Severity
    message: str
    recommendation: Optional[str] = None
    affected_items: list[str] = []
    execution_ms: int = 0


class ReportSummary(BaseModel):
    readiness_score: float
    passed: int
    failed: int
    warnings: int
    errors: int
    by_category: dict[str, dict[str, int]]
    critical_failures: list[str]


class RunReportResponse(BaseModel):
    run_id: str
    run_name: str
    platform: str
    status: RunStatus
    created_at: str
    completed_at: Optional[str] = None
    summary: ReportSummary
    checks: list[CheckResultResponse]
    urls: list[dict]
    shareable_url: Optional[str] = None


class CreateRunResponse(BaseModel):
    run_id: str
    status: RunStatus
    tier1_results: list[CheckResultResponse]
    message: str
