# kyunpass

MVP機能

- 対象: 仲良くなった人・恋愛感情を抱いている人・自分に接近してきている人との会話
- 測定対象: 相手の反応を会話特徴探索モデルで分析
- 入力: テキストデータ
- 処理: 独自学習したテキスト分類モデルでキュン度を判定
- 出力: キュン度スコア

## フロントエンド構成 App Router 3層

Next.js プロジェクト本体は `front/` 配下に置く。

- `front/src/app/**/page.tsx`: ルーティング専用。対応する Feature コンポーネントをそのまま返す。
- `front/src/features/**`: 画面単位のルートコンポーネント（`XxxFeature.tsx`）。状態管理やユースケース制御を担い、`components` を組み合わせて UI を構成する。
- `front/src/components/**`: 再利用可能な純粋 UI 部品。ビジネスフローの起点にはならず、`features` からのみ利用する（`components` → `features` の逆依存は禁止。ESLint で強制）。

新規ページを作る場合は `front/src/features/<page>/XxxFeature.tsx` を追加し、`front/src/app/**/page.tsx` で委譲する。UI 部品は `front/src/components/` に配置する。

### セットアップ

```bash
npm install
npm run dev
```

### 主要コマンド

- `npm run dev` / `npm run build` / `npm run start`: Next.js の開発・ビルド・起動
- `npm run lint`: ESLint
- `npm run format` / `npm run format:check`: Prettier
- `npm test`: Vitest + Testing Library
