# アナリティクス設計書に従った GA4・GTM のセットアップ

GA4・GTM の設定は、MCP サーバー **dev-mcp**（`mcp__dev-mcp__ga4_*` / `mcp__dev-mcp__gtm_*`）からエージェントが直接行う。Node.js のセットアップスクリプトは作らない。

## 作成先のアカウント
GA4 のプロパティ・GTM のコンテナは、必ず **TSK のアカウント**に作る。他のアカウント（VIA・SHIFT AI など）には作らない。

| サービス | アカウント名 | アカウント ID |
|---|---|---|
| GA4 | Tsk | `accounts/389854121` |
| GTM | TSK | `accounts/6005472776` |

作る前に `ga4_list_account_summaries` / `gtm_list_accounts` で、上のアカウントが見えることを確認する（ID が変わっていたら名前で探し、このファイルを更新する）。

## 入力
- アナリティクス設計書：`docs/functional-requirements/analytics/ga4-event-dimension-design.md`（特に「11. おすすめの GA4 プロパティ名・データストリーム名・GTM コンテナ名」）

## GA4 の設定（`mcp__dev-mcp__ga4_*`）

1. `ga4_list_account_summaries` で Tsk アカウント（`accounts/389854121`）のプロパティを確認する。同名のプロパティがあれば作らずに使う。
2. `ga4_create_property` で Tsk アカウントの下にプロパティを作り（タイムゾーン `Asia/Tokyo`、通貨 `JPY`）、`ga4_create_data_stream` で Web データストリームを作る（URL は `https://app.{domain}`）。測定 ID（`G-XXXX`）を控える。
3. 設計書のカスタムディメンション・カスタム指標・キーイベントを、`ga4_create_resource` で作る（`customDimensions` / `customMetrics` / `keyEvents`）。既存のものは `ga4_list_resources` で確認し、重複して作らない。
4. プロパティの必須設定を行う（すべてのプロパティで必ず行う）。

| 設定 | 値 | dev-mcp での操作 |
|---|---|---|
| イベントデータの保持期間 | 14 か月 | `ga4_update_resource` name `properties/{id}/dataRetentionSettings` body `{"eventDataRetention":"FOURTEEN_MONTHS","resetUserDataOnNewActivity":true}` |
| Google シグナルのデータ収集 | オン | `ga4_update_resource` name `properties/{id}/googleSignalsSettings` body `{"state":"GOOGLE_SIGNALS_ENABLED"}`（v1alpha） |
| ユーザー提供データの収集 | オン | `ga4_admin_request` POST `properties/{id}:acknowledgeUserDataCollection`（利用規約への同意文を `acknowledgement` に入れる）。GTM の Google タグ側でもユーザー提供データの送信を有効にする |
| BigQuery リンク | 作成（日次エクスポート） | `ga4_create_resource` parent `properties/{id}` collection `bigQueryLinks`（v1alpha） body `{"project":"projects/{GCP プロジェクト ID}","datasetLocation":"asia-northeast1","dailyExportEnabled":true,"streamingExportEnabled":false,"exportStreams":["properties/{id}/dataStreams/{stream_id}"]}` |

- 設定後は `ga4_get_resource` で各設定を読み直し、値が反映されていることを確認する（BigQuery リンクは `ga4_list_resources` の `bigQueryLinks`）。
- BigQuery リンクには、BigQuery API を有効にした GCP プロジェクトと、そのプロジェクトのオーナー権限が必要。GCP プロジェクト ID が決まっていない場合は、ユーザーに確認する。
- API で設定できなかった項目（Google シグナルの同意確認など、管理画面での操作が必要なもの）は、`docs/user-tasks/` にユーザータスクとして残す。勝手に省略しない。
5. その他の Admin API の設定は `ga4_update_resource` / `ga4_admin_request` で行う。

## GTM の設定（`mcp__dev-mcp__gtm_*`）

1. `gtm_list_accounts` → `gtm_list_containers` で TSK アカウント（`accounts/6005472776`）のコンテナを確認し、なければ `gtm_create_container` で TSK アカウントの下に Web コンテナを作る。
2. `gtm_create_workspace`（または既存の `gtm_list_workspaces`）で作業用のワークスペースを用意する。
3. 設計書に従い、`gtm_create_entity` で変数（データレイヤー変数など）・トリガー（カスタムイベント）・タグ（GA4 設定タグ、GA4 イベントタグ）を作る。組み込み変数は `gtm_enable_built_in_variables` で有効にする。
4. `gtm_get_workspace_status` で変更を確認し、`gtm_quick_preview` で検証してから、`gtm_create_version` → `gtm_publish_version` で公開する（公開すると本番に反映される）。
5. `gtm_get_container_snippet` でスニペットを取得し、アプリに組み込む（コンテナ ID は `NEXT_PUBLIC_GTM_ID` に入れる）。

- GTM API はレート制限が厳しい（約 0.25 リクエスト/秒）。まとめて作るときは時間がかかる前提で進める。
- 本番に公開する前に、ステージングで dataLayer のイベントが送られることを確認する。

## テスト環境のデータを本番レポートに入れない（必須）

ステージング（`staging.{domain}`）・ローカル・GTM のプレビューからのデータは、本番の GA4 レポートに入れない。GTM を公開する前に、次の A〜D をすべて行う。

| 送信元 | 何が起きるか | 本番レポートに入るか |
|---|---|---|
| ローカル | `NEXT_PUBLIC_GTM_ID` を設定しないので GTM を読み込まない | 入らない |
| staging のブラウザ | 全イベントに `debug_mode` が付く | 入らない（データフィルタで除外）。DebugView には出る |
| GTM のプレビュー（本番を含む） | GA4 が自動で `debug_mode` を付ける | 入らない（同上）。DebugView には出る |
| staging のサーバー（課金イベントなど Measurement Protocol） | 検証用の窓口（`/debug/mp/collect`）にだけ送り、GA4 には記録しない | 入らない |
| 本番（`app.{domain}`） | `debug_mode` を付けない | 入る |

| # | 場所 | 内容 | 誰が行うか |
|---|---|---|---|
| A | GTM | カスタム JavaScript 変数 `CJS - debug_mode` を作る。ホスト名が `staging.` で始まるか `localhost` のときだけ `true` を返し、それ以外は `undefined` を返す（`false` を返すとデバッグ扱いになることがあるため返さない）。Google タグの設定パラメータ `debug_mode` にこの変数を入れる | エージェント（`gtm_create_entity` / `gtm_update_entity`） |
| B | GA4 | データフィルタ「デベロッパー トラフィック」を作り、`debug_mode` 付きのイベントを除外する | **ユーザー**（データフィルタは Admin API で作れないため。`docs/user-tasks/` に記録する） |
| C | アプリ | ステージング・ローカルでは `NEXT_PUBLIC_GTM_ID` を設定しない、または staging 用の値を使い、本番のみ本番のコンテナ ID を入れる。サーバーから送るイベントは、本番以外では `https://www.google-analytics.com/debug/mp/collect` に送る | エージェント |
| D | GA4 | 「内部トラフィック」（IP アドレス指定）は、社内からの本番アクセスを除外したくなったときだけ追加する | 必要時にユーザーと相談 |

B のユーザータスクの手順（`docs/user-tasks/` にそのまま書く）：
1. GA4 の管理（左下の歯車）→「データの収集と修正」→「データフィルタ」→「フィルタを作成」
2. 種類「デベロッパー トラフィック」、操作「除外」、状態「有効」で保存する
3. 注意
   - 「有効」の状態で除外されたデータは、あとから戻せない。不安なら先に状態を「テスト」にして中身を確認してから「有効」にする
   - フィルタが効くのは有効にしたあとのデータだけ。GTM を公開する前に作っておく
   - 除外されるのは GA4 だけ。Meta / X などの Pixel には `debug_mode` の仕組みがないため、本番以外では Pixel のタグを発火させない（GTM のトリガーでホスト名が本番のときだけに絞る）

エージェントは、B が完了したことをユーザーに確認してから `gtm_publish_version` で公開する。

## 確認
- ステージングからのイベントが DebugView に出て、本番のレポート（`ga4_run_realtime_report`）には出ないことを確認する。本番からのイベントはレポートに届いていることを確認する。
- Tsk / TSK 以外のアカウントに作っていないことを確認する。
- 作成したプロパティ ID・測定 ID・コンテナ ID・公開したバージョンは、設計書と `docs/env-variables/env-variables.md` に記録する。
