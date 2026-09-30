## MCP 経由で利用可能なサービス

以下のサービスはユーザー環境に MCP が設定済みのため、エージェントが直接操作できる。
これらの操作を `docs/user-tasks/` に手動タスクとして記録してはならない。

### Cloudflare（MCP・API トークン設定済み）

エージェントが MCP ツール（`mcp__Cloudflare_Developer_Platform__*`）・`wrangler` CLI・Cloudflare API 経由で実行可能な操作:

- D1 データベースの作成・一覧取得・クエリ実行・マイグレーション適用（`wrangler d1 migrations apply`）
- R2 バケット・KV ネームスペースの作成・管理
- Workers の初回デプロイ・設定確認・シークレット登録（`wrangler secret put`）
- Workers Builds のビルド設定（Build / Deploy command、ブランチ、ビルド時の変数）とビルドログの確認
- 取得したドメインの Cloudflare 権威 DNS への反映確認と、Workers の Custom Domains（本番・`www`・`staging.domain.com`）への紐付け
- Cloudflare Access によるプレビュー URL（`staging.domain.com` など）の保護、ポリシーと Service Token の作成
- Email Service（Email Sending）へのドメイン登録、Email Routing のルーティングルール作成
- Cloudflare ドキュメントの検索

従って、D1 の作成やマイグレーション、Workers のデプロイ、メールの送信・受信設定などはエージェントが直接行うこと。
ユーザーに手動操作を依頼する必要はない。

ただし、以下はユーザーにしかできないためユーザータスクとして記録する:

- アプリ専用ドメインの取得と支払い（Cloudflare Registrar を基本とする）。他のレジストラで取得した場合は、ネームサーバーを Cloudflare に向ける作業（レジストラ側の操作）
- Zero Trust の初回設定（チーム名とプランの選択）
- Workers Builds のために、Cloudflare の GitHub App を GitHub アカウントにインストールし、リポジトリへのアクセスを許可する作業
- Email Routing の転送先 `customer.support.all@gmail.com` の確認（Cloudflare から届く確認メールのリンクを Gmail で押す）

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