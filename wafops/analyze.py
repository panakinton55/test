"""Label a WAF block log with the control that fired and the exception decision."""

from dataclasses import dataclass
from datetime import date

from wafops.cloudflare import MANAGED_RULESET_ID
from wafops.false_positive import Proposal, propose
from wafops.templates import Rule, Template

_LABELS = {
    "sensitive-paths": "機密ファイルへのアクセス",
    "path-traversal": "パストラバーサル",
    "wp-users-api": "ユーザー一覧の取得",
    "wp-author-enum": "作者番号の列挙",
    "wp-login": "ログインの連続試行",
    "login": "ログインの連続試行",
    "checkout": "カートと決済の連続送信",
    "contact": "問い合わせの連続送信",
    "managed-ruleset": "マネージドルールの遮断",
    "unclassified": "分類できない遮断",
}


@dataclass(frozen=True)
class Finding:
    label: str
    control: str
    description: str
    decision: str
    method: str
    path: str
    count: int
    reason: str


def analyze(
    site_name: str,
    provider: str,
    template: Template,
    events: list[dict],
    today: date,
    threshold: int,
    known_paths: tuple[str, ...],
) -> list[Finding]:
    proposals = propose(site_name, provider, template, events, today, threshold, known_paths)
    by_key = {(item.rule_id, item.ruleset_id, item.method, item.path): item for item in proposals}
    grouped: dict[tuple, dict] = {}
    for event in events:
        method = str(event.get("method") or "").upper()
        path = str(event.get("path") or "")
        rule_id = str(event.get("rule_id") or "")
        ruleset_id = str(event.get("ruleset_id") or "")
        key = (rule_id, ruleset_id, method, path)
        current = grouped.get(key)
        if current is None:
            grouped[key] = dict(event)
            grouped[key]["method"] = method
            grouped[key]["count"] = int(event.get("count") or 0)
        else:
            current["count"] = int(current["count"]) + int(event.get("count") or 0)
    findings = []
    for key in sorted(grouped):
        event = grouped[key]
        proposal = by_key[key]
        control, description = _control(template, event)
        if control in {"managed-ruleset", "unclassified"}:
            decision = _decision(proposal)
            reason = proposal.reason
        else:
            decision = "遮断を維持"
            reason = "テンプレの固定ルールです。例外はこの制御を外しません"
        findings.append(
            Finding(
                label=_LABELS.get(control, control),
                control=control,
                description=description,
                decision=decision,
                method=event["method"],
                path=str(event.get("path") or ""),
                count=int(event["count"]),
                reason=reason,
            )
        )
    return findings


def format_findings(findings: list[Finding]) -> str:
    if not findings:
        return "分析するブロックログがありません。"
    lines = []
    for item in findings:
        lines.append(f"{item.label}  {item.method} {item.path}  {item.count}件")
        lines.append(f"  制御: {item.control}  {item.description}")
        lines.append(f"  判定: {item.decision}  {item.reason}")
    return "\n".join(lines)


def _decision(proposal: Proposal) -> str:
    if proposal.accepted:
        return "例外候補"
    if proposal.reason == "遮断しているパスは例外にしません":
        return "遮断を維持"
    if proposal.reason == "Cloudflare Managed Ruleset のルールではありません":
        return "遮断を維持"
    return "様子を見る"


def _control(template: Template, event: dict) -> tuple[str, str]:
    ref = str(event.get("rule_ref") or "")
    if ref.startswith("wafops/locked/"):
        key = ref.removeprefix("wafops/locked/")
        rule = next((item for item in template.rules if item.key == key), None)
        if rule is not None:
            return rule.key, rule.description
    path = str(event.get("path") or "")
    for rule in template.rules:
        if rule.kind == "block" and _matches(rule, path):
            return rule.key, rule.description
    if ".." in path:
        traversal = next((item for item in template.rules if item.key == "path-traversal"), None)
        if traversal is not None:
            return traversal.key, traversal.description
    if event.get("ruleset_id") == MANAGED_RULESET_ID:
        return "managed-ruleset", "Cloudflare Managed Ruleset がこのリクエストを遮断"
    for rule in template.rules:
        if rule.kind == "rate" and _matches(rule, path):
            return rule.key, rule.description
    return "unclassified", "テンプレの制御とマネージドルールのどちらにも紐づかない"


def _matches(rule: Rule, path: str) -> bool:
    for clause in rule.clauses:
        if clause.match == "exact" and path == clause.path:
            return True
        if clause.match == "prefix" and path.startswith(clause.path):
            return True
    return False
