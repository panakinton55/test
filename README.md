# agent-secure-gateway

AIエージェントと外部ツールの間で、DID署名、知識証明トークン、ペイロードのガードレール、暗号化コンテキスト、ハッシュチェーン監査を行うゲートウェイです。

## 起動

```bash
npm install
npm test
npm run dev
```

コンソールは `http://127.0.0.1:8787/` です。署名済みリクエストの例は `npm run demo` で出力します。

説明資料は `docs/agent-gateway-business.pptx` と `docs/agent-gateway-business.pdf` です。

## `POST /api/gateway/dispatch`

ボディは次のJSONだけを受け付けます。

```json
{
  "requestId": "uuid",
  "destination": "llm.completions | search.query | tools.invoke",
  "prompt": "string",
  "parameters": {},
  "metadata": { "traceId": "optional", "agentVersion": "optional" }
}
```

ヘッダー:

- `x-did`: `did:key`（Ed25519）
- `x-did-signature`: 正規化リクエストに対する detached JWS（`EdDSA`）
- `x-zkp-token`: スコープを開示し、隠した属性はコミットメントのままにする Schnorr 知識証明
- `x-nonce`: UUID
- `x-timestamp`: UNIX秒。許容ずれは60秒

宛先URLはリクエストでは指定できません。通過した要求だけが、AES-256-GCMで封じたコンテキストを付けて許可済みの宛先へ転送されます。`UPSTREAM_LLM_URL`、`UPSTREAM_SEARCH_URL`、`UPSTREAM_TOOLS_URL` が未設定のときはプロセス内のモックが応答します。デモ用の署名エンドポイントは `GATEWAY_DEMO=0` で無効にできます。

監査はプロンプト本文を残さず、各レコードが直前のハッシュを含むJSONとして出力されます。
