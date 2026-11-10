"""FastAPI application for the policy proxy."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Header, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from atoa_policy_proxy.audit import AuditLog
from atoa_policy_proxy.decision import PolicyEngine
from atoa_policy_proxy.nonce_store import NonceStore
from atoa_policy_proxy.policy import PolicyDocument, load_policy
from atoa_policy_proxy.rate_limit import RateLimiter


class ProxyRequest(BaseModel):
    method: str = Field(default="GET", min_length=1)
    target_url: str = Field(min_length=1)
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = None
    credential: dict[str, Any]


class DenyBody(BaseModel):
    allowed: bool = False
    reason_code: str
    message: str
    request_id: str
    agent_id: str | None = None
    route_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


def create_app(
    *,
    policy: PolicyDocument | None = None,
    policy_path: str | Path | None = None,
    db_path: str | Path = "atoa_proxy.db",
    forward: bool = True,
    http_client: httpx.AsyncClient | None = None,
) -> FastAPI:
    if policy is None:
        if policy_path is None:
            raise ValueError("policy or policy_path is required")
        policy = load_policy(policy_path)

    audit = AuditLog(db_path)
    engine = PolicyEngine(
        policy,
        rate_limiter=RateLimiter(db_path),
        nonce_store=NonceStore(db_path),
    )

    app = FastAPI(
        title="atoa-policy-proxy",
        version="0.1.0",
        description="Default-deny gateway between AI agents and external APIs (MVP).",
    )
    app.state.policy = policy
    app.state.audit = audit
    app.state.engine = engine
    app.state.forward = forward
    app.state.http_client = http_client

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/audit")
    async def list_audit(limit: int = 50) -> dict[str, Any]:
        records = audit.list_recent(limit=min(max(limit, 1), 200))
        return {
            "items": [
                {
                    "request_id": r.request_id,
                    "decided_at": r.decided_at,
                    "allowed": r.allowed,
                    "reason_code": r.reason_code,
                    "message": r.message,
                    "agent_id": r.agent_id,
                    "method": r.method,
                    "target_url": r.target_url,
                    "route_id": r.route_id,
                    "details": r.details,
                }
                for r in records
            ]
        }

    @app.post("/v1/proxy")
    async def proxy(
        payload: ProxyRequest,
        request: Request,
        x_request_id: str | None = Header(default=None),
    ) -> Response:
        body_bytes = payload.body.encode("utf-8") if payload.body is not None else None
        decision = engine.evaluate(
            credential=payload.credential,
            method=payload.method,
            target_url=payload.target_url,
            body=body_bytes,
            headers=payload.headers,
        )
        record = audit.write(
            allowed=decision.allowed,
            reason_code=decision.reason_code,
            message=decision.message,
            agent_id=decision.agent_id,
            method=payload.method,
            target_url=payload.target_url,
            route_id=decision.route_id,
            details=decision.details,
            request_id=x_request_id,
        )

        if not decision.allowed:
            return JSONResponse(
                status_code=403,
                content=DenyBody(
                    reason_code=decision.reason_code,
                    message=decision.message,
                    request_id=record.request_id,
                    agent_id=decision.agent_id,
                    route_id=decision.route_id,
                    details=decision.details,
                ).model_dump(),
            )

        if not app.state.forward:
            return JSONResponse(
                status_code=200,
                content={
                    "allowed": True,
                    "reason_code": decision.reason_code,
                    "message": decision.message,
                    "request_id": record.request_id,
                    "agent_id": decision.agent_id,
                    "route_id": decision.route_id,
                    "details": decision.details,
                },
            )

        client: httpx.AsyncClient
        owns_client = False
        if app.state.http_client is not None:
            client = app.state.http_client
        else:
            client = httpx.AsyncClient(timeout=30.0)
            owns_client = True

        try:
            upstream = await client.request(
                method=payload.method.upper(),
                url=payload.target_url,
                headers=_filter_forward_headers(payload.headers),
                content=body_bytes,
            )
        except httpx.HTTPError as exc:
            audit.write(
                allowed=False,
                reason_code="UPSTREAM_ERROR",
                message=f"upstream request failed: {exc.__class__.__name__}",
                agent_id=decision.agent_id,
                method=payload.method,
                target_url=payload.target_url,
                route_id=decision.route_id,
                details={"error": str(exc)},
                request_id=f"{record.request_id}:upstream",
            )
            return JSONResponse(
                status_code=502,
                content={
                    "allowed": True,
                    "reason_code": "UPSTREAM_ERROR",
                    "message": "policy allowed the request but upstream failed",
                    "request_id": record.request_id,
                    "agent_id": decision.agent_id,
                    "route_id": decision.route_id,
                    "details": {"error_type": exc.__class__.__name__},
                },
            )
        finally:
            if owns_client:
                await client.aclose()

        # Do not bounce hop-by-hop headers.
        excluded = {"content-encoding", "transfer-encoding", "connection", "content-length"}
        response_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in excluded}
        response_headers["X-AtoA-Request-Id"] = record.request_id
        response_headers["X-AtoA-Decision"] = decision.reason_code
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=response_headers,
            media_type=upstream.headers.get("content-type"),
        )

    return app


def _filter_forward_headers(headers: dict[str, str]) -> dict[str, str]:
    blocked = {
        "host",
        "content-length",
        "transfer-encoding",
        "connection",
        "x-atoa-credential",
    }
    return {k: v for k, v in headers.items() if k.lower() not in blocked}
