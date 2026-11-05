# AgentSecure Gateway

AIエージェントが社外のLLMや外部ツールへデータを送るとき、その経路に置く中継APIです。個人情報、機密情報、認証情報の流出リスクを大幅に低減し、送ってよい宛先と送ってはいけない内容をエージェントごとに制限します。

導入に必要なものは API キーと、この API への設定だけです。暗号や鍵管理の詳細を、利用者側で扱う必要はありません。

コード上の名前と処理の流れは [コードの読み方](docs/architecture.md) にまとめてあります。

## 導入で得られること

1. エージェントが社外のLLMやツールへ送るデータの漏洩リスクを大幅に低減する
2. 個人情報、機密情報、認証情報を自動で検知し、マスキングまたは遮断する
3. エージェントごとに、送ってよい宛先と上限を最小権限で決める
4. すべての依頼を監査ログに残し、遮断時にはアラートを送れる

この製品は「すべての漏洩を防ぐ」ものではありません。不正な送信を検知・遮断し、残ったリスクを小さくするための関門です。

## 5分で試す

Node.js 22 以上が必要です。試用モードではデータベースなしで起動でき、プロセスを止めるとデータは消えます。

```bash
cp .env.example .env
```

`.env` の `ADMIN_API_KEY` と `IP_HASH_SALT` を、それぞれ推測しにくいランダムな文字列に変えます。`STORAGE=memory` のままで構いません。

```bash
npm install
npm run dev
```

起動すると `http://localhost:3000` で受け付けます。APIの説明は `http://localhost:3000/docs` です。

### デモ

以下では、管理用の鍵を環境変数に入れた状態を想定します。

```bash
export ADMIN_API_KEY='.envに書いた値'
```

1. 会社（テナント）を作る

```bash
curl -s -X POST http://localhost:3000/v1/tenants \
  -H "content-type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"company_name":"アクロ商事","admin_email":"admin@example.com","plan":"business"}'
```

応答の `tenant_id` を控えます。

2. APIキーを発行する。平文はこの応答で一度だけ表示されます。

```bash
curl -s -X POST http://localhost:3000/v1/api-keys \
  -H "content-type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"tenant_id":"控えたtenant_id","name":"trial"}'
```

3. 送ってよい宛先を決める

```bash
curl -s -X POST http://localhost:3000/v1/policies \
  -H "content-type: application/json" \
  -H "x-api-key: 発行されたAPIキー" \
  -d '{"policy_name":"default-egress","allowed_domains":["example.com"],"rate_limit":60}'
```

4. メールアドレスを含む依頼は、マスキングしてから転送します。

```bash
curl -s -X POST http://localhost:3000/v1/gateway/proxy \
  -H "content-type: application/json" \
  -H "x-api-key: 発行されたAPIキー" \
  -d '{"agent_id":"sales-bot","destination":"https://example.com/","method":"POST","body":{"prompt":"連絡先は taro@example.com です"}}'
```

`taro@example.com` は `ta***@example.com` になってから上流へ送られます。応答の `modifications` に種別と件数が入ります。実際のLLMへつなぐときは、`allowed_domains` と `destination` をそのAPIのホストに変えます。

5. トークンや秘密鍵を含む依頼は遮断されます。HTTPステータスは 403 です。

```bash
curl -s -X POST http://localhost:3000/v1/gateway/proxy \
  -H "content-type: application/json" \
  -H "x-api-key: 発行されたAPIキー" \
  -d '{"agent_id":"sales-bot","destination":"https://example.com/","body":{"prompt":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature12"}}'
```

6. 監査ログを見る。本文や認証情報そのものは保存されません。

```bash
curl -s "http://localhost:3000/v1/audit-logs?action=block" \
  -H "x-api-key: 発行されたAPIキー"
```

許可リストにない宛先、内部アドレス、大きすぎる依頼も遮断されます。

## 本番に近い起動

データを残す場合は PostgreSQL と Redis を使います。

```bash
docker compose up -d
```

`.env` を次の方針で編集します。

- `STORAGE=prisma`
- `DATABASE_URL` は compose の初期値か、自社のPostgreSQL
- `REDIS_URL` を設定する
- `ADMIN_API_KEY` と `IP_HASH_SALT` を本番用のランダム値にする

```bash
npm run db:deploy
npm run dev
```

遮断を社内の受付先へ通知する場合は `ALERT_WEBHOOK_URL` を設定します。通知には依頼ID、宛先のドメイン、検知した種別だけが含まれ、本文は含まれません。

## 利用者向けAPI

| 操作 | メソッド | 認証 |
| --- | --- | --- |
| テナント作成 | `POST /v1/tenants` | 管理キー `X-Admin-Key` |
| APIキー発行 | `POST /v1/api-keys` | 管理キー、または既存のAPIキー |
| ポリシー作成 | `POST /v1/policies` | APIキー `X-Api-Key` |
| 中継 | `POST /v1/gateway/proxy` | APIキー |
| 監査ログ | `GET /v1/audit-logs` | APIキー |

機械可読な定義は `GET /openapi.json`（OpenAPI 3.1）です。ブラウザで読む場合は `/docs` を開きます。

ポリシーで指定できる主な項目は、名前、許可ドメイン、禁止キーワード、マスキング規則、最大バイト数、レート上限、対象エージェントです。`agent_id` を省略したポリシーは、その会社の共通ルールになります。

初期の検知はルールベースです。

| 内容 | 初期動作 |
| --- | --- |
| メールアドレス、電話番号、住所 | マスクして転送 |
| クレジットカード、秘密鍵、JWT、APIキー、個人番号 | 遮断 |
| ポリシーの追加キーワードと正規表現 | ルールの指定に従う |

上流APIへの `Authorization` ヘッダは、許可した宛先への接続情報として転送します。プロンプト本文に紛れたトークンは遮断対象です。監査ログにはヘッダの値を書きません。

遮断時の理由コードの例: `SENSITIVE_DATA_DETECTED`、`DOMAIN_NOT_ALLOWED`、`DESTINATION_BLOCKED`、`REQUEST_TOO_LARGE`、`RATE_LIMIT_EXCEEDED`、`POLICY_NOT_FOUND`。

## 開発

```bash
npm test
npm run build
npm run openapi
```

テストは外部のデータベースなしで実行できます。`npm run build` は TypeScript の型チェックとクライアント生成を行います。

## 現時点の制限

- 検知はルールベースであり、文脈を理解する検査ではない
- 名前だけの個人名や、規則に合わない秘密は見逃すことがある
- 試用モードの保存、レート制限、再送防止はプロセス内だけであり、複数台構成では使えない
- 署名に使う鍵の保管は、まだ外部の鍵管理サービスに接続していない
- 宛先の名前解決後に内部アドレスへ変わるケースは、次の対策項目である
- APIキーの失効と、ポリシーの更新・削除APIはまだない
- 管理用の画面はまだなく、設定はAPIで行う

## Internal Architecture

この節だけが、内部の主体識別と署名の説明です。顧客向けの画面、API、OpenAPIには出しません。

各テナントと各エージェントには、初回の中継時に Ed25519 鍵と `did:key` 主体を自動で作ります。秘密鍵は現在データベースへ平文で保存します。本番前に KMS で包む必要があります（`TODO(security)`）。

ゲートウェイは上流へ転送する直前に、次のクレームを持つコンパクトな署名を作り、`X-AgentSecure-Context` ヘッダに載せます。

- `tenant_id`
- `agent_id`
- `policy_id`
- `request_id`
- `issued_at`
- `expires_at`
- `allowed_scope`

有効期限は最大5分です。`request_id` は Redis（未設定時はプロセス内）に同じ期間だけ記録し、検証時に一度だけ消費します。二度目はリプレイとして拒否します。ブロックチェーンは使いません。

検証の入口は `createInternalIdentity()` が返す `issueGatewayProof()` と `verifyGatewayProof()` だけです。顧客レスポンスには署名も主体識別子も返しません。上流が署名をエコーした場合も、応答を返す前に取り除きます。
