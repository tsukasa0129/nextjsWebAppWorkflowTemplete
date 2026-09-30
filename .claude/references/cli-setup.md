# CLIセットアップ手順

CLI セットアップは、ドキュメント生成後にユーザーの承認を得てから実行する。

## 事前確認

コマンド実行前に必ず Node.js 環境を確認する。

```bash
which node
node -v
npm -v
```

## フレームワーク初期化

技術スタックに応じた CLI コマンドを実行する。

### Next.js の場合

Cloudflare Workers 向けのテンプレートで初期化する（OpenNext アダプター・`wrangler.jsonc` が入った状態で生成される）。

```bash
npm create cloudflare@latest . -- --framework=next --platform=workers
```

既存の Next.js プロジェクトに後から入れる場合は `npx @opennextjs/cloudflare migrate` を使う。

### Nuxt の場合

```bash
npx nuxi@latest init . --force
```

プロジェクトルートが空でない場合は、既存ファイル（`CLAUDE.md`、`AGENTS.md`、`docs/`）を退避し、初期化後に復元する。

## 依存パッケージインストール

提案した技術スタックに必要なパッケージをインストールする。

### Cloudflare（D1・認証・メール）

```bash
npm install drizzle-orm better-auth @react-email/components @react-email/render
npm install -D drizzle-kit wrangler
```

### Stripe

決済ありの場合のみ実行する。

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

### その他

提案に含まれる主要ライブラリを必要に応じてインストールする。

```bash
npm install {提案で選定したライブラリ}
```

## Cloudflare リソースのセットアップ

`CLOUDFLARE_API_TOKEN` が設定済みなので、エージェントが直接実行する。

```bash
npx wrangler whoami
# D1（本番・ステージング）
npx wrangler d1 create {project}-db
npx wrangler d1 create {project}-db-staging
# R2（ファイル保存が必要な場合のみ）
npx wrangler r2 bucket create {project}-files
```

出力された `database_id` を `wrangler.jsonc` の `d1_databases` に書く。ステージングは `env.staging` に分けて定義する。

```jsonc
{
  "name": "{project}",
  "main": ".open-next/worker.js",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "{project}-db", "database_id": "xxxx", "migrations_dir": "migrations" }],
  "send_email": [{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@example.com", "support@example.com"] }],
  "vars": { "NEXT_PUBLIC_APP_URL": "https://example.com", "EMAIL_FROM": "サービス名 <noreply@example.com>", "SUPPORT_EMAIL": "support@example.com" },
  "env": {
    "staging": {
      "d1_databases": [{ "binding": "DB", "database_name": "{project}-db-staging", "database_id": "yyyy", "migrations_dir": "migrations" }],
      "send_email": [{ "name": "EMAIL", "allowed_destination_addresses": ["tukasa0129atmyhome@gmail.com"] }],
      "vars": { "NEXT_PUBLIC_APP_URL": "https://staging.example.com", "EMAIL_FROM": "サービス名 <noreply@example.com>", "SUPPORT_EMAIL": "support@example.com" }
    }
  }
}
```

バインディングの型は `npx wrangler types` で生成する。

マイグレーションは Drizzle で SQL を生成し、wrangler で適用する。

```bash
npx drizzle-kit generate
npx wrangler d1 migrations apply {project}-db --local
npx wrangler d1 migrations apply {project}-db --remote
npx wrangler d1 migrations apply {project}-db-staging --remote --env staging
```

メールの送信・受信の設定は `.claude/references/mail.md` に従う。

## 環境変数ファイル作成

ローカル開発用の秘密値は `.dev.vars` にプレースホルダー値で生成する（本番・ステージングは `wrangler secret put` で登録する）。公開してよい値は `wrangler.jsonc` の `vars` に書く。

```bash
# === 認証 ===
BETTER_AUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# === Stripe（決済ありの場合） ===
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

その他、提案内容に応じて必要なキーを追加する。

## .gitignore 確認・補完

以下がなければ追記する。

- `.env.local`
- `.env*.local`
- `.dev.vars*`
- `.wrangler/`
- `.open-next/`

## Git初期化

Git が未初期化の場合のみ実行する。

```bash
git init
git add .
git commit -m "Initial project scaffold"
```

## デプロイ（Workers Builds）

Web アプリのデプロイは、Cloudflare 側の GitHub 連携（Workers Builds）で行う。GitHub Actions やローカルからの `deploy` コマンドでは本番に出さない。

### 構成

| Worker | 接続するブランチ | Build command | Deploy command |
|---|---|---|---|
| `{project}`（本番） | `main` | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy` |
| `{project}-staging`（ステージング） | `staging` | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy -- --env staging` |

- **Root directory** は `app`（`wrangler.jsonc` がある場所）にする。
- Worker の名前は `wrangler.jsonc` の `name`（ステージングは `{name}-staging`）と一致させる。一致しないとビルドが失敗する。
- 本番 Worker の **non-production branch builds** は有効にしてよいが、その場合のコマンドは `npx opennextjs-cloudflare upload`（バージョンのアップロードのみ。本番には出ない）にする。`deploy` にしない。
- ビルド時に必要な環境変数（`NEXT_PUBLIC_*` など）は、各 Worker の **Settings** → **Builds** → **Variables and secrets** にも登録する。実行時の値は `wrangler.jsonc` の `vars` と `wrangler secret put` で持つ。
- マイグレーションは Deploy command の前に `npx wrangler d1 migrations apply {project}-db --remote &&` を付けて自動で適用する（ステージングは `{project}-db-staging --remote --env staging`）。

### 接続手順

1. 初回だけ、Worker を作るために一度デプロイする（エージェントが実行する）。

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
npx opennextjs-cloudflare deploy -- --env staging
```

2. Cloudflare ダッシュボード → **Workers & Pages** → 各 Worker → **Settings** → **Builds** → **Connect** で GitHub リポジトリを接続し、上の表の設定を入れる。Cloudflare の GitHub App をリポジトリにインストールする操作は**ユーザータスク**にする。
3. 本番ドメインと `staging.example.com` を、各 Worker の **Settings** → **Domains & Routes** の Custom Domains で割り当てる。
4. `main` と `staging` に push し、ビルドとデプロイが成功することを確認する。以後はブランチへの push（PR のマージ）でデプロイされる。

ビルドの結果とログは、各 Worker の **Deployments** / **Builds** タブで確認する。

## 注意事項

- フレームワーク初期化時に `CLAUDE.md` や `docs/` が上書きされないようにする
- パッケージインストールでエラーが出た場合は、エラー内容をユーザーに報告し、必要なら手動対応を促す
- `wrangler` は devDependencies に入れて `npx wrangler` で使う。認証は `CLOUDFLARE_API_TOKEN` で行うため、`wrangler login` は不要
- Stripe CLI のインストール・ログインはユーザータスクとして扱う
- ドメインのネームサーバーを Cloudflare に向ける作業はユーザータスクとして扱う
