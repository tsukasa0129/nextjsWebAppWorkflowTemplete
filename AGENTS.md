# 開発要件定義フォルダ/ファイルの作成指示書

## 役割
ユーザーとの対話から開発要件を整理し、Claude Code / Codex で即座に開発を始められるプロジェクトフォルダ構成を生成する。


## ファイル名ルール
- ファイル名はすべて `kebab-case` を使う
- ディレクトリ名も原則 `kebab-case` を使う
- 画面IDや機能IDは本文内では `U-001` / `F-001` のように表記してよい
- 実ファイル名は `u-001` / `f-001-user-input.md` のように小文字化する


## 生成フォルダ / ファイル
生成するドキュメントは原則すべて日本語で書く

1. `docs/`配下のファイル群 — 機能仕様・開発フェーズ・画面定義・DB設計などの詳細ドキュメント群
2. `AGENTS.md` — Codex 用のエージェント指示書
3. `CLAUDE.md` — Claude Code 用のエージェント指示書
3. `mcp.json` — Claude Code 用のローカルサーバーのmcp設定
3. `.claude/settiong.json` — Claude Code 用のローカルサーバーのmcp設定


## 構築フロー
それぞれのフローは参考ファイルに従って生成する

1. ユーザーが「プロジェクトを作りたい」等と言ったら、最初に必要最小限のヒアリングだけを行う
- ヒアリングと提案フローの詳細な指示書: `.claude/references/hearing-and-proposal-flow.md`
- アウトプット先の生成するフォルダ構成: `.claude/references/output-structure.md`

2. 画面構成と機能要件を決定
 - 画面構成設計書作成の指示書：`.claude/references/file-writing-rules/screens-file-rules.md`
 - 機能要件書生成の指示書：`.claude/references/file-writing-rules/requirements-file-rules.md`


3. DB設計を決定
 - DB設計書生成の指示書：`.claude/references/file-writing-rules/requirements-file-rules.md`

4. 環境変数の設計を決定
 - 環境変数設計書生成の指示書：`.claude/references/file-writing-rules/env-variables.md`


5. ユーザータスクの設計を決定
- アウトプット先の生成するフォルダ構成: `.claude/references/file-writing-rules/user-tasks.md`
- ユーザータスクにすべきではない指示のファイル: `.claude/references/usertask.md`

6. 開発フェーズごとの仕様書を決定
 - 開発フェーズごとの設計書生成の指示書：`.claude/references/file-writing-rules/development-phases-rules.md`


7. アナリティクス解析の要件を決定（※必要であれば）
 - アナリティクスの設計書生成の形式の指示書：`.claude/references/file-writing-rules/ga4-event-and-demention-structure-rules.md`
 - アナリティクスの設計書生成時のベストプラクティス：`/.claude/references/ga4-event-and-demention-best-practice.md`

8. アナリティクス解析要件に従って、GA4とGTMの実装スクリプトを作成（※必要であれば）
 - スクリプト生成の指示書：`.claude/references/gen-GA4-GTM-script.md`

9. `/docs`と`/app`配下の詳細なディレクトリ構造の説明資料を作成
 - ディレクトリ構造説明資料作成の指示書：`.claude/references/file-writing-rules/directory-rules.md`


9. `AGENTS.md`の生成
- `AGENTS.md`記述ルール: `.claude/references/file-writing-rules/agentsmd-file-rule.md`

9. `mcp.json`と`setting.json`の生成
- `mcp.json`、`setting.json`記述ルール: `.claude/references/file-writing-rules/mcp-setting-file-rule.md`







