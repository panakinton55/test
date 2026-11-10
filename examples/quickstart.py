#!/usr/bin/env python3
"""End-to-end local demo: issue a credential and ask the proxy to decide.

This script never prints private keys or seeds.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from atoa_identity import AgentIdentity, hash_request, issue_credential
from atoa_policy_proxy.app import create_app
from atoa_policy_proxy.policy import policy_from_dict


def main() -> None:
    identity = AgentIdentity.generate(
        owner="demo@example.com",
        capabilities=["weather:read"],
    )
    print("agent_id:", identity.agent_id)
    print("public_key:", identity.public_key)

    policy = policy_from_dict(
        {
            "audience": "http://127.0.0.1:8080",
            "default_action": "deny",
            "agents": {
                identity.agent_id: {
                    "public_key": identity.public_key,
                    "key_version": identity.key_version,
                    "allowed_scopes": ["weather:read"],
                }
            },
            "routes": [
                {
                    "id": "weather-get",
                    "host": "api.example.com",
                    "methods": ["GET"],
                    "path_pattern": "/v1/weather*",
                    "required_scopes": ["weather:read"],
                    "rate_limit": {"requests": 10, "window_seconds": 60},
                }
            ],
        }
    )

    target_url = "https://api.example.com/v1/weather?city=Tokyo"
    method = "GET"
    request_hash = hash_request(method=method, url=target_url)
    credential = issue_credential(
        identity,
        audience=policy.audience,
        scopes=["weather:read"],
        request_hash=request_hash,
        ttl_seconds=60,
    )

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "demo.db"
        app = create_app(policy=policy, db_path=db_path, forward=False)
        client = TestClient(app)
        allowed = client.post(
            "/v1/proxy",
            json={
                "method": method,
                "target_url": target_url,
                "credential": credential.to_dict(),
            },
        )
        denied = client.post(
            "/v1/proxy",
            json={
                "method": "DELETE",
                "target_url": target_url,
                "credential": issue_credential(
                    identity,
                    audience=policy.audience,
                    scopes=["weather:read"],
                    request_hash=hash_request(method="DELETE", url=target_url),
                ).to_dict(),
            },
        )

    print("allowed decision:", json.dumps(allowed.json(), indent=2))
    print("denied decision:", json.dumps(denied.json(), indent=2))


if __name__ == "__main__":
    main()
