# 環境変数指示書の記述ルール

## アウトプット先
`/{output-directory}/docs/directory/docs.md`
`/{output-directory}/docs/directory/app.md`


## 記入フォーマット
`/app`、`/docs`配下のディレクトリの構造を詳細に記載する



### appの場合（docsも同じ形式で）
```text
# `app/` ディレクトリ詳細構造

`AGENTS.md` の「ディレクトリ構成」では `app/` 配下を1階層までしか記載していません。
ファイルを含む詳細なパス構造はこのファイルで管理します。

> 構造を変更した場合は、このファイルと `.codex/AGENTS.md` の両方を更新してください。
> `node_modules/` `.next/` `.vercel/` など生成物・依存物は省略しています。

```text
app/                                        # Next.js アプリ（ルート）
├── public/                                 # 静的アセット


```
