"""Propose a one-rule exception when a normal path is blocked repeatedly."""

import hashlib
from dataclasses import dataclass
from datetime import date, timedelta

from wafops.cloudflare import MANAGED_RULESET_ID
from wafops.paths import validate_path
from wafops.errors import ProtectionError
from wafops.templates import Template, path_is_blocked

_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"}
_WINDOW_DAYS = 30


@dataclass(frozen=True)
class Proposal:
    id: str
    rule_id: str
    ruleset_id: str
    method: str
    path: str
    count: int
    expires_on: str
    accepted: bool
    reason: str


def propose(site_name: str, provider: str, template: Template, events: list[dict], today: date, threshold: int, known_paths: tuple[str, ...]) -> list[Proposal]:
    grouped: dict[tuple, int] = {}
    actions: dict[tuple, str] = {}
    for event in events:
        method = str(event.get("method") or "").upper()
        path = str(event.get("path") or "")
        rule_id = str(event.get("rule_id") or "")
        ruleset_id = str(event.get("ruleset_id") or "")
        key = (rule_id, ruleset_id, method, path)
        grouped[key] = grouped.get(key, 0) + int(event.get("count") or 0)
        actions[key] = str(event.get("action") or "block")
    eligible = set(template.fp_paths) | set(known_paths)
    proposals = []
    for key in sorted(grouped):
        rule_id, ruleset_id, method, path = key
        proposals.append(
            _judge(
                site_name=site_name,
                provider=provider,
                template=template,
                rule_id=rule_id,
                ruleset_id=ruleset_id,
                method=method,
                path=path,
                action=actions[key],
                count=grouped[key],
                today=today,
                threshold=threshold,
                eligible=eligible,
            )
        )
    return proposals


def _judge(*, site_name, provider, template, rule_id, ruleset_id, method, path, action, count, today, threshold, eligible) -> Proposal:
    expires_on = (today + timedelta(days=_WINDOW_DAYS)).isoformat()
    proposal_id = "exc-" + hashlib.sha256(f"{site_name}|{rule_id}|{method}|{path}".encode()).hexdigest()[:12]
    reason = _reason(provider, template, rule_id, ruleset_id, method, path, action, count, threshold, eligible)
    return Proposal(
        id=proposal_id,
        rule_id=rule_id,
        ruleset_id=ruleset_id,
        method=method,
        path=path,
        count=count,
        expires_on=expires_on,
        accepted=reason is None,
        reason=reason or "同じルールが通常操作のパスで繰り返し遮断されている",
    )


def _reason(provider, template, rule_id, ruleset_id, method, path, action, count, threshold, eligible) -> str | None:
    if provider != "cloudflare":
        return "Cloudflare以外では、ルール1件だけの例外を自動では作りません"
    if action != "block":
        return "ブロック以外のイベントは例外にしません"
    try:
        validate_path(path)
    except ProtectionError:
        return "パスの形式が例外に使えません"
    if path_is_blocked(template, path):
        return "遮断しているパスは例外にしません"
    if path not in eligible:
        return "このテンプレの通常操作パスではありません"
    if method not in _METHODS:
        return "例外のメソッドが不正です"
    if count < threshold:
        return "件数が閾値に達していません"
    if ruleset_id != MANAGED_RULESET_ID:
        return "Cloudflare Managed Ruleset のルールではありません"
    if len(rule_id) != 32 or any(char not in "0123456789abcdef" for char in rule_id):
        return "例外のルールIDが不正です"
    return None


def format_proposals(proposals: list[Proposal]) -> str:
    accepted = [item for item in proposals if item.accepted]
    rejected = [item for item in proposals if not item.accepted]
    lines = ["承認できる候補:"]
    if not accepted:
        lines.append("  なし")
    for item in accepted:
        lines.append(
            f"  {item.id}  {item.method} {item.path}  rule {item.rule_id}  {item.count}件  期限 {item.expires_on}"
        )
        lines.append(f"    {item.reason}")
    lines.append("入れない候補:")
    if not rejected:
        lines.append("  なし")
    for item in rejected:
        lines.append(f"  {item.method} {item.path}  {item.count}件  {item.reason}")
    return "\n".join(lines)
