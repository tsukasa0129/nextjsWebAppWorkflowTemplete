# 開発フェーズごとの指示書の記述ルール

## アウトプット先
`/{output-directory}/mvp-kit/phase-{N}.md`
`/{output-directory}/mvp-kit/summery.md`


## 記入フォーマット

### summery.md

全体の開発のサマリーの作成

```markdown

## 開発フェーズサマリー

- [ 🟢 pending ] Phase 1: {Phase 1の要約}
- [ 🟢 pending ] Phase 2: {Phase 2の要約}
...
- [ 🟢 pending ] Phase N: {Phase Nの要約}

ユーザーが「開発を進めて」と頼むと、フェーズごとの指示を確認しながら進める。
フェーズの開発が終わるとチェックボックスを更新する。

- 🟢 pending
- 🟡 progress
- 🟥 complete

次の開発フェーズの前にユーザータスクが必要な場合は、必ずユーザーに指示する。

各フェーズの詳細説明は `mvp-kit/phase-{N}.md` 内のファイルを参照する。
```



### phase-{N}.md
各フェーズの詳細な開発指示を記述する。

記述ルール:

- フェーズの目標を冒頭に書く
- 具体的な実装手順をステップで記載する
- 基本指示は直接記述せず、`docs/functional-requirements/` 内の機能詳細mdファイルを参照しながら繋げる
- フェーズ完了条件を明記する
- ユーザータスクが前提にある場合は冒頭に「⚠️ 前提: task-X の完了が必要」と記載する

```markdown
# Phase {N}: {フェーズ名}

## 目標
{このフェーズで達成すること}

## 前提条件
- ⚠️ ユーザータスク task-X の完了が必要（該当する場合）

## 実装手順

### Step 1: {ステップ名}
{指示内容}
→ 詳細仕様: docs/functional-requirements/{機能名}.md を参照

### Step 2: {ステップ名}
...

## 完了条件
- [ ] {確認項目1}
- [ ] {確認項目2}
```


