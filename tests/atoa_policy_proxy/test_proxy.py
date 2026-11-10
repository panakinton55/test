from __future__ import annotations

import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from atoa_identity import AgentIdentity, hash_request, issue_credential
from atoa_policy_proxy.app import create_app
from atoa_policy_proxy.policy import load_policy, policy_from_dict


def _policy_for(identity: AgentIdentity, *, max_amount: float | None = 50.0):
    return policy_from_dict(
        {
            "audience": "http://127.0.0.1:8080",
            "default_action": "deny",
            "agents": {
                identity.agent_id: {
                    "public_key": identity.public_key,
                    "key_version": 1,
                    "allowed_scopes": ["weather:read", "payments:create"],
                }
            },
            "routes": [
                {
                    "id": "weather-get",
                    "host": "api.example.com",
                    "methods": ["GET"],
                    "path_pattern": "/v1/weather*",
                    "required_scopes": ["weather:read"],
                    "rate_limit": {"requests": 2, "window_seconds": 60},
                },
                {
                    "id": "payments-create",
                    "host": "api.example.com",
                    "methods": ["POST"],
                    "path_pattern": "/v1/payments",
                    "required_scopes": ["payments:create"],
                    "max_amount": max_amount,
                },
            ],
        }
    )


def _client(tmp_path: Path, identity: AgentIdentity, *, forward: bool = False) -> TestClient:
    app = create_app(
        policy=_policy_for(identity),
        db_path=tmp_path / "proxy.db",
        forward=forward,
    )
    return TestClient(app)


def test_allows_matching_request(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://api.example.com/v1/weather?city=Tokyo"
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
    )
    res = client.post(
        "/v1/proxy",
        json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["allowed"] is True
    assert body["reason_code"] == "ALLOWED"
    assert "private" not in json.dumps(body).lower()


def test_denies_unknown_route_with_structured_reason(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://evil.example.com/steal"
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
    )
    res = client.post(
        "/v1/proxy",
        json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["allowed"] is False
    assert body["reason_code"] == "ROUTE_DENIED"
    assert body["request_id"]
    assert body["message"]


def test_denies_amount_exceeded(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://api.example.com/v1/payments"
    body = json.dumps({"amount": 99.0})
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["payments:create"],
        request_hash=hash_request(method="POST", url=url, body=body),
    )
    res = client.post(
        "/v1/proxy",
        json={
            "method": "POST",
            "target_url": url,
            "body": body,
            "credential": cred.to_dict(),
        },
    )
    assert res.status_code == 403
    assert res.json()["reason_code"] == "AMOUNT_EXCEEDED"


def test_rate_limit(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://api.example.com/v1/weather"

    def call(nonce: str) -> httpx.Response:
        cred = issue_credential(
            identity,
            audience="http://127.0.0.1:8080",
            scopes=["weather:read"],
            request_hash=hash_request(method="GET", url=url),
            nonce=nonce,
        )
        return client.post(
            "/v1/proxy",
            json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
        )

    assert call("n1").status_code == 200
    assert call("n2").status_code == 200
    limited = call("n3")
    assert limited.status_code == 403
    assert limited.json()["reason_code"] == "RATE_LIMITED"


def test_nonce_replay_denied(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://api.example.com/v1/weather"
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
        nonce="same-nonce",
    )
    payload = {"method": "GET", "target_url": url, "credential": cred.to_dict()}
    assert client.post("/v1/proxy", json=payload).status_code == 200
    replay = client.post("/v1/proxy", json=payload)
    assert replay.status_code == 403
    assert replay.json()["reason_code"] == "NONCE_REPLAY"


def test_audit_log_records_decisions(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    client = _client(tmp_path, identity)
    url = "https://evil.example.com/x"
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
    )
    client.post(
        "/v1/proxy",
        json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
    )
    audit = client.get("/v1/audit").json()
    assert len(audit["items"]) >= 1
    assert audit["items"][0]["reason_code"] == "ROUTE_DENIED"


def test_forward_to_upstream(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://api.example.com/v1/weather"
        return httpx.Response(200, json={"ok": True, "city": "Tokyo"})

    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    app = create_app(
        policy=_policy_for(identity),
        db_path=tmp_path / "proxy.db",
        forward=True,
        http_client=http_client,
    )
    client = TestClient(app)
    url = "https://api.example.com/v1/weather"
    cred = issue_credential(
        identity,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
    )
    res = client.post(
        "/v1/proxy",
        json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
    )
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.headers["X-AtoA-Decision"] == "ALLOWED"


def test_unregistered_agent_denied(tmp_path: Path) -> None:
    allowed = AgentIdentity.generate(owner="a@example.com")
    stranger = AgentIdentity.generate(owner="b@example.com")
    client = _client(tmp_path, allowed)
    url = "https://api.example.com/v1/weather"
    cred = issue_credential(
        stranger,
        audience="http://127.0.0.1:8080",
        scopes=["weather:read"],
        request_hash=hash_request(method="GET", url=url),
    )
    res = client.post(
        "/v1/proxy",
        json={"method": "GET", "target_url": url, "credential": cred.to_dict()},
    )
    assert res.status_code == 403
    assert res.json()["reason_code"] == "AGENT_NOT_ALLOWED"


def test_load_policy_yaml(tmp_path: Path) -> None:
    identity = AgentIdentity.generate(owner="a@example.com")
    path = tmp_path / "policy.yaml"
    path.write_text(
        f"""
audience: "http://127.0.0.1:8080"
default_action: deny
agents:
  "{identity.agent_id}":
    public_key: "{identity.public_key}"
    allowed_scopes: ["weather:read"]
routes:
  - id: weather-get
    host: api.example.com
    methods: ["GET"]
    path_pattern: "/v1/weather*"
    required_scopes: ["weather:read"]
""",
        encoding="utf-8",
    )
    doc = load_policy(path)
    assert doc.audience == "http://127.0.0.1:8080"
    assert identity.agent_id in doc.agents
