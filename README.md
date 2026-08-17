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

## 環境構築

このリポジトリを初めて触る人向けに、環境構築の手順を最初から順番に説明します。上から順に実行すれば動く状態になるはずです。詰まったら「トラブルシューティング」も確認してください。

### クイックスタート（Git・Node.js・npmが揃っている人向け）

すでに Git と、このプロジェクトが指定するバージョンの Node.js / npm が使える環境なら、以下だけで開発を始められます。

```bash
git clone <このリポジトリのURL>
cd kyunpass
npm install
npm run dev
```

初めて環境構築する人や、上記でエラーが出た人は、以降の手順0〜5を順番に進めてください。

### 0. 必要なものが揃っているか確認する

まずはターミナルで以下のコマンドを実行し、必要なツールが既にインストール済みかどうかを確認してください。**バージョンが正しく表示されるものは、対応するインストール作業（手順1・2）を飛ばして問題ありません。**

```bash
git --version   # Gitのバージョンが表示されればOK
node -v         # Node.jsのバージョンが表示されればOK（.nvmrcの値と一致しているか後述の手順2で確認）
npm -v          # npmのバージョンが表示されればOK
```

- コマンドが見つからない（`command not found` 等のエラーになる）場合は、そのツールが未インストールです。以下を参考にインストールしてください。
- コマンドがすでに実行できる場合でも、Node.js だけは **バージョンがこのプロジェクトの指定（`.nvmrc` に記載、現在は `20`）と一致しているか** を手順2で必ず確認してください。バージョンが違うだけで動くこともありますが、ズレていると原因の分かりにくいエラーにつながることがあります。

以下、各ツールの役割です。

- **Git**: リポジトリを取得するために使います。未インストールの場合は [Git公式サイト](https://git-scm.com/) の手順に従ってインストールしてください。
- **Node.js / npm**: このプロジェクトは Next.js（React ベースのフレームワーク）で作られており、実行には Node.js が必要です。npm は Node.js に同梱されるパッケージ管理ツールです。インストール方法は手順2を参照してください。
- **エディタ**: vscodeかcursorをつかってくれたらうれしいです。

### 1. リポジトリをクローンする

```bash
git clone <このリポジトリのURL>
cd kyunpass
```

`<このリポジトリのURL>` は GitHub の「Code」ボタンから確認できます。

### 2. Node.js のバージョンを合わせる

このプロジェクトが要求する Node.js のバージョンは、リポジトリ直下の `.nvmrc` ファイルに書かれています（現在は `20`）。バージョンが異なると `npm install` やビルドで予期しないエラーが出ることがあるため、必ず揃えてください。

Node.js のバージョンを複数切り替えて使えるツール **nvm（Node Version Manager）** の利用を強く推奨します。

#### nvm がインストール済みか確認する

```bash
nvm --version
```

バージョンが表示されればインストール済みなので、下の「nvm のインストール」は飛ばして「プロジェクトが指定する Node.js バージョンを使う」に進んでください。`command not found` と表示された場合は未インストールです。

#### nvm のインストール（未導入の場合）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

インストール後、ターミナルを再起動するか、以下を実行して nvm を読み込みます。

```bash
source ~/.zshrc   # bashの場合は ~/.bashrc
```

`nvm --version` を実行してバージョンが表示されれば成功です。

#### プロジェクトが指定する Node.js バージョンを使う

リポジトリのルートディレクトリ（`.nvmrc` があるディレクトリ）で以下を実行します。

```bash
nvm install   # .nvmrc に書かれたバージョンをインストール
nvm use       # .nvmrc に書かれたバージョンに切り替え
```

`node -v` を実行し、`.nvmrc` と同じバージョン（例: `v20.x.x`）が表示されていればOKです。

> 補足: nvm を使わず、[Node.js公式サイト](https://nodejs.org/)から `.nvmrc` に記載のバージョンを直接インストールしても構いません。ただし複数プロジェクトを触る場合はバージョン管理が煩雑になるため nvm を推奨します。

### 3. 依存パッケージをインストールする

**リポジトリのルートディレクトリ**（`front/` の中ではなく、`package.json` がある一番上の階層）で以下を実行します。

```bash
npm install
```

このコマンドは `package-lock.json` の内容に従って、プロジェクトが必要とするライブラリ（Next.js, React, ESLint など）を `node_modules/` にダウンロードします。少し時間がかかりますが、エラーが出なければ完了です。

> 補足: このリポジトリは npm ワークスペース構成ではありませんが、`package.json` の `dev` / `build` / `start` スクリプトが内部で `front/` ディレクトリを対象にするようになっているため、`npm install` や `npm run dev` は必ずリポジトリのルートで実行してください（`front/` の中に移動して実行する必要はありません）。

### 4. 開発サーバーを起動する

```bash
npm run dev
```

ターミナルに `Local: http://localhost:3000` のような表示が出たら起動成功です。ブラウザで [http://localhost:3000](http://localhost:3000) を開くと画面が確認できます。

停止するときはターミナルで `Ctrl + C` を押してください。

### 5. 動作確認（任意だが推奨）

環境構築が正しくできているか、以下のコマンドで確認できます。エラーが出なければ問題ありません。

```bash
npm run lint          # ESLintによる静的解析
npm run format:check  # Prettierによるフォーマットチェック
npm test               # Vitest + Testing Libraryによるユニットテスト
```

### 主要コマンド一覧

すべてリポジトリのルートディレクトリで実行してください。

| コマンド               | 説明                                                      |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | 開発サーバーを起動（ホットリロードあり）                  |
| `npm run build`        | 本番用にビルド                                            |
| `npm run start`        | ビルド済みアプリを起動（事前に `npm run build` が必要）   |
| `npm run lint`         | ESLint で静的解析                                         |
| `npm run format`       | Prettier でコードを自動整形                               |
| `npm run format:check` | Prettier のフォーマット崩れをチェック（自動修正はしない） |
| `npm test`             | Vitest + Testing Library でユニットテストを実行           |

これらのコマンドは CI（`.github/workflows/ci.yml`）でも実行されるため、PRを出す前にローカルで通しておくと手戻りが少なくなります。

### トラブルシューティング

- **`npm install` でエラーが出る / 依存関係の警告が大量に出る**
  - `node -v` で Node.js のバージョンが `.nvmrc` の内容と一致しているか確認してください。一致していない場合は `nvm use` を再実行してください。
  - それでも直らない場合は、`node_modules` と `package-lock.json` に紐づくキャッシュが壊れている可能性があります。以下を試してください（`package-lock.json` 自体は削除しないでください。誤ったバージョンで再生成されると他の人の環境と差異が出ます）。
    ```bash
    rm -rf node_modules
    npm install
    ```
- **`command not found: npm` や `command not found: node`**
  - Node.js がインストールされていないか、PATHが通っていません。手順2の nvm セットアップからやり直してください。
- **`npm run dev` 実行時に `Error: listen EADDRINUSE: address already in use :::3000`**
  - すでに3000番ポートで別のプロセスが起動しています。他のターミナルで動いている `npm run dev` を停止するか、以下でポートを使っているプロセスを終了してください。
    ```bash
    lsof -i :3000
    kill -9 <上記コマンドで表示されたPID>
    ```
- **CIは通るのにローカルでは `npm run lint` や `npm run format:check` が失敗する**
  - CIでは npm のバージョンを `11.4.2` に固定しています（`.github/workflows/ci.yml` 参照）。ローカルの npm バージョンが大きく異なる場合は `npm install -g npm@11.4.2` で揃えると差異が出にくくなります。
- **Gitの操作やPR作成でつまずいた場合**
  - このリポジトリでは PR作成を支援する仕組み（`create-pr` フロー）が用意されています。詳細は `.agents/skills/create-pr/SKILL.md` を参照してください。

### 主要コマンド

- `npm run dev` / `npm run build` / `npm run start`: Next.js の開発・ビルド・起動
- `npm run lint`: ESLint
- `npm run format` / `npm run format:check`: Prettier
- `npm test`: Vitest + Testing Library
