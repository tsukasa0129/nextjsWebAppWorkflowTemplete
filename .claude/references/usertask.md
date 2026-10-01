## MCP 経由で利用可能なサービス

以下のサービスはユーザー環境に MCP が設定済みのため、エージェントが直接操作できる。
これらの操作を `docs/user-tasks/` に手動タスクとして記録してはならない。

### dev-mcp（Cloudflare・GA4・GTM。MCP 設定済み）

Cloudflare・GA4・GTM の操作は、MCP サーバー **dev-mcp** からエージェントが直接行う。ダッシュボードでの手作業や `curl` は使わない（dev-mcp にないものだけ `wrangler` CLI を使う）。

#### Cloudflare（`mcp__dev-mcp__cf_*`）
- ドメイン：検索・見積もり・取得（`cf_domain_search` → `cf_domain_quote` → `cf_domain_register`）・設定（`cf_domain_*`）
- ゾーン・DNS：`cf_list_zones` / `cf_get_zone` / `cf_*_dns_record` / `cf_zone_settings`
- D1：作成・一覧（`cf_d1_create_database` / `cf_d1_list_databases`）、調査のための読み取り（`cf_d1_query` は `SELECT` のみ）、マイグレーションの状態確認（`cf_d1_migrations_list`）。スキーマ・データの変更は migration SQL を Git push して Workers Builds で適用する（`cf_d1_query` や管理画面から直接変更しない）
- Workers：一覧・設定・デプロイ履歴・Custom Domains の確認（`cf_workers_list` / `cf_worker_settings` / `cf_worker_deployments` / `cf_worker_list_domains`）、シークレットの登録（`cf_worker_put_secret`）
- Workers Builds：リポジトリ接続・トリガー作成・ビルドの実行とログ確認（`cf_builds_*`）
- Email Service：送信ドメインの登録と DNS（`cf_email_sending_*`）、テスト送信（`cf_email_send`）
- Access：プレビュー URL の保護と Service Token（`cf_access_*`）
- Turnstile：ウィジェットの作成（`cf_turnstile_*`）
- 上にない API は `cf_request` / `cf_get` で呼ぶ（Email Routing のルール作成など）
- Workers AI のバインディング設定とモデルの選定

#### GA4（`mcp__dev-mcp__ga4_*`）・GTM（`mcp__dev-mcp__gtm_*`）
- GA4 のプロパティ・データストリーム・カスタムディメンション・キーイベントの作成、レポートの取得
- GTM のコンテナ・ワークスペース・タグ・トリガー・変数の作成、バージョンの作成と公開
- 手順は `.claude/references/gen-GA4-GTM-script.md`

従って、これらの操作はエージェントが直接行うこと。ユーザーに手動操作を依頼する必要はない。

ただし、以下はユーザータスクとして記録する:

- ドメイン取得の承認：`cf_domain_quote` で出した価格をユーザーに見せ、明示的な承認を得てから `cf_domain_register` を実行する（課金され、返金できない）。他のレジストラで取得済みの場合は、ネームサーバーを Cloudflare に向ける作業
- Zero Trust の初回設定（チーム名とプランの選択）
- Email Routing の転送先 `customer.support.all@gmail.com` の確認（Cloudflare から届く確認メールのリンクを Gmail で押す）
- Cloudflare の GitHub App を GitHub アカウントにインストールし、リポジトリへのアクセスを許可する作業（Workers Builds の前提。アカウントごとに初回 1 回だけ）

### Stripe（MCP 設定済み）

エージェントが MCP ツール経由で実行可能な操作:

- 商品（Product）・価格（Price）の作成・一覧取得・更新
- 顧客（Customer）の作成・管理
- サブスクリプションの作成・管理
- Payment Link の作成
- Webhook エンドポイントの作成・管理
- Checkout Session の作成
- 請求書（Invoice）の作成・管理
- 残高・支払い情報の取得

従って、Stripe の商品・価格設定や Webhook 登録などはエージェントが直接行うこと。
ユーザーに Stripe ダッシュボードでの手動操作を依頼する必要はない。