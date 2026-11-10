# AtoA 土管（最小コア）

AIエージェント同士が **安全に仕事を依頼し合う** ための、個人が週末に作れる最小プロトコル実装です。

これは世界標準でも、分散ID基盤でも、マーケットプレイスでもありません。  
ローカルで動き、GitHubに公開でき、他の開発者が自分のエージェントに数行で組み込める **動く最小コア** です。

このリポジトリには2つのパッケージがあります。

| パッケージ | 役割 |
|---|---|
| [`atoa-identity`](packages/atoa-identity) | エージェントの身元証明（Ed25519 + 短命クレデンシャル） |
| [`atoa-policy-proxy`](packages/atoa-policy-proxy) | 外部APIへの暴走防止ゲートウェイ（default deny） |

## 設計方針

- **default deny**: 明示的に許可したものだけ通す
- 署名対象に必ず含める: `issued_at` / `expires_at` / `nonce` / `audience` / `request_hash`
- 秘密鍵はログ・レスポンス・エラー・README例に出さない
- 依存は最小（PyNaCl / FastAPI / SQLite / PyYAML）
- Docker / K8s / 決済 / ブロックチェーン / 管理画面は作らない

## セットアップ

```bash
# Python 3.12 + uv
uv sync
```

## 5分クイックスタート

```bash
uv run python examples/quickstart.py
```

許可された天気APIリクエストは `ALLOWED`、許可されていないメソッドは構造化理由付きで `ROUTE_DENIED` になります。

## エージェント側（数行）

```python
from atoa_identity import AgentIdentity, hash_request, issue_credential

identity = AgentIdentity.generate(
    owner="you@example.com",
    capabilities=["weather:read"],
)
# 公開プロフィールだけ共有する（秘密鍵は保存しない / 印刷しない）
identity.save_public_profile("agent.public.json")
identity.save_seed(".atoa/agent.seed")  # mode 0600 / gitignore 済み

url = "https://api.example.com/v1/weather?city=Tokyo"
cred = issue_credential(
    identity,
    audience="http://127.0.0.1:8080",
    scopes=["weather:read"],
    request_hash=hash_request(method="GET", url=url),
    ttl_seconds=60,
)

# proxy に渡すのは credential dict のみ
payload = {
    "method": "GET",
    "target_url": url,
    "credential": cred.to_dict(),
}
```

`agent_id` 形式:

```text
did:atoa:<32-byte-public-key-as-hex>
```

## プロキシ側

1. エージェントの **公開鍵** を `examples/policy.yaml` に登録する  
2. 許可する host / method / path / scopes / rate limit / max_amount を書く  
3. 起動する

```bash
uv run atoa-policy-proxy --policy examples/policy.yaml --db /tmp/atoa_proxy.db
```

主なエンドポイント:

- `POST /v1/proxy` … 判定（+ 必要なら upstream 転送）
- `GET /v1/audit` … 直近の監査ログ
- `GET /healthz` … ヘルスチェック

拒否レスポンスの形:

```json
{
  "allowed": false,
  "reason_code": "ROUTE_DENIED",
  "message": "no policy route allows this host/method/path",
  "request_id": "…",
  "agent_id": "did:atoa:…",
  "route_id": null,
  "details": {}
}
```

## クレデンシャル（署名対象）

```json
{
  "agent_id": "did:atoa:…",
  "key_version": 1,
  "issued_at": 1700000000,
  "expires_at": 1700000060,
  "audience": "http://127.0.0.1:8080",
  "scopes": ["weather:read"],
  "nonce": "…",
  "request_hash": "sha256:…",
  "signature": "…"
}
```

`request_hash` は `METHOD\\nURL\\n<body>` の SHA-256 です。改ざん・付け替えを防ぎます。

## 開発コマンド

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
uv run mypy
```

## リポジトリ構成

```text
packages/
  atoa-identity/          # SDK
  atoa-policy-proxy/      # FastAPI gateway
examples/
  policy.yaml
  quickstart.py
tests/
```

## 意図的にやらないこと（今は）

- 分散台帳 / 世界標準 DID メソッド登録
- トークン発行・決済・マーケットプレイス
- 複雑な鍵管理 HSM、管理画面、マルチテナント SaaS
- Docker / Kubernetes 前提の運用

まずは「ローカルで動く土管」として公開し、必要になったら厚くします。
