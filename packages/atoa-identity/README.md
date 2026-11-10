# atoa-identity

Minimal Ed25519 identity + short-lived signed credentials for AI agents.

This is a weekend MVP, not a standards claim. Agents get a key pair, issue a
credential per outbound request, and receivers verify signature, expiry,
audience, scopes, and request hash.

## Install

```bash
uv add atoa-identity
```

## Quick start

```python
from atoa_identity import AgentIdentity, hash_request, issue_credential, verify_credential

identity = AgentIdentity.generate(
    owner="you@example.com",
    capabilities=["weather:read"],
)

request_hash = hash_request(
    method="GET",
    url="https://api.example.com/v1/weather?city=Tokyo",
)
cred = issue_credential(
    identity,
    audience="https://proxy.local",
    scopes=["weather:read"],
    request_hash=request_hash,
    ttl_seconds=60,
)

verify_credential(
    cred,
    expected_audience="https://proxy.local",
    required_scopes=["weather:read"],
    expected_request_hash=request_hash,
)
print(identity.agent_id)
print(cred.to_dict().keys())  # never print private keys
```

## Signed fields

Every credential signature covers:

- `agent_id`
- `key_version`
- `issued_at` / `expires_at` (timestamps)
- `audience`
- `scopes`
- `nonce`
- `request_hash`

## Safety

- Private keys / seeds must never appear in logs, responses, or docs.
- Prefer `save_seed()` with mode `0600` for local persistence only.
- Default TTL is short (60s). Keep it short.
