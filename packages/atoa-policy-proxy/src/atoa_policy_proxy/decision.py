"""Policy decision engine: default deny with structured reasons."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from atoa_identity import (
    Credential,
    CredentialVerificationError,
    hash_request,
    verify_credential,
)
from atoa_policy_proxy.nonce_store import NonceStore
from atoa_policy_proxy.policy import PolicyDocument, RoutePolicy, match_route
from atoa_policy_proxy.rate_limit import RateLimiter


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason_code: str
    message: str
    agent_id: str | None = None
    route_id: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "message": self.message,
            "agent_id": self.agent_id,
            "route_id": self.route_id,
            "details": self.details,
        }


def _extract_amount(body: bytes | None, headers: dict[str, str]) -> float | None:
    header_amount = headers.get("x-atoa-amount") or headers.get("X-AtoA-Amount")
    if header_amount is not None:
        try:
            return float(header_amount)
        except ValueError:
            return None
    if not body:
        return None
    # Best-effort JSON peek for {"amount": ...} without requiring a JSON body.
    try:
        import json

        data = json.loads(body.decode("utf-8"))
        if isinstance(data, dict) and "amount" in data:
            return float(data["amount"])
    except (UnicodeDecodeError, ValueError, TypeError):
        return None
    return None


class PolicyEngine:
    def __init__(
        self,
        policy: PolicyDocument,
        *,
        rate_limiter: RateLimiter,
        nonce_store: NonceStore,
    ) -> None:
        self.policy = policy
        self.rate_limiter = rate_limiter
        self.nonce_store = nonce_store

    def evaluate(
        self,
        *,
        credential: Credential | dict[str, Any],
        method: str,
        target_url: str,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
        now: int | None = None,
    ) -> Decision:
        headers = headers or {}
        parsed = urlparse(target_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return Decision(
                allowed=False,
                reason_code="INVALID_TARGET",
                message="target_url must be an absolute http(s) URL",
                details={"target_url": target_url},
            )

        request_hash = hash_request(method=method, url=target_url, body=body)

        # Parse credential early for agent_id in deny responses.
        try:
            cred_obj = (
                credential
                if isinstance(credential, Credential)
                else Credential.from_dict(credential)
            )
        except Exception as exc:  # noqa: BLE001 - surface as structured deny
            return Decision(
                allowed=False,
                reason_code="INVALID_CREDENTIAL",
                message=f"credential could not be parsed: {exc}",
            )

        agent = self.policy.get_agent(cred_obj.agent_id)
        if agent is None or not agent.enabled:
            return Decision(
                allowed=False,
                reason_code="AGENT_NOT_ALLOWED",
                message="agent is not registered or is disabled",
                agent_id=cred_obj.agent_id,
            )

        try:
            verified = verify_credential(
                cred_obj,
                public_key=agent.public_key,
                expected_audience=self.policy.audience,
                expected_request_hash=request_hash,
                expected_key_version=agent.key_version,
                now=now,
            )
        except CredentialVerificationError as exc:
            return Decision(
                allowed=False,
                reason_code=exc.code,
                message=exc.message,
                agent_id=cred_obj.agent_id,
                details={"request_hash": request_hash},
            )

        # Credential scopes must be a subset of the agent's allowed scopes.
        illegal = [s for s in verified.scopes if s not in agent.allowed_scopes]
        if illegal:
            return Decision(
                allowed=False,
                reason_code="SCOPE_NOT_GRANTED",
                message="credential contains scopes not granted to this agent",
                agent_id=verified.agent_id,
                details={"illegal_scopes": illegal},
            )

        if not self.nonce_store.consume(
            nonce=verified.nonce,
            agent_id=verified.agent_id,
            expires_at=verified.expires_at,
            now=now,
        ):
            return Decision(
                allowed=False,
                reason_code="NONCE_REPLAY",
                message="credential nonce has already been used",
                agent_id=verified.agent_id,
            )

        route = match_route(self.policy, method=method, url=target_url)
        if route is None:
            return Decision(
                allowed=False,
                reason_code="ROUTE_DENIED",
                message="no policy route allows this host/method/path",
                agent_id=verified.agent_id,
                details={
                    "host": parsed.hostname,
                    "method": method.upper(),
                    "path": parsed.path or "/",
                },
            )

        missing_scopes = [s for s in route.required_scopes if s not in verified.scopes]
        if missing_scopes:
            return Decision(
                allowed=False,
                reason_code="SCOPE_MISSING",
                message="credential lacks scopes required by the matched route",
                agent_id=verified.agent_id,
                route_id=route.id,
                details={"missing_scopes": missing_scopes},
            )

        amount_decision = self._check_amount(
            route, body=body, headers=headers, agent_id=verified.agent_id
        )
        if amount_decision is not None:
            return amount_decision

        if route.rate_limit is not None:
            ok, count = self.rate_limiter.check_and_record(
                agent_id=verified.agent_id,
                route_id=route.id,
                limit=route.rate_limit.requests,
                window_seconds=route.rate_limit.window_seconds,
                now=now,
            )
            if not ok:
                return Decision(
                    allowed=False,
                    reason_code="RATE_LIMITED",
                    message="rate limit exceeded for this agent and route",
                    agent_id=verified.agent_id,
                    route_id=route.id,
                    details={
                        "limit": route.rate_limit.requests,
                        "window_seconds": route.rate_limit.window_seconds,
                        "current_count": count,
                    },
                )

        return Decision(
            allowed=True,
            reason_code="ALLOWED",
            message="request permitted by policy",
            agent_id=verified.agent_id,
            route_id=route.id,
            details={"request_hash": request_hash},
        )

    def _check_amount(
        self,
        route: RoutePolicy,
        *,
        body: bytes | None,
        headers: dict[str, str],
        agent_id: str,
    ) -> Decision | None:
        if route.max_amount is None:
            return None
        amount = _extract_amount(body, headers)
        if amount is None:
            return Decision(
                allowed=False,
                reason_code="AMOUNT_REQUIRED",
                message="route enforces max_amount but no amount was provided",
                agent_id=agent_id,
                route_id=route.id,
                details={"max_amount": route.max_amount},
            )
        if amount > route.max_amount:
            return Decision(
                allowed=False,
                reason_code="AMOUNT_EXCEEDED",
                message="request amount exceeds route max_amount",
                agent_id=agent_id,
                route_id=route.id,
                details={"amount": amount, "max_amount": route.max_amount},
            )
        return None
