# F-005: Stripe決済機能

## 概要

Stripe Subscriptions を利用した決済機能。初回199円のワンタイム課金 + 3日間トライアル後に月額5,000円のサブスクリプションへ自動移行する。決済方法は2系統: Stripe Embedded Checkout（カード決済）と Payment Request API（Apple Pay / Google Pay のネイティブウォレット決済）を提供する。

## 画面との対応

| 画面ID | 画面名 | 説明 |
|--------|--------|------|
| U-005 | 結果プレビュー画面 | 決済ボタン（Apple Pay / Google Pay / カード）を表示 |
| U-006 | Embedded Checkout画面 | Stripe Embedded Checkout（アプリ内に埋め込み） |

結果プレビュー画面（U-005）の決済ボタンから遷移し、決済成功後は結果詳細画面（U-007）にリダイレクトする。

## UI 詳細

### 結果プレビュー画面（U-005）— `/results/[token]/preview`

決済前のセールスページ。スクロール可能な縦長レイアウトで、ユーザーに決済を促す。モバイルファースト（max-width: md / 768px）。

#### セクション構成（上から順）

| # | セクション名 | 背景色 | 内容 |
|---|-------------|--------|------|
| 1 | 強みハイライトバー | `gray-100` | ユーザーの強み1行テキスト（例:「パターン認識能力が高いです」） |
| 2 | 緊急オファーバー | `#1a1f3d`（ネイビー） | 「**199円** で結果を入手。オファーは残り **MM:SS** で終了します」。10分カウントダウンタイマー（monospace, tabular-nums）。期限切れ時は「特別オファーは終了しました」に切替 |
| 3 | ヒーローセクション | `#1a1f3d`（セクション2と背景連結） | H1「IQスコアの準備ができました！」、サブテキスト、オレンジCTAボタン「IQテストの結果を取得」（クリックで決済ボタンエリアにスムーススクロール）。Framer Motion フェードインアニメーション |
| 4 | IQ比較チャート | 白カード（`rounded-xl border`） | 棒グラフ3本: マリリン・モンロー（IQ 168, オレンジ棒）、あなたのIQ（?、青棒+ブラー）、アインシュタイン（IQ 160, 緑棒）。各棒の下に絵文字アバター・名前・IQラベル。左にY軸ラベル（200/150/100） |
| 5 | 特典リスト | 白背景 | 4項目。各項目に緑チェックアイコン（`bg-green-500` 丸）+ タイトル + 説明文。項目:「正確なIQスコアを入手」「知能レベルを明確かつ正確に評価」「検証済みの個人用証明書を取得」「パーソナライズされた脳トレプログラム」 |
| 6 | 割引バッジ | `bg-orange-50` + `border-orange-200` | 炎アイコン + 「**割引が適用されました！**」「87%お得です。」 |
| 7 | 価格セクション | 白カード（`border bg-card`） | 「本日の合計:」 ~~1,531円~~ **199円** |
| 8 | 決済ボタンエリア | — | 3つのボタン（後述） |
| 9 | セキュリティノート | — | ロックアイコン + 「お支払いは安全に暗号化されています」 |
| 10 | 利用規約テキスト | — | 10px テキスト。利用規約・プライバシーポリシーリンク。サブスクリプション自動更新・キャンセル条件の説明 |
| 11 | ソーシャルプルーフ | — | 6つの絵文字アバター（重なり表示）+ 「すでに8百万人以上がこのテストを受けています」「平均IQスコア 100」 |
| 12 | 信頼性カード | — | 2カラムグリッド:「科学的に考案されたIQテスト」「脳トレプログラム」。各カードに説明文 |
| 13 | IQ証明書プレビュー | `amber-50〜amber-100` グラデーション | ブラー処理された証明書プレビュー（「IQ ???」）。中央にロックアイコン付き白丸オーバーレイ。下部に「公式IQ証明書」タイトル + 「証明書を取得する →」リンク |
| 14 | 受験者の声 | — | 3件のテスティモニアル。各カード: 名前の頭文字アバター（`bg-orange-100`）、名前、年齢・都市、レビュー文 |
| 15 | よくある質問 | — | 3項目のアコーディオン。「購入すると何が得られますか？」「サブスクリプションはどのようにキャンセルできますか？」「必要な場合、どのようにサポートを受けることができますか？」 |
| 16 | 底部固定CTA | 白背景（`fixed bottom-0 z-50`） | フルワイドオレンジボタン「IQスコアの結果を取得」+ ロックアイコン + 「安全に暗号化されたお支払い」 |
| 17 | フッター | — | 利用規約・プライバシーポリシー・特定商取引法表記リンク |

#### 決済ボタンエリア詳細（セクション8）

上から順に3つのボタンが縦並びで配置される:

```
┌────────────────────────────────┐
│    Pay で支払う               │  ← Apple Pay（黒背景、白文字、Appleロゴ SVG）
└────────────────────────────────┘
┌────────────────────────────────┐
│   Google Pay で支払う          │  ← Google Pay（白背景、グレー枠線、Googleカラーロゴ SVG）
└────────────────────────────────┘
┌────────────────────────────────┐
│ 💳 クレジットカードまたは       │  ← アコーディオントグル（白背景、ネイビー文字）
│    デビットカード          ▼   │     クリックで展開 → インラインカード入力フォーム表示
├────────────────────────────────┤
│  ┌──────────────────────────┐  │  ← 展開時: Stripe PaymentElement（タブレイアウト）
│  │  カード番号              │  │     + 送信ボタン「¥199で今すぐ結果を見る」
│  │  有効期限  CVC           │  │     （ネイビー背景、CreditCardアイコン付き）
│  └──────────────────────────┘  │
│  [💳 ¥199で今すぐ結果を見る]   │
└────────────────────────────────┘
```

- **Apple Pay ボタン**: `bg-black text-white rounded-lg py-3.5`。Apple ロゴ SVG + テキスト。ウォレット対応時は `paymentRequest.show()` でネイティブシート、非対応時は `/checkout/[token]` にフォールバック
- **Google Pay ボタン**: `bg-white border-gray-300 text-gray-700 rounded-lg py-3.5`。Googleカラー SVG + テキスト。動作は Apple Pay と同様
- **カードボタン**: アコーディオン形式。`ChevronDown` アイコンが展開時に180度回転（Framer Motion）。展開すると `CheckoutElementsProvider` + `PaymentElement` をインラインで表示。フォーム読み込み中は「カード入力フォームを準備中...」スピナー表示

#### ウォレット決済エラー表示

ウォレット決済でエラーが発生した場合、決済ボタンエリアの直下に赤いエラーボックス（`bg-red-50 border-red-200`）でメッセージを表示。

#### アニメーション

- 各セクションは Framer Motion で `opacity: 0, y: 20` → `opacity: 1, y: 0` にフェードイン
- セクションごとに `delay` を 0.15〜0.5s でずらしてスタガーアニメーション
- カードアコーディオン展開: `height: 0` → `height: auto` + `opacity` トランジション（0.3s easeInOut）
- CTA スクロール後のハイライト: `x: 40, opacity: 0, scale: 0.95` → `x: 0, opacity: 1, scale: 1`（0.5s easeOut）

#### カウントダウンタイマー

- 初回アクセス時に `localStorage` に開始時刻を保存（キー: `iq_preview_timer_start`）
- 10分間のカウントダウン。リロードしてもタイマーは継続
- 0になると「特別オファーは終了しました」テキストに切替（タイマー非表示）

---

### Embedded Checkout 画面（U-006）— `/checkout/[token]`

カード決済専用ページ。プレビューページの Apple Pay / Google Pay ボタンからウォレット非対応時のフォールバック先としても使用。

#### レイアウト

```
┌──────────────────────────────────┐
│        お支払い情報の入力         │  ← H1（text-xl font-bold、中央揃え）
│ カード情報を入力して、IQテストの  │  ← サブテキスト（text-sm text-gray-500）
│ 詳細結果を確認しましょう         │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │                              │ │  ← 白カード（rounded-2xl border shadow-sm p-6）
│ │  Stripe PaymentElement       │ │     Stripe の決済フォーム（タブレイアウト）
│ │  ┌────────────────────────┐  │ │     テーマ: オレンジ（#f97316）、角丸8px
│ │  │ カード番号             │  │ │
│ │  │ 有効期限    CVC        │  │ │
│ │  └────────────────────────┘  │ │
│ │                              │ │
│ │  [エラーメッセージ]          │ │  ← 赤背景ボックス（bg-red-50、エラー時のみ表示）
│ │                              │ │
│ │  [¥199で今すぐ結果を見る]    │ │  ← フルワイドボタン（bg-orange-500 rounded-xl py-4）
│ │                              │ │     処理中: 「処理中...」、disabled時: opacity-50
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- **コンテナ**: `max-w-md mx-auto px-4 py-8`
- **Stripe テーマ**: `colorPrimary: "#f97316"`, `borderRadius: "8px"`, `fontFamily: "system-ui, sans-serif"`
- **PaymentElement**: `layout: "tabs"`, `terms: { card: "never" }`（カード規約非表示）
- **送信ボタン**: `bg-orange-500 rounded-xl py-4 text-lg font-bold text-white`

#### 状態別表示

| 状態 | 表示内容 |
|------|---------|
| 読み込み中 | オレンジ色スピナー（`animate-spin border-orange-500`） |
| セッション未検出 | 「セッション情報が見つかりません」+ 「プレビューに戻る」ボタン（`bg-orange-500`） |
| エラー | 「エラーが発生しました」+ エラーメッセージ + 「プレビューに戻る」ボタン |
| 決済済み（409） | 結果ページにリダイレクト |

---

### 共通スタイル

| 項目 | 値 |
|------|-----|
| プライマリカラー | オレンジ `#f97316`（`bg-orange-500`） |
| セカンダリカラー | ネイビー `#1a1f3d` |
| ボタン角丸 | `rounded-lg`（決済ボタン）、`rounded-xl`（CTA・送信ボタン） |
| フォント | `system-ui, sans-serif` |
| レスポンシブ | モバイルファースト、`max-w-md`（768px） |
| アニメーション | Framer Motion（フェードイン・スタガー・アコーディオン展開） |
| アイコン | Lucide React（`CreditCard`, `Lock`, `Check`, `Flame`, `ChevronDown`, `X`） |

## 課金モデル

| タイミング | 金額 | 説明 |
|-----------|------|------|
| 決済時（初回） | ¥199 | ワンタイム料金（`price_data` でインライン定義） |
| 3日後 | ¥5,000 | 月額サブスクリプション開始（`trial_period_days: 3` で制御） |
| 以降毎月 | ¥5,000 | 自動更新 |

### Stripe 商品構成

| 項目 | 値 |
|------|-----|
| 商品名 | IQテスト 詳細結果レポート |
| 価格モデル | サブスクリプション（月額課金） |
| 月額料金 | 5,000円（税込） |
| 通貨 | JPY |
| Price ID | 環境変数 `STRIPE_PRICE_ID` で管理 |

初回 ¥199 のワンタイム料金は Stripe に事前登録不要。Checkout Session 作成時に `price_data` でインライン定義する。

## 決済方法

### 方法1: Embedded Checkout（カード決済）

プレビューページからチェックアウトページ（`/checkout/[token]`）に遷移し、Stripe Embedded Checkout を表示する。

| 項目 | 値 |
|------|-----|
| UI モード | `embedded_page`（`@stripe/react-stripe-js` の `EmbeddedCheckout` コンポーネント） |
| 対応決済 | クレジットカード、デビットカード、Stripe が Dashboard 設定に基づき自動判定 |
| ボタン | 「クレジットカードまたはデビットカード」ボタン、底部固定CTA |

### 方法2: Payment Request API（ウォレット決済）

プレビューページ上で直接ネイティブ決済シートを起動する。ページ遷移なし。

| 項目 | 値 |
|------|-----|
| 対応決済 | Apple Pay（Safari/iOS）、Google Pay（Chrome/Android） |
| 実装 | `stripe.paymentRequest()` API + カスタムフック `useWalletPay` |
| フォールバック | `canMakePayment()` が非対応を返した場合、Embedded Checkout にフォールバック |

#### ウォレット決済の利用条件

- HTTPS 環境（必須）
- Apple Pay: Safari + macOS/iOS + Apple Pay 設定済み + Stripe Dashboard で Apple Pay 有効 + ドメイン登録
- Google Pay: Chrome + Google アカウントにカード登録済み + Stripe Dashboard で Google Pay 有効

### プレビューページのボタン構成

| ボタン | ウォレット対応時 | ウォレット非対応時 |
|--------|----------------|------------------|
| Apple Pay | Payment Request API（ネイティブシート） | Embedded Checkout にフォールバック |
| Google Pay | Payment Request API（ネイティブシート） | Embedded Checkout にフォールバック |
| クレジットカード | Embedded Checkout | Embedded Checkout |
| 底部固定CTA | Embedded Checkout | Embedded Checkout |

## 実装ファイル構成

```
app/src/
├── app/
│   ├── api/
│   │   ├── checkout/route.ts              # Embedded Checkout Session 作成
│   │   ├── wallet-pay/route.ts            # Wallet Pay API（Payment Request API 用）
│   │   ├── webhooks/stripe/route.ts       # Stripe Webhook 受信
│   │   └── customer-portal/route.ts       # Customer Portal セッション作成
│   ├── checkout/[token]/page.tsx          # Embedded Checkout ページ
│   └── results/[token]/preview/page.tsx   # プレビューページ（決済ボタン）
├── lib/
│   ├── stripe.ts                          # Stripe サーバーサイドクライアント
│   ├── stripe-client.ts                   # Stripe クライアントサイド（loadStripe）
│   ├── subscription-helpers.ts            # サブスクリプション DB 作成共通ヘルパー
│   └── hooks/
│       └── use-wallet-pay.ts              # Payment Request API カスタムフック
```

## フロー詳細

### フロー1: Embedded Checkout（カード決済）

```
プレビューページで「カード」ボタンをクリック
  │
  ▼
/checkout/[token] に遷移
  │
  ▼
POST /api/checkout { session_id, token }
  │
  ├─ セッション検証（存在、email あり、paid でない）
  ├─ Stripe Checkout Session 作成（embedded_page モード）
  │   ├─ line_items[0]: ¥199 ワンタイム（price_data インライン）
  │   ├─ line_items[1]: ¥5,000/月 サブスクリプション（STRIPE_PRICE_ID）
  │   └─ subscription_data.trial_period_days: 3
  └─ client_secret を返却
  │
  ▼
EmbeddedCheckout コンポーネントで決済フォーム表示
  │
  ▼ ユーザーがカード情報入力 → 決済
  │
  ├─ Stripe が return_url にリダイレクト: /results/[token]?checkout=success
  └─ Stripe が Webhook 送信: checkout.session.completed
       │
       ▼
     createSubscriptionRecord() で DB 更新 + メール送信
```

### フロー2: Payment Request API（ウォレット決済）

```
プレビューページで Apple Pay / Google Pay ボタンをタップ
  │
  ├─ canApplePay/canGooglePay === true
  │     │
  │     ▼
  │   paymentRequest.show() → ネイティブ決済シート表示
  │     │
  │     ▼ 生体認証（Face ID / Touch ID / 指紋）
  │   paymentmethod イベント発火 → payment_method_id 取得
  │     │
  │     ▼
  │   POST /api/wallet-pay { session_id, token, payment_method_id }
  │     │
  │     ├─ Customer 作成（payment_method をデフォルトに設定）
  │     ├─ InvoiceItem 作成（¥199 ワンタイム）
  │     ├─ Subscription 作成（trial_period_days: 3）
  │     │   └─ InvoiceItem が trial invoice に付加 → PaymentIntent ¥199
  │     │
  │     ├─ succeeded → createSubscriptionRecord() → { success: true }
  │     ├─ requires_action → { client_secret } → SCA 処理
  │     └─ failed → { error } → エラー表示
  │
  └─ canApplePay/canGooglePay === false
        → Embedded Checkout にフォールバック
```

## API エンドポイント

### POST /api/checkout — Embedded Checkout Session 作成

**リクエスト**

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "token": "5bca108b-bbdc-48a9-8e60-894706f217dc"
}
```

**レスポンス（200 OK）**

```json
{
  "client_secret": "cs_xxx_secret_yyy",
  "checkout_session_id": "cs_xxxxx"
}
```

**レスポンス（409 Conflict）**

```json
{
  "error": "ALREADY_PAID",
  "message": "既に決済済みです。",
  "redirect_url": "/results/5bca108b-bbdc-48a9-8e60-894706f217dc"
}
```

**レスポンス（400/404/500）**

```json
{
  "error": "SESSION_NOT_FOUND | SESSION_NOT_READY | CHECKOUT_FAILED",
  "message": "エラーメッセージ"
}
```

### POST /api/wallet-pay — Wallet Pay（Payment Request API）

**リクエスト**

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "token": "5bca108b-bbdc-48a9-8e60-894706f217dc",
  "payment_method_id": "pm_1Abc2Def3Ghi"
}
```

**レスポンス（成功）**

```json
{
  "success": true,
  "redirect_url": "/results/5bca108b-bbdc-48a9-8e60-894706f217dc?checkout=success",
  "subscription_id": "sub_xxxxx"
}
```

**レスポンス（SCA 必要）**

```json
{
  "success": false,
  "requires_action": true,
  "client_secret": "pi_xxx_secret_yyy",
  "subscription_id": "sub_xxxxx"
}
```

**レスポンス（409 Conflict / 400 / 500）**

```json
{
  "error": "ALREADY_PAID | PAYMENT_FAILED",
  "message": "エラーメッセージ"
}
```

### POST /api/webhooks/stripe — Stripe Webhook 受信

**エンドポイント URL**: `https://monoshiri.site/api/webhooks/stripe`

**署名検証**: `STRIPE_WEBHOOK_SECRET` で `stripe.webhooks.constructEvent()` を使用

**レスポンス（200 OK）**

```json
{ "received": true }
```

**レスポンス（400）**: 署名検証失敗時

**レスポンス（500）**: 処理失敗時（Stripe が自動リトライ）

### POST /api/customer-portal — Customer Portal セッション作成

Stripe Customer Portal へのリダイレクト URL を返す。サブスクリプションの管理・解約に使用。

## Webhook イベント処理

| イベント | トリガー | 処理内容 |
|---------|---------|---------|
| `checkout.session.completed` | Embedded Checkout 決済完了 | `createSubscriptionRecord()` で DB 作成 + test_sessions を `paid` に + メール送信 |
| `invoice.payment_succeeded` | 請求成功（トライアル後の月次課金含む） | 既存レコードあり → status/period 更新。なし → `createSubscriptionRecord()` で作成（SCA フォールバック） |
| `customer.subscription.updated` | サブスクリプション変更 | status, period, canceled_at を同期 |
| `customer.subscription.deleted` | サブスクリプション削除 | status を `canceled` に更新 |
| `invoice.payment_failed` | 月次課金失敗 | status を `past_due` に更新 |

### 共通ヘルパー: `createSubscriptionRecord()`

`src/lib/subscription-helpers.ts` に定義。以下の処理を一括で行う：

1. `subscriptions` テーブルに INSERT
2. `test_sessions.status` を `paid` に UPDATE
3. 決済完了メール送信（非同期・ノンブロッキング）

Webhook（`checkout.session.completed`, `invoice.payment_succeeded`）と Wallet Pay API の3箇所から共通利用。

### 冪等性

- `subscriptions.stripe_subscription_id` の UNIQUE 制約が重複挿入を防止
- `test_sessions.status = 'paid'` への更新は冪等
- `checkout.session.completed` と `invoice.payment_succeeded` が両方発火しても安全

## useWalletPay フック

`src/lib/hooks/use-wallet-pay.ts` — Payment Request API のライフサイクルをカプセル化。

```typescript
function useWalletPay(options: {
  token: string;
  sessionId: string;
  enabled: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}): {
  canApplePay: boolean;
  canGooglePay: boolean;
  isProcessing: boolean;
  triggerWalletPay: () => void;
}
```

**内部ロジック:**

1. `stripePromise` を解決 → `stripe.paymentRequest()` で PaymentRequest を初期化
2. `canMakePayment()` で Apple Pay / Google Pay の利用可否を判定
3. `paymentmethod` イベントリスナーで `/api/wallet-pay` に送信
4. `triggerWalletPay` → `paymentRequest.show()` を呼び出し（ユーザージェスチャー内から同期的に）

**注意点:**

- `paymentRequest.show()` はクリックイベント内から同期的に呼ぶ必要がある
- コールバック ref パターンで React の再レンダリングによる Payment Request の再初期化を防止

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開鍵（`pk_live_` or `pk_test_`）。クライアントサイドで使用 |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー（`sk_live_` or `sk_test_`）。サーバーサイドで使用 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証シークレット（`whsec_`） |
| `STRIPE_PRICE_ID` | 月額 ¥5,000 の定期価格 ID（`price_`） |

**不要になった環境変数:**

| 変数名 | 理由 |
|--------|------|
| `STRIPE_TRIAL_COUPON_ID` | クーポン方式からトライアル方式に変更したため不要 |

## 決済成功後のリダイレクト

- URL: `/results/[token]?checkout=success`
- Embedded Checkout: Stripe が `return_url` にリダイレクト
- Wallet Pay: フロントエンドで `router.push()` によりリダイレクト

## バリデーション

| 項目 | ルール |
|------|--------|
| session_id | UUID 形式であること |
| token | URL 安全な文字列であること |
| セッション | email が登録済みであること |
| セッション | status が `paid` でないこと（重複決済防止） |
| payment_method_id | Wallet Pay 時のみ必須 |
| Webhook 署名 | Stripe の署名検証に通ること |

## 関連テーブル

### subscriptions

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid (PK) | サブスクリプションレコード ID |
| session_id | uuid (FK) | テストセッション ID |
| stripe_customer_id | text | Stripe 顧客 ID |
| stripe_subscription_id | text (UNIQUE) | Stripe サブスクリプション ID |
| stripe_checkout_session_id | text | Stripe Checkout セッション ID（Wallet Pay 時は null） |
| status | text | ステータス（trialing / active / canceled / past_due） |
| trial_amount | integer | トライアル金額（199） |
| recurring_amount | integer | 月額金額（5000） |
| currency | text | 通貨（jpy） |
| trial_end_at | timestamptz | トライアル終了日時 |
| current_period_start_at | timestamptz | 現在の課金期間開始日時 |
| current_period_end_at | timestamptz | 現在の課金期間終了日時 |
| canceled_at | timestamptz | 解約日時 |
| created_at | timestamptz | レコード作成日時 |
| updated_at | timestamptz | レコード更新日時 |

### test_sessions（更新対象カラム）

| カラム | 変更 |
|--------|------|
| status | `paid` に更新 |

## エラーハンドリング

| エラーケース | 処理 |
|-------------|------|
| Checkout Session 作成失敗 | 500 エラー。「決済を開始できません。」表示 |
| Wallet Pay 決済失敗 | エラーメッセージをプレビューページに表示 |
| SCA (3D Secure) 認証失敗 | 「3Dセキュア認証に失敗しました。」表示 |
| Webhook 署名検証失敗 | 400 エラーを返す。ログに記録 |
| Webhook 内の DB 更新失敗 | 500 エラーを返す。Stripe が自動リトライ |
| 重複 Webhook 受信 | `stripe_subscription_id` の UNIQUE 制約で安全に処理 |
| sessionStorage にデータなし | チェックアウトページで「プレビューに戻る」リンクを表示 |
| 既に決済済み | 409 エラー + 結果ページへのリダイレクト URL を返却 |
