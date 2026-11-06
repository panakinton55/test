"""Shared records for an approved, path-scoped exception."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ExceptionRule:
    id: str
    rule_id: str
    ruleset_id: str
    method: str
    path: str
    expires_on: str
    reason: str
