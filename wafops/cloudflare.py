"""Compile templates to Cloudflare rulesets and apply them without dropping customer rules."""

import json
import re
from dataclasses import dataclass, field
from urllib import error, request

from wafops.errors import ProtectionError, WafopsError
from wafops.models import ExceptionRule
from wafops.paths import validate_path
from wafops.templates import Rule, Template

# Published id of the Cloudflare Managed Ruleset. Pro and above can deploy it.
MANAGED_RULESET_ID = "efb7b8c949ac4650a09736fc376e9aee"

PHASE_CUSTOM = "http_request_firewall_custom"
PHASE_RATE = "http_ratelimit"
PHASE_MANAGED = "http_request_firewall_managed"
PHASES = (PHASE_CUSTOM, PHASE_RATE, PHASE_MANAGED)

_HEX32 = re.compile(r"^[0-9a-f]{32}$")
_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"}
_REF_PREFIX = "wafops/"


@dataclass
class PhasePlan:
    phase: str
    rules: list
    creates: list
    updates: list
    deletes: list
    preserved: int

    @property
    def changed(self) -> bool:
        return bool(self.creates or self.updates or self.deletes)


@dataclass
class Plan:
    phases: list[PhasePlan] = field(default_factory=list)
    remote: bool = False

    @property
    def changed(self) -> bool:
        return any(phase.changed for phase in self.phases)


def edge_action(mode: str) -> str:
    if mode == "block":
        return "block"
    if mode == "challenge":
        return "managed_challenge"
    raise ProtectionError("mode は block か challenge です")


def rule_expression(rule: Rule) -> str:
    if rule.raw_expression:
        if rule.kind == "rate":
            raise ProtectionError("レート制限はパスだけで判定します")
        return rule.raw_expression
    parts = [_clause(clause.path, clause.match) for clause in rule.clauses]
    if not parts:
        raise ProtectionError(f"{rule.key} に条件がありません")
    if len(parts) == 1:
        return parts[0]
    return "(" + " or ".join(parts) + ")"


def _clause(path: str, match: str) -> str:
    quoted = json.dumps(validate_path(path))
    if match == "exact":
        return f"http.request.uri.path eq {quoted}"
    if match == "prefix":
        return f"starts_with(http.request.uri.path, {quoted})"
    raise ProtectionError("パスの一致方法が違います")


def _assert_rate_expression(expression: str) -> None:
    # Pro rate limiting rules cannot match on method. Counting stays per IP.
    if "method" in expression or "body" in expression or "matches" in expression:
        raise ProtectionError("Proのレート制限で使えない条件です")


def desired_rules(template: Template, mode: str, exceptions: list[ExceptionRule]) -> dict[str, list]:
    action = edge_action(mode)
    custom: list[dict] = []
    rate: list[dict] = []
    for rule in template.rules:
        expression = rule_expression(rule)
        payload = {
            "ref": f"wafops/locked/{rule.key}",
            "description": f"wafops {rule.description}",
            "expression": expression,
            "action": "block" if rule.kind == "rate" else action,
            "enabled": True,
        }
        if rule.kind == "rate":
            _assert_rate_expression(expression)
            payload["ratelimit"] = {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": rule.rate_limit.period_seconds,
                "requests_per_period": rule.rate_limit.requests,
                "mitigation_timeout": rule.rate_limit.mitigation_seconds,
            }
            rate.append(payload)
        else:
            custom.append(payload)
    managed = [exception_payload(item) for item in exceptions]
    managed.append(
        {
            "ref": f"wafops/locked/execute-{MANAGED_RULESET_ID}",
            "description": "wafops Cloudflare Managed Ruleset",
            "expression": "true",
            "action": "execute",
            "enabled": True,
            "action_parameters": {"id": MANAGED_RULESET_ID},
        }
    )
    return {PHASE_CUSTOM: custom, PHASE_RATE: rate, PHASE_MANAGED: managed}


def exception_payload(item: ExceptionRule) -> dict:
    path = validate_path(item.path)
    method = item.method.upper()
    if method not in _METHODS:
        raise ProtectionError("例外のメソッドが不正です")
    if not _HEX32.fullmatch(item.rule_id):
        raise ProtectionError("例外のルールIDが不正です")
    if item.ruleset_id != MANAGED_RULESET_ID:
        raise ProtectionError("例外を付けられるのは Cloudflare Managed Ruleset だけです")
    payload = {
        "ref": f"wafops/exception/{item.id}",
        "description": f"wafops exception until {item.expires_on}: {method} {path} rule {item.rule_id}",
        "expression": (
            f"(http.request.uri.path eq {json.dumps(path)} and "
            f"http.request.method eq {json.dumps(method)})"
        ),
        "action": "skip",
        "action_parameters": {"rules": {MANAGED_RULESET_ID: [item.rule_id]}},
        "enabled": True,
    }
    assert_single_rule_skip(payload)
    return payload


def assert_single_rule_skip(rule: dict) -> None:
    """A skip may name one managed rule. It may not skip a whole ruleset."""
    if rule.get("action") != "skip":
        raise ProtectionError("例外のアクションは skip です")
    params = rule.get("action_parameters") or {}
    if set(params) != {"rules"}:
        raise ProtectionError("例外はマネージドルール1件の指定だけです")
    mapping = params["rules"]
    if not isinstance(mapping, dict) or len(mapping) != 1:
        raise ProtectionError("例外はルールセット1つの中の1件だけです")
    ruleset_id, rule_ids = next(iter(mapping.items()))
    if ruleset_id != MANAGED_RULESET_ID or rule_ids != [rule_ids[0]] or not _HEX32.fullmatch(rule_ids[0]):
        raise ProtectionError("例外のルール指定が不正です")
    expression = rule.get("expression") or ""
    if "http.request.uri.path eq " not in expression or "http.request.method eq " not in expression:
        raise ProtectionError("例外はメソッドとパスの両方で限定します")


def build_plan(template: Template, mode: str, current: dict | None, exceptions: list[ExceptionRule]) -> Plan:
    remote = current is not None
    current = current or {}
    desired = desired_rules(template, mode, exceptions)
    phases = []
    for phase in PHASES:
        existing = current.get(phase) or []
        phases.append(plan_phase(phase, existing, desired[phase]))
    return Plan(phases=phases, remote=remote)


def plan_phase(phase: str, existing: list, desired: list) -> PhasePlan:
    if not isinstance(existing, list):
        raise WafopsError(f"{phase} の現状が配列ではありません")
    seen: set[str] = set()
    for rule in desired:
        ref = str(rule.get("ref") or "")
        if not ref.startswith(_REF_PREFIX):
            raise ProtectionError("追加するルールの ref は wafops/ で始めます")
        if ref in seen:
            raise WafopsError(f"ref が重複しています: {ref}")
        seen.add(ref)
        if phase != PHASE_MANAGED and rule.get("action") == "skip":
            raise ProtectionError("例外はマネージドルールのフェーズにだけ置きます")
        if phase == PHASE_MANAGED:
            if rule.get("action") == "skip":
                assert_single_rule_skip(rule)
            elif rule.get("action") != "execute":
                raise ProtectionError("マネージドフェーズに置けるのは例外とルールセットの実行だけです")

    customer: list[dict] = []
    ours: dict[str, dict] = {}
    for rule in existing:
        if not isinstance(rule, dict):
            raise WafopsError(f"{phase} にルール以外の要素があります")
        if _is_ours(rule):
            ref = rule["ref"]
            if ref in ours:
                raise WafopsError(f"同じ ref がゾーンに二つあります: {ref}")
            ours[ref] = rule
        else:
            customer.append(rule)

    customer_execute_ids = {ident for rule in customer if (ident := _execute_ruleset_id(rule))}
    if phase == PHASE_MANAGED:
        final = _merge_managed(customer, desired, customer_execute_ids)
    else:
        final = [_slim_customer(rule) for rule in customer] + desired

    final_refs = {rule["ref"] for rule in final if rule.get("ref")}
    creates: list[str] = []
    updates: list[str] = []
    for rule in desired:
        ref = rule["ref"]
        if ref not in final_refs:
            continue
        if ref not in ours:
            creates.append(ref)
        elif _comparable(ours[ref]) != _comparable(rule):
            updates.append(ref)

    deletes: list[str] = []
    for ref in ours:
        if ref in final_refs:
            continue
        if ref.startswith("wafops/locked/execute-"):
            ruleset_id = ref.removeprefix("wafops/locked/execute-")
            if ruleset_id in customer_execute_ids:
                deletes.append(ref)
                continue
        if ref.startswith("wafops/locked/"):
            raise ProtectionError(f"固定ルールは外せません: {ref}")
        deletes.append(ref)

    return PhasePlan(
        phase=phase,
        rules=final,
        creates=creates,
        updates=updates,
        deletes=sorted(deletes),
        preserved=len(customer),
    )


def _merge_managed(customer: list[dict], desired: list[dict], customer_execute_ids: set[str]) -> list[dict]:
    # Custom rules and rate limits run before this phase. Skip rules placed here
    # cannot turn those controls off. They only bypass one later managed rule.
    skips = []
    executes = []
    for rule in desired:
        if rule["action"] == "skip":
            skips.append(rule)
        elif _execute_ruleset_id(rule) in customer_execute_ids:
            continue
        else:
            executes.append(rule)
    customer_other = []
    customer_exec = []
    for rule in customer:
        if _execute_ruleset_id(rule):
            customer_exec.append(rule)
        else:
            customer_other.append(rule)
    return (
        [_slim_customer(rule) for rule in customer_other]
        + skips
        + [_slim_customer(rule) for rule in customer_exec]
        + executes
    )


def _is_ours(rule: dict) -> bool:
    ref = rule.get("ref") or ""
    return isinstance(ref, str) and ref.startswith(_REF_PREFIX)


def _execute_ruleset_id(rule: dict) -> str | None:
    if rule.get("action") != "execute":
        return None
    params = rule.get("action_parameters") or {}
    ident = params.get("id")
    if not isinstance(ident, str):
        return None
    return ident


def _slim_customer(rule: dict) -> dict:
    ident = rule.get("id")
    if not ident:
        raise WafopsError("id のない顧客ルールは残したまま更新できません")
    return {"id": ident}


def _comparable(rule: dict) -> dict:
    params = rule.get("action_parameters")
    cleaned = None
    if isinstance(params, dict):
        cleaned = {key: value for key, value in params.items() if key != "version"}
    rate = rule.get("ratelimit")
    cleaned_rate = None
    if isinstance(rate, dict):
        cleaned_rate = {
            "characteristics": sorted(rate.get("characteristics") or []),
            "period": rate.get("period"),
            "requests_per_period": rate.get("requests_per_period"),
            "mitigation_timeout": rate.get("mitigation_timeout"),
        }
    return {
        "action": rule.get("action"),
        "expression": rule.get("expression"),
        "description": rule.get("description"),
        "enabled": rule.get("enabled", True),
        "action_parameters": cleaned,
        "ratelimit": cleaned_rate,
    }


def format_plan(plan: Plan) -> str:
    if plan.remote:
        source = "渡された現状"
    else:
        source = "空のゾーンとして計算。apply は実行時にゾーンから取得します。"
    lines = [f"取得: {source}"]
    for phase in plan.phases:
        lines.append(phase.phase)
        lines.append(f"  維持する顧客ルール: {phase.preserved}")
        lines.append("  追加: " + (", ".join(phase.creates) if phase.creates else "なし"))
        lines.append("  更新: " + (", ".join(phase.updates) if phase.updates else "なし"))
        lines.append("  削除: " + (", ".join(phase.deletes) if phase.deletes else "なし"))
    if plan.changed:
        lines.append("差分があります。反映は apply --yes のときだけ行います。")
    else:
        lines.append("差分はありません。")
    return "\n".join(lines)


class CloudflareClient:
    def __init__(self, token: str, transport=None, base_url: str = "https://api.cloudflare.com/client/v4"):
        if not token or any(char in token for char in "\r\n"):
            raise WafopsError("CLOUDFLARE_API_TOKEN が空です")
        if transport is None and not base_url.startswith("https://"):
            raise WafopsError("Cloudflare API は HTTPS だけを使います")
        self._token = token
        self._base = base_url.rstrip("/")
        self._transport = transport or urllib_transport

    def get_entrypoint(self, zone_id: str, phase: str) -> list:
        _check_zone(zone_id)
        status, payload = self._request("GET", f"/zones/{zone_id}/rulesets/phases/{phase}/entrypoint")
        if status == 404:
            return []
        if status != 200 or not payload.get("success"):
            raise WafopsError(self._format_error(status, payload))
        rules = payload.get("result", {}).get("rules") or []
        if not isinstance(rules, list):
            raise WafopsError(f"{phase} の応答にルール配列がありません")
        return rules

    def put_entrypoint(self, zone_id: str, phase: str, rules: list) -> dict:
        _check_zone(zone_id)
        status, payload = self._request(
            "PUT",
            f"/zones/{zone_id}/rulesets/phases/{phase}/entrypoint",
            {"rules": rules},
        )
        if status != 200 or not payload.get("success"):
            raise WafopsError(self._format_error(status, payload))
        return payload.get("result") or {}

    def fetch_current(self, zone_id: str) -> dict:
        return {phase: self.get_entrypoint(zone_id, phase) for phase in PHASES}

    def _request(self, method: str, path: str, body: dict | None = None):
        data = None if body is None else json.dumps(body).encode()
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        status, raw = self._transport(method, self._base + path, data, headers)
        try:
            payload = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError as exc:
            raise WafopsError(f"Cloudflareの応答がJSONではありません (HTTP {status})") from exc
        if not isinstance(payload, dict):
            raise WafopsError(f"Cloudflareの応答形式が違います (HTTP {status})")
        return status, payload

    def _format_error(self, status: int, payload: dict) -> str:
        text = f"Cloudflare API HTTP {status}: {payload.get('errors')}"
        return text.replace(self._token, "[token]")


def _check_zone(zone_id: str) -> None:
    if not _HEX32.fullmatch(zone_id or ""):
        raise WafopsError("zone_id は32文字の16進数です")


class _NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def urllib_transport(method: str, url: str, data: bytes | None, headers: dict):
    opener = request.build_opener(_NoRedirect)
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=30) as response:
            return response.status, response.read()
    except error.HTTPError as exc:
        return exc.code, exc.read()
