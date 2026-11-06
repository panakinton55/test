# wafops

顧客名義の Cloudflare（Pro 以上）へ、サイト種別ごとの WAF を入れて、誤検知はルール 1 件だけ外し、月次報告書を出すためのツールです。API トークンは環境変数 `CLOUDFLARE_API_TOKEN` から読みます。

ゾーンの利用料は顧客のアカウントに残します。このツールが持つルールの `ref` は `wafops/` で始まります。それ以外のルールは、id を指定してそのまま残します。

## テンプレ

| キー | 対象 |
| --- | --- |
| `corporate` | 問い合わせとログインがある会社サイト |
| `wordpress` | WordPress。xmlrpc、ユーザー列挙、ログイン試行を止める |
| `ecommerce` | ログインと決済があるストア |

Pro の枠に合わせ、カスタムルールは 5 件以内、レート制限は 2 件です。レート制限は 60 秒・IP 単位で、式にメソッドを入れません。

`mode` は `block` または `challenge` です。`challenge` にしてもレート制限は `block` のままです。

## 例外の範囲

例外は Cloudflare Managed Ruleset（`efb7b8c949ac4650a09736fc376e9aee`）のルール 1 件を、メソッドとパスを両方指定して 30 日だけ外します。マネージドフェーズはカスタムルールとレート制限の後で動くので、機密パスの遮断とレート制限はそのまま残ります。

`/.env` や `/xmlrpc.php` のような遮断パスは、件数にかかわらず例外候補になりません。承認済みの例外は、`propose` をやり直しても期限が延びません。

AWS WAFv2 は同じテンプレの JSON を出します。パス単位でルール 1 件だけを外すことができないため、例外の自動適用は Cloudflare で行います。

## 使い方

```bash
python3 -m wafops templates
python3 -m wafops plan --site examples/shop.json --current examples/empty.json
python3 -m wafops exceptions propose \
  --site examples/shop.json \
  --events examples/events.json \
  --today 2026-10-20
python3 -m wafops exceptions approve \
  --site examples/shop.json \
  --id exc-48202f2069db \
  --today 2026-10-20
python3 -m wafops report \
  --site examples/shop.json \
  --month 2026-10 \
  --events examples/events.json \
  --logs examples/logs.jsonl \
  --today 2026-10-20
```

ゾーンへ書くのは次だけです。

```bash
export CLOUDFLARE_API_TOKEN=...
python3 -m wafops apply --site path/to/site.json --yes
```

`--yes` が無い `apply` はゾーンを変更しません。状態は `.wafops/state.db` に保存します。

### サイト定義

```json
{
  "name": "example-shop",
  "provider": "cloudflare",
  "zone_id": "32文字のゾーンID",
  "template": "wordpress",
  "mode": "block",
  "plan": "pro",
  "known_paths": ["/wp-admin/admin-ajax.php"]
}
```

`known_paths` は、テンプレの通常操作パスに加えて例外候補にしてよいパスです。遮断対象のパスは指定できません。

### イベント

```json
{
  "rule_id": "マネージドルールのID",
  "ruleset_id": "efb7b8c949ac4650a09736fc376e9aee",
  "method": "POST",
  "path": "/wp-admin/admin-ajax.php",
  "action": "block",
  "count": 18,
  "date": "2026-10-12"
}
```

`ruleset_id` が Cloudflare Managed Ruleset のときだけ候補になります。同じパスで 5 件以上（`false_positive_threshold` で変更）ブロックされていることが条件です。

### ブロックログの分析

`examples/block-log.json` は、WAF が残す判定です。リクエストの中身は入れず、どの制御が何件止めたかだけを記録します。

```bash
python3 -m wafops analyze \
  --site examples/shop.json \
  --events examples/block-log.json \
  --today 2026-10-20
```

判定は3種類です。

- 遮断を維持: テンプレの固定ルール（機密パス、ユーザー列挙、ログインと決済のレート制限）
- 例外候補: 通常操作のパスで、マネージドルール1件が閾値以上ブロックしている
- 様子を見る: 件数が閾値未満、または通常操作パスではないマネージドルール

### ログ

`logging check` は、リクエストボディと Cookie を保存せず、`authorization` と `cookie` をマスクしているかを見ます。`logs scan` はサンプルからカード番号の形（Luhn）を探し、末尾 4 桁だけを表示します。`examples/logs.jsonl` の番号は決済テスト用のものです。

### AWS

```bash
python3 -m wafops aws-json --site path/to/aws-site.json --current web-acl.json --out update.json
```

`web-acl.json` は `aws wafv2 get-web-acl` の結果です。出力は `update-web-acl` に渡す文書で、顧客ルールと `LockToken` を維持します。

## テスト

```bash
python3 -m unittest discover -s tests
```
