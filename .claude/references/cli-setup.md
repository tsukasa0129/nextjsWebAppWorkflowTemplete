# CLIセットアップ手順

CLI セットアップは、ドキュメント生成後にユーザーの承認を得てから実行する。

## 事前確認

コマンド実行前に必ず Node.js 環境を確認する。

```bash
which node
node -v
npm -v
```

## フレームワーク初期化

技術スタックに応じた CLI コマンドを実行する。

### Next.js の場合

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Nuxt の場合

```bash
npx nuxi@latest init . --force
```

プロジェクトルートが空でない場合は、既存ファイル（`CLAUDE.md`、`AGENTS.md`、`docs/`）を退避し、初期化後に復元する。

## 依存パッケージインストール

提案した技術スタックに必要なパッケージをインストールする。

### Supabase

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Stripe

決済ありの場合のみ実行する。

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

### その他

提案に含まれる主要ライブラリを必要に応じてインストールする。

```bash
npm install {提案で選定したライブラリ}
```

## Supabase CLIセットアップ

Supabase を使う場合のみ実行する。

```bash
npx supabase --version || npm install -g supabase
npx supabase init
```

これにより `supabase/` ディレクトリが生成される。

## 環境変数ファイル作成

`.env.local` をプレースホルダー値で生成する。

```bash
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === Stripe（決済ありの場合） ===
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

その他、提案内容に応じて必要なキーを追加する。

## .gitignore 確認・補完

以下がなければ追記する。

- `.env.local`
- `.env*.local`
- `supabase/.temp/`

## Git初期化

Git が未初期化の場合のみ実行する。

```bash
git init
git add .
git commit -m "Initial project scaffold"
```

## Vercelプロジェクトセットアップ

Vercel を使う場合のみ実行する。

```bash
npx vercel --version || npm install -g vercel
npx vercel link
```

Vercel にログインしていない場合は `npx vercel login` が先に必要。ログインはユーザータスクとして扱う。

## 注意事項

- フレームワーク初期化時に `CLAUDE.md` や `docs/` が上書きされないようにする
- パッケージインストールでエラーが出た場合は、エラー内容をユーザーに報告し、必要なら手動対応を促す
- `supabase init` は Supabase CLI がグローバルインストールされていなくても `npx supabase init` で動作する
- Stripe CLI のインストール・ログインはユーザータスクとして扱う
- Vercel CLI のログインはトークン認証が必要なためユーザータスクとして扱う
