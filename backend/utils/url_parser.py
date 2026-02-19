"""URL parsing utilities."""
from urllib.parse import urlparse, parse_qs
from core.models import ParsedUrl, UrlInput


def parse_url(u: UrlInput) -> ParsedUrl:
    raw = u.url.strip()
    try:
        parsed = urlparse(raw)
        params = {k: v[0] for k, v in parse_qs(parsed.query, keep_blank_values=True).items()}
        return ParsedUrl(
            raw_url=raw,
            host=parsed.netloc,
            path=parsed.path,
            params=params,
            ad_name=u.ad_name,
            ad_set_name=u.ad_set_name,
            campaign_name=u.campaign_name,
        )
    except Exception as exc:
        return ParsedUrl(raw_url=raw, parse_error=str(exc))
