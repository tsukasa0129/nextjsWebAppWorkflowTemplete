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
  "vars": { "NEXT_PUBLIC_APP_URL": "https://app.example.com", "EMAIL_FROM": "サービス名 <noreply@example.com>", "SUPPORT_EMAIL": "support@example.com" },
  "env": {
    "staging": {
      "d1_databases": [{ "binding": "DB", "database_name": "{project}-db-staging", "database_id": "yyyy", "migrations_dir": "migrations" }],
      "send_email": [{ "name": "EMAIL", "allowed_destination_addresses": ["tsukasa240129@gmail.com"] }],
      "vars": { "NEXT_PUBLIC_APP_URL": "https://staging.example.com", "EMAIL_FROM": "サービス名 <noreply@example.com>", "SUPPORT_EMAIL": "support@example.com" }
    }
  }
}
```

バインディングの型は `npx wrangler types` で生成する。

### DB の変更はすべて migration SQL → Git push

D1 の変更（テーブル・カラム・インデックスの追加や変更、初期データ・マスタデータの投入、データの修正）は、すべて `migrations/` の SQL ファイルにして Git に push する。Cloudflare の管理画面（D1 の Console・テーブル編集）から直接いじらない。

1. スキーマを変えるときは Drizzle のスキーマを書き換えて SQL を生成する。データの投入・修正は `npx wrangler d1 migrations create {project}-db <名前>` で空の SQL を作って書く。

```bash
npx drizzle-kit generate
npx wrangler d1 migrations apply {project}-db --local   # ローカルで確認
```

2. ブランチにコミットして PR を作る。`staging` に push すると Workers Builds がステージングの D1 に適用し、`main` にマージすると本番の D1 に適用する（Deploy command の前に `wrangler d1 migrations apply --remote` を付けている。後述）。
3. 本番・ステージングに `--remote` で手で適用しない（初回のセットアップで Workers Builds をつなぐ前だけ例外）。

- 適用済みの SQL ファイルは書き換えない・消さない。直したいときは新しい SQL を追加する。
- 本番の D1 を直接書き換える必要が出たとき（障害対応など）も、まず SQL ファイルにして PR を通す。
- 調査のための読み取り（`SELECT`）は、MCP（`mcp__Cloudflare_Developer_Platform__d1_database_query`）や `wrangler d1 execute --command` で行ってよい。`INSERT`・`UPDATE`・`DELETE`・`CREATE`・`ALTER`・`DROP` はこれらで実行しない。
- 大きな変更の前は `npx wrangler d1 export {project}-db --remote --output backup.sql` でバックアップを取る（D1 の Time Travel でも保持期間内（Free は 7 日、Paid は 30 日）なら戻せる）。

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

## ドメインの取得と紐付け

ホストするときは、アプリ専用のドメインを取得し、Cloudflare を権威 DNS にして Worker に紐付ける。`workers.dev` のまま公開しない。**アプリの本番は `app.` のサブドメイン（`app.{app-name}.com`）でホストする。**

1. アプリ名に合ったドメインを取得する（例：`{app-name}.com`）。**Cloudflare Registrar で取得する**のを基本にする（Cloudflare が最初から権威 DNS になり、ネームサーバーの変更が要らない）。取得と支払いは**ユーザータスク**にする。
   - 他のレジストラで取得済みの場合は、Cloudflare にドメイン（ゾーン）を追加し、レジストラ側でネームサーバーを Cloudflare が指定する 2 つに変える（**ユーザータスク**）。ゾーンが **Active** になるまで待つ。
2. `dig NS {app-name}.com` で、ネームサーバーが Cloudflare（`*.ns.cloudflare.com`）になっていることを確認する。
3. 各 Worker の **Settings** → **Domains & Routes** → **Custom Domains** に割り当てる（エージェントが行う）。`wrangler.jsonc` の `routes` に書いてもよい。

| ホスト名 | Worker | 用途 |
|---|---|---|
| `app.{app-name}.com` | `{project}` | アプリの本番 |
| `staging.{app-name}.com` | `{project}-staging` | ステージング（Cloudflare Access で保護） |
| `{app-name}.com`・`www.{app-name}.com` | アプリの Worker には割り当てない | LP・紹介サイト用に空けておく。LP がない間は Redirect Rules で `app.{app-name}.com` に 302 で転送する |

```jsonc
{
  "routes": [
    { "pattern": "app.{app-name}.com", "custom_domain": true }
  ],
  "workers_dev": false,
  "env": {
    "staging": {
      "routes": [{ "pattern": "staging.{app-name}.com", "custom_domain": true }]
    }
  }
}
```

- Custom Domain を割り当てると、DNS レコードと証明書は Cloudflare が自動で作る。同じホスト名の既存レコードがあると失敗するので、先に確認する。
- `workers_dev: false` にして、公開 URL をドメインに一本化する。Workers Builds の非本番ブランチのビルドで Preview URLs を使う場合は、`"preview_urls": true` も書く（Preview URLs は Cloudflare Access で保護する）。
- メールの送信・受信は apex（`noreply@{app-name}.com`・`support@{app-name}.com`）のまま使う。アプリのホストを `app.` にしても変えない。
- `NEXT_PUBLIC_APP_URL`・Stripe の Webhook・認証のコールバック URL・メール内のリンクは、本番は `app.{app-name}.com`、ステージングは `staging.{app-name}.com` に揃える。
- 取得したドメインは `docs/env-variables/env-variables.md` と AGENTS.md に記録する。自動更新を有効にし、期限切れで止まらないようにする。

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
3. 本番の `app.example.com` と `staging.example.com` を、各 Worker の **Settings** → **Domains & Routes** の Custom Domains で割り当てる。
4. `main` と `staging` に push し、ビルドとデプロイが成功することを確認する。以後はブランチへの push（PR のマージ）でデプロイされる。

ビルドの結果とログは、各 Worker の **Deployments** / **Builds** タブで確認する。

### プレビュー URL の保護（Cloudflare Access）

`staging.example.com` などのプレビュー用の URL は Cloudflare Access で管理する（ルールは AGENTS.md の「プレビュー URL のアクセス管理」）。

1. Zero Trust が未設定なら有効にする（チーム名とプランの選択。**ユーザータスク**）。
2. `{project}-staging` の **Settings** → **Domains & Routes** → **Enable Cloudflare Access** で、Preview と Production の両方を保護する。本番の `{project}` は Preview URLs だけを保護する。
3. **Zero Trust** → **Access controls** → **Service credentials** → **Service Tokens** で `{project}-agent` を作り、Client ID と Client Secret を環境変数 `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` に入れる（Secret は作成時にしか表示されない）。
4. ステージングのポリシーに、開発者のメールアドレスの Allow と、`{project}-agent` の Service Auth を追加する。
5. Stripe の Webhook など外部から呼ばれるパス（`staging.example.com/api/webhooks/*`）に、Bypass ポリシーの Access アプリケーションを作る。
6. 確認：ヘッダーなしの `curl -I https://staging.example.com` がログイン画面にリダイレクトされ、Service Token のヘッダーを付けると 200 が返る。

```bash
curl -I https://staging.example.com \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

## 注意事項

- フレームワーク初期化時に `CLAUDE.md` や `docs/` が上書きされないようにする
- パッケージインストールでエラーが出た場合は、エラー内容をユーザーに報告し、必要なら手動対応を促す
- `wrangler` は devDependencies に入れて `npx wrangler` で使う。認証は `CLOUDFLARE_API_TOKEN` で行うため、`wrangler login` は不要
- Stripe CLI のインストール・ログインはユーザータスクとして扱う
- ドメインの取得（支払い）と、他のレジストラの場合のネームサーバー変更はユーザータスクとして扱う。Custom Domains への紐付けはエージェントが行う
