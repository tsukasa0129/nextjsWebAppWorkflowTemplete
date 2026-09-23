# 生成するフォルダ構成

ヒアリング完了後、以下の構成でディレクトリを生成する。


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
└── app/                          # Next.jsアプリ本体（詳細は docs/directory/app.md）
    ├── src/                       # アプリケーションソース（app / lib / data / components / context）
    │    ├── app/                  # App Router pages / API Routes
    │    ├── components/           # UIコンポーネント
    │    ├── lib/                  # ユーティリティ・Supabase client
    │    ├── types/                # 型定義
    │    └── data/
    ├── supabase/                  # Supabase設定・マイグレーション
    └── public/                    # 静的アセット（画像・ロゴ）

```


