# `AGENTS.md`の生成ルール


## `AGENTS.md`の目的
AIエージェントのルートとなる指示書

## アウトプット先
`/{output-directory}/AGENTS.md`

## 記入フォーマット
{}の内容は動的に生成する

```markdown
# {プロジェクト名}

## プロジェクト概要
{サービスの概要を2〜3文で}

## 技術スタック
- フレームワーク: {xxx}
- スタイリング: {xxx}
- ホスティング: {xxx}
- DB / 認証: {xxx}
- 決済: {xxx}
```

最後に以下のデフォルトテンプレートをマージする。

```markdown
## ディレクトリ構成
ユーザーからの指示があった際に、適宜に適応するdocs内のファイルを読み込む

`docs/` と `app/` 配下は一つネストしたディレクトリまでのみ記載する。
ファイルまで含めた詳細なディレクトリ構造は以下を参照する。

- `docs/` の詳細: [docs/directory/docs.md](../docs/directory/docs.md)
- `app/` の詳細: [docs/directory/app.md](../docs/directory/app.md)

```text
{project-root}/
│
├── docs/                                # プロジェクトドキュメント（詳細は docs/directory/docs.md）
│   ├── analytics/                       # GA4/GTM 設計
│   ├── database/                        # DBスキーマ・設計指示
│   ├── directory/                       # ディレクトリ構造の詳細管理
│   ├── functional-requirements/         # 機能要件定義
│   ├── screens/                         # 画面仕様
│   ├── user-tasks/                      # ユーザー対応が必要なタスク
│   ├── webhook-handle/                  # Webhook 仕様
│   ├── change-log/                      # 変更記録
│   └── env-variables/                    # 環境変数ドキュメント（.env.example はgit管理外）
│
├── dev-kit/                             # 開発支援キット
│    ├── images/                           # 画像アセット
│    └── scripts/                          # GA4/GTMセットアップスクリプト（setup-ga4.mjs / setup-gtm.mjs）
│
├── mvp-kit/                             # MVP開発用キット
│    ├── DevelopmentPhaseInstructions/     # フェーズごとの開発指示
│    └── original/                         # 元ソース（stripe.md / 参考アプリ画面 / 参考スクリプト）
│
├── prompt/                              # 作業用プロンプトメモ
│
├── .codex/
│    └── AGENTS.md
│
├── .claude/
│    └── CLAUDE.md
│
├── .gitignore
│
├── .gitignore
│
└── app/                          # Next.jsアプリ本体（詳細は docs/directory/app.md）
    ├── src/                       # アプリケーションソース（app / lib / data / components / context）
    │    ├── app/                  # App Router pages / API Routes
    │    ├── components/           # UIコンポーネント
    │    ├── lib/                  # ユーティリティ・Supabase client
    │    ├── types/                # 型定義
    │    └── data/
    ├── supabase/                  # Supabase設定・マイグレーション
    └── public/                    # 静的アセット（画像・ロゴ）




## コーディング規約
- コンポーネントは関数コンポーネント + React hooks
- `'use client'` は必要最小限のコンポーネントのみに付与
- API Route はすべてサーバーサイド（`'use server'` 不要、Route Handler）
- Supabase のスキーマ変更は必ずマイグレーション経由
- ユーザー所有テーブルには必ずRLSを有効化してポリシーを設定する
- 計算エンジンはクライアントサイドで実行（`'use client'` コンポーネント内で呼び出し）
- 日本語コメント推奨（占術用語は日本語のほうが可読性が高い）
- エラーハンドリング: try-catch + ユーザーフレンドリーなエラーメッセージ
- Tailwind CSS: ダークテーマベース（紺〜深紫のグラデーション）


## バージョン管理規約
- コーディングの変更やアプリ仕様の変更がある場合は、docs配下のドキュメントを必ず作成または更新する
- エージェントが操作できずユーザーしか対応できない内容や、人間による意思決定・作業が必要なタスクは `./docs/userTask` にファイルを作成し、タスク内容を随時記載・更新する
- 仕様変更やリリース・メジャーアップデート時には必ず変更履歴（CHANGELOG）を更新する
- 機能追加・バグ修正などのプルリクエストには、関連する設計書や仕様のリンク、または説明コメントを必ず添付する
- ドキュメント・READMEは最新状態を保つ（時系列記載や補足があれば適宜追記する）
- コードレビューで指摘された修正・改善事項は、可能な場合docsにもフィードバック内容を反映する


## デバッグ・再エラー時の対応
- 一度修正を行ったにもかかわらず、ユーザーから **同じ（または関連する）エラーが再度報告された** 場合は、まずは実装する前に修正プランをプランモードで塾講する。
- サブエージェントには **プラン立案のみ** を依頼し、**実装（コード変更）は行わせない**。
- 依頼時には、対象のエラー内容・直前に行った修正内容・関連ファイル・再現条件などのコンテキストを渡す。
- 返ってきた修正プランをユーザーに提示し、合意の上で実装に着手する。


## ブラウザ上でのテスト
- ブラウザ上で動作確認・テストを行う場合は、必ず Playwright の MCP サーバー(`mcp__playwright__*`)を使用する。
- テスト中にログインが必要な場合は、エージェントが資格情報を推測・入力せず、必ずユーザーに尋ねる(認証情報の入力やログイン操作はユーザーの指示・実施を仰ぐ)。
- **開発テストで使用するスクリプトやスクリーンショットは `dev-test/` 配下に保存する**(スクリプトは `dev-test/scripts/`、スクリーンショット等の画像は `dev-test/image/`)。`dev-test/` は `.gitignore` 済みでコミット不要。`scripts/`(本番運用のカスタムスクリプト)とは分離する。


## コーディングタスク完了時の必須対応
プロジェクト内のファイルを作成・編集・削除した場合は、タスク完了前に必ず以下を実施すること。


### 1. プロジェクトドキュメントの更新
変更内容に応じて、関連するドキュメントを確認し、必要があれば更新する。

対象例:
- 開発フェーズドキュメント（`mvp-kit/development-phases/`）
- エージェント向け指示書（`.codex/AGENTS.md`、`.claude/CLAUDE.md`、`app/AGENTS.md`、`app/CLAUDE.md`）
- `docs/` 配下のプロジェクト関連ドキュメント（`docs/`）
- ディレクトリ構造の詳細（`docs/directory/docs.md`、`docs/directory/app.md`）
- カスタマーサポート用ナレッジベース（`custumer-support/`）
- 変更履歴（`CHANGELOG.md`）
- README・設計メモ・運用手順・仕様書など（`app/README.md` ほか各ディレクトリの `README.md`）

該当するドキュメントが存在しない、または更新不要と判断した場合は、最終報告でその理由を簡潔に説明する。


### 2. git のバージョン更新
プロジェクトでバージョン管理ファイルが存在する場合は、変更内容に応じてバージョン更新の必要性を確認する。

対象例:

- `package.json`
- `pyproject.toml`
- `Cargo.toml`
- `VERSION`
- その他、プロジェクトで使用しているバージョン定義ファイル

バージョン更新が必要な場合は、プロジェクトのルールに従って更新する。

判断基準の例:
- パッチ修正: patch version を更新
- 後方互換性のある機能追加: minor version を更新
- 破壊的変更: major version を更新

バージョン更新を行わない場合は、最終報告でその理由を簡潔に説明すること。


### 3. 最終報告
作業完了時には、以下を簡潔に報告すること。

- 実装・修正した内容
- 更新したドキュメント
- バージョン更新の有無
- 実行したテスト・確認コマンド
- 未対応事項や注意点があればその内容
```

## CLAUDE.md

生成先プロジェクトの `.claude/CLAUDE.md` は、Codex 用の指示書をインポートする形で記述する。

```markdown
@../.codex/AGENTS.md
```

