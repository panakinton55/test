"""Load a site file. Unknown keys and blocked exception paths are rejected."""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from wafops.errors import ProtectionError, WafopsError
from wafops.paths import validate_path
from wafops.templates import get_template, path_is_blocked

_NAME = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
_ZONE = re.compile(r"^[0-9a-f]{32}$")
_KEYS = {
    "name",
    "provider",
    "zone_id",
    "template",
    "mode",
    "plan",
    "known_paths",
    "false_positive_threshold",
    "scope",
    "web_acl_name",
    "region",
}


@dataclass(frozen=True)
class Site:
    name: str
    provider: str
    template: str
    mode: str
    plan: str
    zone_id: str | None
    known_paths: tuple[str, ...]
    false_positive_threshold: int
    scope: str
    web_acl_name: str | None
    region: str | None


def load_site_file(path: str | Path) -> Site:
    raw = Path(path).read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise WafopsError(f"サイト定義のJSONが壊れています: {path}") from exc
    if not isinstance(data, dict):
        raise WafopsError("サイト定義はJSONオブジェクトです")
    return load_site(data)


def load_site(data: dict) -> Site:
    extra = set(data) - _KEYS
    if extra:
        raise WafopsError("未知の項目です: " + ", ".join(sorted(extra)))
    name = str(data.get("name") or "")
    if not _NAME.fullmatch(name):
        raise WafopsError("name は英小文字、数字、ハイフンです")
    provider = data.get("provider")
    if provider not in {"cloudflare", "aws"}:
        raise WafopsError("provider は cloudflare か aws です")
    template_key = str(data.get("template") or "")
    template = get_template(template_key)
    mode = data.get("mode") or "block"
    if mode not in {"block", "challenge"}:
        raise ProtectionError("mode は block か challenge です")
    plan = data.get("plan") or ("pro" if provider == "cloudflare" else "")
    if provider == "cloudflare" and plan not in {"pro", "business", "enterprise"}:
        raise ProtectionError("CloudflareはPro、Business、Enterpriseのゾーンで使います")
    zone_id = data.get("zone_id")
    if provider == "cloudflare":
        if not isinstance(zone_id, str) or not _ZONE.fullmatch(zone_id):
            raise WafopsError("zone_id は32文字の16進数です")
    raw_paths = data.get("known_paths") or []
    if not isinstance(raw_paths, list):
        raise WafopsError("known_paths は配列です")
    known = tuple(validate_path(path) for path in raw_paths)
    for path in known:
        if path_is_blocked(template, path):
            raise ProtectionError(f"遮断しているパスは例外候補にできません: {path}")
    threshold = data.get("false_positive_threshold", 5)
    if not isinstance(threshold, int) or isinstance(threshold, bool) or not 1 <= threshold <= 1000:
        raise WafopsError("false_positive_threshold は1から1000の整数です")
    scope = data.get("scope") or "REGIONAL"
    if scope not in {"REGIONAL", "CLOUDFRONT"}:
        raise WafopsError("scope は REGIONAL か CLOUDFRONT です")
    web_acl_name = data.get("web_acl_name")
    region = data.get("region")
    if provider == "aws":
        if not isinstance(web_acl_name, str) or not web_acl_name:
            raise WafopsError("AWSには web_acl_name が必要です")
        if not isinstance(region, str) or not region:
            raise WafopsError("AWSには region が必要です")
    return Site(
        name=name,
        provider=provider,
        template=template.key,
        mode=mode,
        plan=plan,
        zone_id=zone_id,
        known_paths=known,
        false_positive_threshold=threshold,
        scope=scope,
        web_acl_name=web_acl_name,
        region=region,
    )
