"""Policy document loading and matching (default deny)."""

from __future__ import annotations

import fnmatch
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml


@dataclass(frozen=True)
class RateLimitConfig:
    requests: int
    window_seconds: int


@dataclass(frozen=True)
class RoutePolicy:
    id: str
    host: str
    methods: tuple[str, ...]
    path_pattern: str
    required_scopes: tuple[str, ...]
    rate_limit: RateLimitConfig | None = None
    max_amount: float | None = None


@dataclass(frozen=True)
class AgentPolicy:
    agent_id: str
    public_key: str
    allowed_scopes: tuple[str, ...]
    key_version: int = 1
    enabled: bool = True


@dataclass(frozen=True)
class PolicyDocument:
    audience: str
    agents: dict[str, AgentPolicy] = field(default_factory=dict)
    routes: tuple[RoutePolicy, ...] = ()
    default_action: str = "deny"

    def get_agent(self, agent_id: str) -> AgentPolicy | None:
        return self.agents.get(agent_id)


def _parse_rate_limit(raw: dict[str, Any] | None) -> RateLimitConfig | None:
    if not raw:
        return None
    return RateLimitConfig(
        requests=int(raw["requests"]),
        window_seconds=int(raw["window_seconds"]),
    )


def _parse_route(raw: dict[str, Any], index: int) -> RoutePolicy:
    methods = tuple(str(m).upper() for m in raw.get("methods", ["GET"]))
    return RoutePolicy(
        id=str(raw.get("id", f"route-{index}")),
        host=str(raw["host"]).lower(),
        methods=methods,
        path_pattern=str(raw.get("path_pattern", raw.get("path", "/*"))),
        required_scopes=tuple(str(s) for s in raw.get("required_scopes", [])),
        rate_limit=_parse_rate_limit(raw.get("rate_limit")),
        max_amount=float(raw["max_amount"]) if raw.get("max_amount") is not None else None,
    )


def _parse_agent(agent_id: str, raw: dict[str, Any]) -> AgentPolicy:
    return AgentPolicy(
        agent_id=agent_id,
        public_key=str(raw["public_key"]).lower(),
        allowed_scopes=tuple(str(s) for s in raw.get("allowed_scopes", [])),
        key_version=int(raw.get("key_version", 1)),
        enabled=bool(raw.get("enabled", True)),
    )


def policy_from_dict(data: dict[str, Any]) -> PolicyDocument:
    if str(data.get("default_action", "deny")).lower() != "deny":
        raise ValueError("only default_action: deny is supported in this MVP")

    agents_raw = data.get("agents") or {}
    agents = {agent_id: _parse_agent(agent_id, cfg) for agent_id, cfg in agents_raw.items()}
    routes = tuple(_parse_route(route, i) for i, route in enumerate(data.get("routes") or []))
    audience = str(data.get("audience", "")).strip()
    if not audience:
        raise ValueError("policy.audience is required")

    return PolicyDocument(
        audience=audience,
        agents=agents,
        routes=routes,
        default_action="deny",
    )


def load_policy(path: str | Path) -> PolicyDocument:
    text = Path(path).read_text(encoding="utf-8")
    suffix = Path(path).suffix.lower()
    data = yaml.safe_load(text) if suffix in {".yaml", ".yml"} else json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("policy root must be a mapping")
    return policy_from_dict(data)


def match_route(
    policy: PolicyDocument,
    *,
    method: str,
    url: str,
) -> RoutePolicy | None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    path = parsed.path or "/"
    method_u = method.upper()

    for route in policy.routes:
        if route.host != host:
            continue
        if method_u not in route.methods:
            continue
        if fnmatch.fnmatchcase(path, route.path_pattern):
            return route
    return None
