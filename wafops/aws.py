"""Compile the same templates to an AWS WAFv2 Web ACL document.

Single-rule path exceptions stay on Cloudflare. AWS cannot skip one managed
rule on one path without also skipping the rest of that rule group, so this
compiler does not emit them.
"""

import base64

from wafops.errors import ProtectionError
from wafops.templates import Rule, Template

_GROUPS = (
    "AWSManagedRulesCommonRuleSet",
    "AWSManagedRulesKnownBadInputsRuleSet",
    "AWSManagedRulesSQLiRuleSet",
    "AWSManagedRulesAmazonIpReputationList",
)
_WORDPRESS_GROUPS = (
    "AWSManagedRulesPHPRuleSet",
    "AWSManagedRulesWordPressRuleSet",
)


def desired_rules(template: Template, mode: str) -> list[dict]:
    if mode not in {"block", "challenge"}:
        raise ProtectionError("mode は block か challenge です")
    custom_action = {"Block": {}} if mode == "block" else {"Challenge": {}}
    rules = []
    for group in _groups_for(template):
        rules.append(_managed(group))
    for rule in template.rules:
        if rule.kind == "rate":
            rules.append(_rate(rule))
        else:
            rules.append(_custom(rule, custom_action))
    return rules


def merge_rules(current: list, desired: list) -> list:
    if not isinstance(current, list):
        raise ProtectionError("AWSのRulesは配列です")
    customer = []
    ours = {}
    for rule in current:
        if not isinstance(rule, dict) or "Name" not in rule:
            raise ProtectionError("AWSのルールには Name が必要です")
        name = str(rule["Name"])
        if name.startswith("wafops-"):
            ours[name] = rule
        else:
            customer.append(rule)
    desired_names = {rule["Name"] for rule in desired}
    for name in ours:
        if name.startswith("wafops-locked-") and name not in desired_names:
            raise ProtectionError(f"固定ルールは外せません: {name}")
    next_priority = max((int(rule.get("Priority", 0)) for rule in customer), default=-1) + 1
    merged = list(customer)
    for offset, rule in enumerate(desired):
        copied = dict(rule)
        copied["Priority"] = next_priority + offset
        merged.append(copied)
    return merged


def update_document(web_acl: dict, rules: list) -> dict:
    acl = web_acl.get("WebACL", web_acl)
    lock = web_acl.get("LockToken")
    if not lock or "Id" not in acl or "Name" not in acl:
        raise ProtectionError("get-web-acl の結果には Id、Name、LockToken が必要です")
    return {
        "Id": acl["Id"],
        "Name": acl["Name"],
        "Scope": acl.get("Scope", "REGIONAL"),
        "LockToken": lock,
        "DefaultAction": acl.get("DefaultAction", {"Allow": {}}),
        "VisibilityConfig": acl.get("VisibilityConfig") or _visibility("wafops-web-acl"),
        "Rules": rules,
    }


def _groups_for(template: Template) -> tuple[str, ...]:
    if template.key == "wordpress":
        return _GROUPS + _WORDPRESS_GROUPS
    return _GROUPS


def _managed(group: str) -> dict:
    name = "wafops-locked-" + group.removeprefix("AWSManagedRules").lower()
    return {
        "Name": name,
        "Priority": 0,
        "OverrideAction": {"None": {}},
        "Statement": {"ManagedRuleGroupStatement": {"VendorName": "AWS", "Name": group}},
        "VisibilityConfig": _visibility(name),
    }


def _custom(rule: Rule, action: dict) -> dict:
    name = f"wafops-locked-{rule.key}"
    return {
        "Name": name,
        "Priority": 0,
        "Action": action,
        "Statement": _statement(rule),
        "VisibilityConfig": _visibility(name),
    }


def _rate(rule: Rule) -> dict:
    name = f"wafops-locked-{rule.key}"
    return {
        "Name": name,
        "Priority": 0,
        "Action": {"Block": {}},
        "Statement": {
            "RateBasedStatement": {
                "Limit": rule.rate_limit.requests,
                "EvaluationWindowSec": rule.rate_limit.period_seconds,
                "AggregateKeyType": "IP",
                "ScopeDownStatement": _statement(rule),
            }
        },
        "VisibilityConfig": _visibility(name),
    }


def _statement(rule: Rule):
    if rule.raw_expression:
        if "../" in rule.raw_expression:
            return {"ByteMatchStatement": _byte("../", "CONTAINS", "UriPath")}
        if "author" in rule.raw_expression:
            return {"ByteMatchStatement": _byte("author=", "CONTAINS", "QueryString")}
        raise ProtectionError(f"{rule.key} はAWSの条件に変換できません")
    matches = []
    for clause in rule.clauses:
        constraint = "EXACTLY" if clause.match == "exact" else "STARTS_WITH"
        matches.append({"ByteMatchStatement": _byte(clause.path, constraint, "UriPath")})
    if len(matches) == 1:
        return matches[0]
    return {"OrStatement": {"Statements": matches}}


def _byte(value: str, constraint: str, field: str) -> dict:
    return {
        "SearchString": base64.b64encode(value.encode()).decode(),
        "FieldToMatch": {field: {}},
        "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
        "PositionalConstraint": constraint,
    }


def _visibility(name: str) -> dict:
    return {
        "SampledRequestsEnabled": True,
        "CloudWatchMetricsEnabled": True,
        "MetricName": name[:128],
    }
