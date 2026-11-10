# atoa-policy-proxy

Default-deny HTTP gateway between an AI agent and external APIs.

The proxy verifies an `atoa-identity` credential, matches an explicit route
policy (host / method / path / scopes / rate limit / amount cap), writes every
decision to a SQLite audit log, and only then forwards the request.

## Run

```bash
uv run atoa-policy-proxy --policy examples/policy.yaml --db /tmp/atoa_proxy.db
```

## Decide endpoint

`POST /v1/proxy`

```json
{
  "method": "GET",
  "target_url": "https://api.example.com/v1/weather?city=Tokyo",
  "headers": {},
  "body": null,
  "credential": { "...": "issued by atoa-identity" }
}
```

Denied responses are always structured:

```json
{
  "allowed": false,
  "reason_code": "ROUTE_DENIED",
  "message": "no policy route allows this host/method/path",
  "request_id": "...",
  "agent_id": "did:atoa:...",
  "route_id": null,
  "details": {}
}
```

## Safety defaults

- Unknown agents, hosts, methods, and paths are denied.
- Credential signature covers timestamps, nonce, audience, and request_hash.
- Nonce replay is rejected via SQLite.
- Private keys never appear in responses or audit details.
