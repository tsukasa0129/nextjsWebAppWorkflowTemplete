# アナリティクス設計書に従った GA4・GTM のセットアップ

GA4・GTM の設定は、MCP サーバー **dev-mcp**（`mcp__dev-mcp__ga4_*` / `mcp__dev-mcp__gtm_*`）からエージェントが直接行う。Node.js のセットアップスクリプトは作らない。

## 入力
- アナリティクス設計書：`docs/functional-requirements/analytics/ga4-event-dimension-design.md`（特に「11. おすすめの GA4 プロパティ名・データストリーム名・GTM コンテナ名」）

## GA4 の設定（`mcp__dev-mcp__ga4_*`）

1. `ga4_list_account_summaries` でアカウント・プロパティを確認する。同名のプロパティがあれば作らずに使う。
2. `ga4_create_property` でプロパティを作り、`ga4_create_data_stream` で Web データストリームを作る（URL は `https://app.{domain}`）。測定 ID（`G-XXXX`）を控える。
3. 設計書のカスタムディメンション・カスタム指標・キーイベントを、`ga4_create_resource` で作る（`customDimensions` / `customMetrics` / `keyEvents`）。既存のものは `ga4_list_resources` で確認し、重複して作らない。
4. データ保持期間など、その他の Admin API の設定は `ga4_update_resource` / `ga4_admin_request` で行う。

## GTM の設定（`mcp__dev-mcp__gtm_*`）

1. `gtm_list_accounts` → `gtm_list_containers` で確認し、なければ `gtm_create_container` で Web コンテナを作る。
2. `gtm_create_workspace`（または既存の `gtm_list_workspaces`）で作業用のワークスペースを用意する。
3. 設計書に従い、`gtm_create_entity` で変数（データレイヤー変数など）・トリガー（カスタムイベント）・タグ（GA4 設定タグ、GA4 イベントタグ）を作る。組み込み変数は `gtm_enable_built_in_variables` で有効にする。
4. `gtm_get_workspace_status` で変更を確認し、`gtm_quick_preview` で検証してから、`gtm_create_version` → `gtm_publish_version` で公開する（公開すると本番に反映される）。
5. `gtm_get_container_snippet` でスニペットを取得し、アプリに組み込む（コンテナ ID は `NEXT_PUBLIC_GTM_ID` に入れる）。

- GTM API はレート制限が厳しい（約 0.25 リクエスト/秒）。まとめて作るときは時間がかかる前提で進める。
- 本番に公開する前に、ステージングで dataLayer のイベントが送られることを確認する。

## 確認
- `ga4_run_realtime_report` で、ステージング・本番からのイベントが GA4 に届いていることを確認する。
- 作成したプロパティ ID・測定 ID・コンテナ ID・公開したバージョンは、設計書と `docs/env-variables/env-variables.md` に記録する。
