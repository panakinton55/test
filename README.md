# AI Research Studio

市場・企業・テクノロジーを調査し、意思決定を支援する独立系リサーチスタジオの公式サイトです。

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Lucide Icons

## Develop

```bash
npm install
npm run dev
```

開発サーバーは [http://localhost:3000](http://localhost:3000) で開きます。

```bash
npm run lint
npm run build
```

## Content

レポートは `src/data/reports.ts`、サービスは `src/data/services.ts` に追加します。購入ボタンは問い合わせフォームへの仮リンクです。決済とフォーム送信は未接続です。

公開時の正規URLは `NEXT_PUBLIC_SITE_URL` に設定します。未設定のときは `http://localhost:3000` を使います。
