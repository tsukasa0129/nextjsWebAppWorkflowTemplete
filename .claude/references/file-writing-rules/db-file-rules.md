# db指示書の記述ルール

## アウトプット先
`/{output-directory}/docs/database/db-instruction.md`


## 記入フォーマット
DB設計をまとめる。DB は Cloudflare D1（SQLite 互換）を前提にする。以下のセクションを含める。
```text
1. DB概要
2. ER図（Mermaidで記述）
3. テーブル一覧
4. テーブル定義（カラム名・型・制約）
5. キー定義
6. インデックス定義
7. 制約・業務ルール
8. コード値定義（ステータス値等）
9. 命名規則
10. 補足・運用方針
```
DB規模が大きい場合は、`docs/database/` を以下のファイル構成に分割する。

- `overview.md` — DB概要・ER図・命名規則
- `tables.md` — テーブル一覧・テーブル定義・キー定義・インデックス
- `access-control.md` — 認可ルール（D1 には RLS がないため、テーブルごとにデータアクセス層での絞り込み条件を定義する）
- `migrations.md` — マイグレーション手順（Drizzle で生成 → `wrangler d1 migrations apply`）
- `seed-data.md` — 初期データ・コード値定義


## 重要ルール
- 型は SQLite に合わせる（日時は `INTEGER` の Unix ミリ秒か ISO 8601 の `TEXT`、真偽値は `INTEGER` 0/1、JSON は `TEXT`）
- ユーザー所有テーブルには `user_id` を持たせ、インデックスを張る。認可はデータアクセス層で必ず `user_id` で絞り込む
- メール送信の冪等性のため `email_logs`（`idempotency_key` UNIQUE）を用意する（`.claude/references/mail.md` 参照）
課金の履歴から辿って課金状況のデータ分析がわかるようなテーブル設計にする