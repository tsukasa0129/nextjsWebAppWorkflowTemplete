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

Cloudflare アカウントは **Workers Paid プラン（月 $5〜）に加入済み**。Free プランの上限（Workers の CPU 時間・リクエスト数、D1 の容量など）を前提にした回避策は取らず、Paid プランの上限で設計する。プランの加入・変更をユーザータスクにしない。

Cloudflare の操作は MCP サーバー **dev-mcp**（`mcp__dev-mcp__cf_*`）からエージェントが直接行う。ダッシュボードでの手作業や `curl` は使わない。dev-mcp にない操作（R2 の作成、ビルド、ローカル開発）だけ `wrangler` CLI を使う。

| 作るもの | dev-mcp のツール |
|---|---|
| トークンの確認 | `cf_verify_token` / `cf_list_accounts` |
| D1（本番 `{project}-db`・ステージング `{project}-db-staging`） | `cf_d1_create_database` |
| R2（ファイル保存が必要な場合のみ） | `npx wrangler r2 bucket create {project}-files` |

作成した D1 の `database_id` を `wrangler.jsonc` の `d1_databases` に書く。ステージングは `env.staging` に分けて定義する。

```jsonc
{
  "name": "{project}",
  "main": ".open-next/worker.js",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "{project}-db", "database_id": "xxxx", "migrations_dir": "migrations" }],
  "send_email": [{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@example.com", "support@example.com"] }],
  "ai": { "binding": "AI" },
  "vars": { "NEXT_PUBLIC_APP_URL": "https://app.example.com", "EMAIL_FROM": "サービス名 <noreply@example.com>", "SUPPORT_EMAIL": "support@example.com" },
  "env": {
    "staging": {
      "d1_databases": [{ "binding": "DB", "database_name": "{project}-db-staging", "database_id": "yyyy", "migrations_dir": "migrations" }],
      "send_email": [{ "name": "EMAIL", "allowed_destination_addresses": ["tsukasa240129@gmail.com"] }],
      "ai": { "binding": "AI" },
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
- 調査のための読み取り（`SELECT`）は、dev-mcp の `cf_d1_query` で行ってよい。適用済みのマイグレーションは `cf_d1_migrations_list` で確認する。`INSERT`・`UPDATE`・`DELETE`・`CREATE`・`ALTER`・`DROP` はこれらで実行しない。
- 大きな変更の前は `npx wrangler d1 export {project}-db --remote --output backup.sql` でバックアップを取る（Workers Paid プランなので、D1 の Time Travel でも 30 日以内なら戻せる）。

メールの送信・受信の設定は `.claude/references/mail.md` に従う。

### LLM の組み込み（Workers AI）

アプリに LLM を組み込むときは、Web アプリなら Cloudflare Workers AI のモデルを使う。`ai` バインディングで呼ぶので API キーは不要。OpenAI などの外部 API は、ユーザーが明示した場合を除き使わない。

モデルは基本的に **DeepSeek** を使う（Workers AI 上のモデルなので DeepSeek の API キーは不要。Workers Paid プランで利用できる）。

| 用途 | モデル ID | 料金（100 万トークンあたり） |
|---|---|---|
| 標準（ほとんどの処理） | `@cf/deepseek-ai/deepseek-v4-flash-0731` | 入力 $0.44 / 出力 $1.32 |
| 高い精度が必要な処理（複雑な推論・複数ステップの処理） | `@cf/deepseek-ai/deepseek-v4-pro-0813` | 入力 $1.32 / 出力 $3.96 |

- どちらもコンテキストは約 100 万トークンで、関数呼び出しと推論（`reasoning`）に対応している。
- まず V4 Flash で作り、精度が足りない処理だけ V4 Pro に切り替える。
- 画像の入力など DeepSeek でできない処理だけ、他の Workers AI のモデルを使う（理由を設計書に残す）。
- モデルの新しい版が出ていないか、実装時に Workers AI のモデル一覧で確認する。

`ai` バインディングは `env` に引き継がれないため、`env.staging` にも書く（上の `wrangler.jsonc` の例を参照）。1 つの Worker に 1 つだけ定義できる。

```bash
npm install ai workers-ai-provider   # AI SDK を使う場合
```

```ts
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

// モデル ID はこの 1 か所で管理する（基本は DeepSeek）
export const LLM_MODEL = "@cf/deepseek-ai/deepseek-v4-flash-0731";     // 標準
export const LLM_MODEL_PRO = "@cf/deepseek-ai/deepseek-v4-pro-0813";   // 高い精度が必要な処理

export async function generate(prompt: string) {
  const { env } = getCloudflareContext();
  const workersai = createWorkersAI({ binding: env.AI });
  const { text } = await generateText({ model: workersai(LLM_MODEL), prompt });
  return text;
}
// AI SDK を使わない場合は env.AI.run(LLM_MODEL, { messages: [...] }) で呼ぶ
```

- 呼び出しはサーバー側（Route Handler・Server Action）だけで行う。クライアントからモデルを直接呼ばない。
- ユーザー単位の回数制限を入れる（Workers の Rate Limiting バインディングか D1 のカウンター）。
- ログ・キャッシュ・利用量の確認が必要なら AI Gateway を経由させる（`env.AI.run(model, input, { gateway: { id: "<gateway-id>" } })`）。
- `wrangler dev` でも実際の Workers AI を呼ぶため、ローカル開発でも料金がかかる。

## 環境変数ファイル作成

ローカル開発用の秘密値は `.dev.vars` にプレースホルダー値で生成する（本番・ステージングは dev-mcp の `cf_worker_put_secret` で登録する）。公開してよい値は `wrangler.jsonc` の `vars` に書く。

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

1. アプリ名に合ったドメインを取得する（例：`{app-name}.com`）。**Cloudflare Registrar で取得する**のを基本にする（Cloudflare が最初から権威 DNS になり、ネームサーバーの変更が要らない）。dev-mcp の `cf_domain_search` → `cf_domain_quote` で候補と価格を出し、**ユーザーに価格を見せて明示的な承認を得てから** `cf_domain_register` で取得する（課金され、返金できない）。状態は `cf_domain_registration_status` で確認する。
   - 他のレジストラで取得済みの場合は、Cloudflare にドメイン（ゾーン）を追加し、レジストラ側でネームサーバーを Cloudflare が指定する 2 つに変える（**ユーザータスク**）。ゾーンが **Active** になるまで待つ。
2. dev-mcp の `cf_get_zone` でゾーンが Active か、`dig NS {app-name}.com` でネームサーバーが Cloudflare（`*.ns.cloudflare.com`）になっていることを確認する。DNS レコードは `cf_list_dns_records` で確認する。
3. 各 Worker の Custom Domains に割り当てる（エージェントが行う）。`wrangler.jsonc` の `routes` に書き、デプロイ時に割り当てる。割り当て結果は dev-mcp の `cf_worker_list_domains` で確認する。

| ホスト名 | Worker | 用途 |
|---|---|---|
| `app.{app-name}.com` | `{project}` | アプリの本番 |
| `staging.{app-name}.com` | `{project}-staging` | ステージング（Cloudflare Access で保護） |
| `{app-name}.com`・`www.{app-name}.com` | **触らない** | SEO 用のサイトで使う。アプリの Worker を割り当てず、リダイレクトも設定しない |

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
- トップドメイン（apex の `{app-name}.com` と `www.{app-name}.com`）は SEO 用のサイトで使うため、アプリの作業では触らない（Worker の割り当て・リダイレクト・A / AAAA / CNAME レコードの追加や変更をしない）。メール用の MX・TXT（SPF・DKIM・DMARC）レコードの追加だけは行ってよい。
- メールの送信・受信は apex（`noreply@{app-name}.com`・`support@{app-name}.com`）のまま使う。アプリのホストを `app.` にしても変えない。
- `NEXT_PUBLIC_APP_URL`・Stripe の Webhook・認証のコールバック URL・メール内のリンクは、本番は `app.{app-name}.com`、ステージングは `staging.{app-name}.com` に揃える。
- 取得したドメインは `docs/env-variables/env-variables.md` と AGENTS.md に記録する。自動更新を有効にし、期限切れで止まらないようにする。

## デプロイ（Workers Builds）

Web アプリのデプロイは、Cloudflare 側の GitHub 連携（Workers Builds）で行う。リポジトリの接続は Cloudflare の Builds API で行う。GitHub Actions やローカルからの `deploy` コマンドでは本番に出さない。

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

2. Cloudflare の Builds API でリポジトリを Workers Builds に接続する（エージェントが dev-mcp の `cf_builds_*` で実行する。ダッシュボードの **Connect** は使わない）。手順は下の「Builds API での接続（dev-mcp）」。
   - 前提：Cloudflare の GitHub App が GitHub アカウントにインストールされ、対象リポジトリへのアクセスが許可されていること。これだけは**ユーザータスク**にする（アカウントごとに初回 1 回だけ）。
3. 本番の `app.example.com` と `staging.example.com` を、各 Worker の Custom Domains に割り当てる（`wrangler.jsonc` の `routes` でデプロイ時に割り当てる。確認は dev-mcp の `cf_worker_list_domains`）。
4. `main` と `staging` に push し、ビルドとデプロイが成功することを確認する。以後はブランチへの push（PR のマージ）でデプロイされる。

ビルドの結果とログは、dev-mcp の `cf_builds_list_builds` / `cf_builds_get_build` で確認する。

### Builds API での接続（dev-mcp）

Workers Builds の Builds API は、dev-mcp の `mcp__dev-mcp__cf_builds_*` から呼ぶ（`curl` は使わない）。アカウント ID はトークンから自動で決まり、Worker は名前でも tag でも渡せる。

| 手順 | 内容 | dev-mcp のツール |
|---|---|---|
| 1 | GitHub のアカウント ID とリポジトリ ID を取得 | GitHub API（`/users/{owner}`・`/repos/{owner}/{repo}` の `id`） |
| 2 | リポジトリ接続を作る（`repo_connection_uuid` を控える） | `cf_builds_upsert_repo_connection` |
| 3 | ビルドトークンの UUID を取得 | `cf_builds_list_tokens` |
| 4 | トリガーを作る（本番 Worker は `main`、ステージング Worker は `staging`） | `cf_builds_create_trigger` |
| 5 | ビルド時の変数（`NEXT_PUBLIC_*` など）を登録・設定を変更 | `cf_builds_update_trigger` |
| 6 | 最初のビルドを実行 | `cf_builds_run` |
| 7 | ビルドの結果とログを確認 | `cf_builds_list_builds` / `cf_builds_get_build` |

トリガーの設定値：

| 項目 | 本番（`{project}`） | ステージング（`{project}-staging`） |
|---|---|---|
| ブランチ | `main` | `staging` |
| Build command | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler d1 migrations apply {project}-db --remote && npx opennextjs-cloudflare deploy` | `npx wrangler d1 migrations apply {project}-db-staging --remote --env staging && npx opennextjs-cloudflare deploy -- --env staging` |
| Root directory | `app` | `app` |

- トリガーの一覧は `cf_builds_list_triggers`、ビルドの中止は `cf_builds_cancel`、削除は `cf_builds_delete_trigger`。
- 専用ツールにない Builds API は `cf_request` で呼ぶ。
- 取得した `repo_connection_uuid`・`trigger_uuid` は `docs/env-variables/env-variables.md` に記録する（秘密値ではない）。

### プレビュー URL の保護（Cloudflare Access）

`staging.example.com` などのプレビュー用の URL は Cloudflare Access で管理する（ルールは AGENTS.md の「プレビュー URL のアクセス管理」）。

1. Zero Trust が未設定なら有効にする（チーム名とプランの選択。**ユーザータスク**）。
2. dev-mcp の `cf_access_create_app` で、`staging.example.com`・ステージング Worker の `workers.dev`・Preview URLs を保護する Access アプリケーションを作る。本番の `{project}` は Preview URLs だけを保護する。既存のものは `cf_access_list_apps` / `cf_access_update_app` で確認・更新する。
3. エージェント用の Service Token `agents_token` はアカウントに登録済みで、Client ID / Client Secret は環境変数 `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` に入っている。新しく作らず、`cf_access_list_service_tokens` で `agents_token`（`client_id` が `$CF_ACCESS_CLIENT_ID` と一致するもの）の ID を確認する（値はチャット・コード・ログに出さない）。
4. ステージングの Access アプリケーションに次のポリシーを付ける（`cf_access_create_app` / `cf_access_update_app`、確認は `cf_access_list_policies`）。

| ポリシー名 | アクション | セレクター |
|---|---|---|
| developer | Allow | メール：`tsukasa240129@gmail.com` |
| エージェント・自動テスト | Service Auth | Service Token：`agents_token` |

   `agents_token` の期限が近づいたら `cf_access_refresh_service_token` で延長する（`cf_access_rotate_service_token` は値が変わるので、使った場合はユーザーに環境変数の更新を依頼する）。
5. Stripe などの Webhook を受けるパスがある場合だけ、そのパス（`staging.example.com/api/webhooks/*` など）を対象にした別の Access アプリケーションを `cf_access_create_app` で作り、ポリシー「webhook bypass」（アクション：Bypass、セレクター：Everyone）を付ける。Bypass したパスは Webhook の署名検証で守る。
6. 確認：ヘッダーなしの `curl -I https://staging.example.com` がログイン画面にリダイレクトされ、`agents_token` のヘッダーを付けると 200 が返る。Webhook のパスはヘッダーなしでも Access に止められない（アプリ側の署名検証で 400 などになる）。

```bash
curl -I https://staging.example.com \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

## 注意事項

- フレームワーク初期化時に `CLAUDE.md` や `docs/` が上書きされないようにする
- パッケージインストールでエラーが出た場合は、エラー内容をユーザーに報告し、必要なら手動対応を促す
- Cloudflare・GA4・GTM の操作は dev-mcp を優先する。`wrangler` はビルド・ローカル開発・dev-mcp にない操作だけに使う
- `wrangler` は devDependencies に入れて `npx wrangler` で使う。認証は `CLOUDFLARE_API_TOKEN` で行うため、`wrangler login` は不要
- Stripe CLI のインストール・ログインはユーザータスクとして扱う
- ドメイン取得の承認（価格の確認）と、他のレジストラの場合のネームサーバー変更はユーザータスクとして扱う。取得の実行と Custom Domains への紐付けはエージェントが dev-mcp で行う
