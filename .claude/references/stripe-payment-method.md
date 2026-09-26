# メール登録→Stripe決済→アプリ案内までの一環

セッション管理、ユーザー管理は基本的にCookieベースで行う


## 概要
Stripe Subscriptions を利用した決済機能。初回199円のワンタイム課金 + 3日間トライアル後に月額6,600円のサブスクリプションへ自動移行する。


### Checkout 画面
決済UIは無料結果ページ `/preview`の中にあり、別の決済ページには移動しません。
支払いが済むと Stripe から `/result` に戻り、そこでサーバーが決済を確認して、月額サブスクを作成します。

#### レイアウト

Stripe Custom Checkout（ui_mode: "elements"）を使用。
上から順に3つのボタンが縦並びで配置される:

```
┌────────────────────────────────┐
│    Apple Pay で支払う               │  ← Apple Pay（ボタンは ExpressCheckoutElement が描画する Stripe 標準のもの）
└────────────────────────────────┘
┌────────────────────────────────┐
│   Google Pay で支払う          │  ← Google Pay（ボタンは ExpressCheckoutElement が描画する Stripe 標準のもの）
└────────────────────────────────┘
ーーーーーーーーーまたはーーーーーーーーーーー
┌────────────────────────────────┐
│ 💳 クレジットカードまたはデビットカード ▼ │  ← アコーディオントグル → インラインカード入力フォーム表示
├────────────────────────────────┤
│  ┌──────────────────────────┐  │  ← 展開時: Stripe PaymentElement（タブレイアウト）
│  │  カード番号              │  │     + 送信ボタン「¥199で今すぐ結果を見る」
│  │  有効期限  CVC           │  │     （ネイビー背景、CreditCardアイコン付き）
│  └──────────────────────────┘  │
│  [💳 ¥199で今すぐ結果を見る]   │
└────────────────────────────────┘
🔓お支払いは安全に暗号化されています
```


| 要素                   | 内容                                                                                                                                                              |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ExpressCheckoutElement | Apple Pay / Google Pay / Link。使える支払い方法がある端末でだけ表示し、その下に「または」の区切りが出ます                                      |
| カード入力             | アコーディオン形式。`ChevronDown` アイコンが展開時に180度回転（Framer Motion）。展開すると `CheckoutElementsProvider` + `PaymentElement` をインラインで表示。フォーム読み込み中は「準備中...」スピナー表示
- onReady の availablePaymentMethods が空なら、枠はずっと hidden のままで、カード入力だけが表示されます。 |
| 支払いボタン           | 「¥199で今すぐ結果を見る」。処理中はスピナーを表示し、エラーは赤いボックスに出します                                                                |
| その他                 | これらは CheckoutElementsProvider（:748）で囲まれていて、UIは locale: "ja" の日本語で表示されます（lib/stripe-client.ts）。                |


- **PaymentElement**: `layout: "tabs"`, `terms: { card: "never" }`,`wallets: { applePay: "never", googlePay: "never" }`（カード規約非表示）
- **送信ボタン**: bg-[#1a1f3d]（ネイビー）rounded-lg py-3.5 text-sm font-medium text-white で、CreditCard アイコンと「¥199で今すぐ結果を見る」の文言

#### 状態別表示

| 状態 | 表示内容 |
|------|---------|
| 読み込み中 | スピナー |
| セッション未検出 | 「セッション情報が見つかりません」+ 「プレビューに戻る」ボタン（`bg-orange-500`） |
| エラー | 「エラーが発生しました」+ エラーメッセージ + 「プレビューに戻る」ボタン |
| 決済済み（409） | 結果ページにリダイレクト |

---


## Stripe 商品構成

### 商品
| 項目 | 値 |
|------|-----|
| 商品名 | 結果レポート |

### 料金
| 項目 | 値 |
|------|-----|
| 継続or1回限り | 継続 |
| 月額料金 | 6,600円（税込） |
| 通貨 | JPY |
| Price ID | 環境変数 `STRIPE_SUBSCRIPTION_PRICE_ID` で管理 |

| 項目 | 値 |
| 継続or1回限り | 1回限り |
| 月額料金 | 199円（税込） |
| 通貨 | JPY |
| Price ID | 環境変数 `STRIPE_ONETIME_PRICE_ID` で管理 |

### 課金モデル

| タイミング | 金額 | 説明 |
|-----------|------|------|
| 決済時（初回） | ¥199 | ワンタイム料金（`price_data` でインライン定義） |
| 3日後 | ¥6,600 | 月額サブスクリプション開始（`trial_period_days: 3` で制御） |
| 以降毎月 | ¥6,600 | 自動更新 |





## フロー詳細
### ① ページを開くと自動で POST /api/stripe/checkout
Checkout Session を作成（mode: payment, ¥199, customer_email,setup_future_usage: off_session, metadata.session_id）
client_secret を返す → Provider に渡して決済フォームを表示
すでに premium なら 409 → result ページへリダイレクト

[サーバー] POST /api/stripe/checkout
stripe.checkout.sessions.create({ ui_mode: "elements", mode: "payment", ... })
返却: client_secret（とセッションID）
        │  ※ ここで作られるのは「¥199の決済」というデータ1件だけ。UIは作らない
        ▼
[ブラウザ] free-result-client.tsx
   setClientSecret(json.client_secret)          (:447)
   <CheckoutElementsProvider clientSecret=...>  (:748)  ← Stripe.js がセッションに接続
      <ExpressCheckoutElement />   (:188)  ← 1つめの UI
      <PaymentElement />           (:235)  ← 2つめの UI
   </CheckoutElementsProvider>

### ② ユーザーが支払う
カード: checkout.confirm()
Express: checkout.confirm({ expressCheckoutConfirmEvent })

### ③ 成功すると Stripe が return_url へリダイレクト
/result?checkout_session_id=cs_xxx(&utm…)
[result ページ（サーバー側、page.tsx）]


### ④ verifyAndProcessCheckout()（lib/subscription-helpers.ts:309）
- Stripe API から Checkout Session を取得し、payment_status === "paid" を確認
- 顧客とカードを紐付け（default payment method に設定）
- 月額サブスクを作成: STRIPE_PRICE_MONTHLY, trial_period_days: 3
  （冪等キー checkout_sub_{session_id}、既存のサブスクがあれば再利用）
- DB: users.plan = 'premium'、stripe_subscriptions を作成
- Resend で決済完了メール（トライアル終了日つき）を送信

#### ⑤ 結果によって分岐
  premium → 詳細結果をサーバー側で描画して表示
  pending（3Dセキュアの処理中など） → クライアントが 2秒間隔で最大5回ポーリング
  ended（解約済み） → 無料ページへ戻す

### ⑥ クライアントで GA の purchase イベントを1回だけ送信


## Webhook イベント処理

| イベント | トリガー | 処理内容 |
|---------|---------|---------|
| `checkout.session.completed` | Embedded Checkout 決済完了 | `createSubscriptionRecord()` で DB 作成 + statusを `trial` に + メール送信 |
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
