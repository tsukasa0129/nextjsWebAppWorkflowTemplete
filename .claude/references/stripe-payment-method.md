# Stripe決済→アプリ案内までの一環

セッション管理、ユーザー管理は基本的にCookie、クエリパラメーターベースで行う


## 概要
Stripe を利用した決済機能。月額 199 円のサブスクリプションを決済したあと、1,980 円の買い切り商品をアップセルする。

## ファネル

```
① 診断 → ② メールアドレス入力 → ③ セールスページ（¥199 サブスク決済） → ④ アップセルページ（¥1,980 買い切り） → ⑤ 結果の表示
```

| # | ページ | パス（例） | 内容 |
|---|---|---|---|
| ① | 診断 | `/diagnosis` | 設問に回答する。回答は `session_id` に紐付けて D1 に保存する |
| ② | メールアドレス入力 | `/email` | メールアドレスを登録する。決済の `customer_email` と結果のお知らせに使う |
| ③ | セールスページ | `/offer` | ¥199 の月額サブスクの決済。**診断結果は一切見せない（すべて非公開）**。結果の一部プレビューや無料結果も出さず、セールスに特化する |
| ④ | アップセルページ | `/upsell` | ③の決済後にだけ表示する。¥1,980 の買い切り商品をワンクリックで追加購入できる。「購入しない」でも⑤へ進める |
| ⑤ | 結果の表示 | `/result` | 診断結果を表示する。④で購入した場合は買い切り商品の内容も表示する |

- ③より前のページで、診断結果（タイプ名・スコア・一部の文章など）を出さない。
- ④は③の決済が確認できたユーザーだけが開ける。未決済で開いたら③へ戻す。
- ⑤は③の決済が確認できたユーザーだけが開ける。④を経由していない場合も、決済済みなら表示してよい。
- ③の決済ボタンの近くに、特定商取引法の最終確認画面として必要な表示（**月額 199 円であること・毎月自動で更新されること・解約方法**）を必ず出す。この表示は省略しない。


### Checkout 画面（③ セールスページ）
決済UIはセールスページ `/offer` の中にあり、別の決済ページには移動しません。
支払いが済むと Stripe から `/upsell` に戻り、そこでサーバーが決済を確認します。

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
┌────────────────────────────────┐
│   link で支払う          │ 
└────────────────────────────────┘
│  │  カード番号              │  │     + 送信ボタン「月額¥199で今すぐ結果を見る」
│  │  有効期限  CVC           │  │     （ネイビー背景、CreditCardアイコン付き）
│  └──────────────────────────┘  │
│  [💳 月額¥199で今すぐ結果を見る] │
└────────────────────────────────┘
月額199円（税込）・毎月自動更新・いつでも解約できます（解約方法へのリンク）
🔓お支払いは安全に暗号化されています
```


| 要素                   | 内容                                                                                                                                                              |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ExpressCheckoutElement | Apple Pay / Google Pay / Link。使える支払い方法がある端末でだけ表示し、その下に「または」の区切りが出ます                                      |
| カード入力             | アコーディオン形式。`ChevronDown` アイコンが展開時に180度回転（Framer Motion）。展開すると `CheckoutElementsProvider` + `PaymentElement` をインラインで表示。フォーム読み込み中は「準備中...」スピナー表示
- onReady の availablePaymentMethods が空なら、枠はずっと hidden のままで、カード入力だけが表示されます。 |
| 支払いボタン           | 「月額¥199で今すぐ結果を見る」。処理中はスピナーを表示し、エラーは赤いボックスに出します                                                                |
| その他                 | これらは CheckoutElementsProvider（:748）で囲まれていて、UIは locale: "ja" の日本語で表示されます（lib/stripe-client.ts）。                |

#### Express Checkout Element のオプションの制約

layout.overflow: "never" は maxRows が 0（無制限）のときだけ指定できる。maxRows を指定するなら overflow は "auto" にする。
現在の正しい値を 1 か所にまとめて書く: layout: { maxColumns: 1, maxRows: 3, overflow: "auto" }、paymentMethods: { applePay: "always", googlePay: "always" }、paymentMethodOrder: ["apple_pay", "google_pay", "link"]。
オプションを変えるときは Stripe.js の型定義（@stripe/stripe-js の express-checkout.d.ts）と公式リファレンスで制約を確認する

- **PaymentElement**: `layout: "tabs"`, `terms: { card: "never" }`,`wallets: { applePay: "never", googlePay: "never" }`（カード規約非表示）
- **送信ボタン**: bg-[#1a1f3d]（ネイビー）rounded-lg py-3.5 text-sm font-medium text-white で、CreditCard アイコンと「月額¥199で今すぐ結果を見る」の文言
- **最終確認の表示**: ボタンのすぐ下に「月額199円（税込）・毎月自動更新・いつでも解約できます」と解約方法へのリンクを出す

#### 状態別表示

| 状態 | 表示内容 |
|------|---------|
| 読み込み中 | スピナー |
| セッション未検出 | 「セッション情報が見つかりません」+ 「診断に戻る」ボタン（`bg-orange-500`） |
| メールアドレス未登録 | ②のメールアドレス入力ページにリダイレクト |
| エラー | 「エラーが発生しました」+ エラーメッセージ + 「もう一度試す」ボタン |
| 決済済み（409） | アップセルページ（アップセルを判断済みなら結果ページ）にリダイレクト |

---


## Stripe 商品構成

### 商品と料金
| 用途 | 商品名 | 継続 or 1回限り | 金額（税込） | 通貨 | Price ID |
|---|---|---|---|---|---|
| ③ サブスク | 結果レポート | 継続（毎月） | 199円 | JPY | 環境変数 `STRIPE_SUBSCRIPTION_PRICE_ID` |
| ④ アップセル | {買い切り商品名} | 1回限り | 1,980円 | JPY | 環境変数 `STRIPE_UPSELL_PRICE_ID` |

### 課金モデル

| タイミング | 金額 | 説明 |
|-----------|------|------|
| ③ 決済時 | ¥199 | 月額サブスクの初回（トライアルなし。すぐに課金する） |
| ④ アップセル購入時 | ¥1,980 | ③で保存したカードで 1 回だけ課金する（任意） |
| 以降毎月 | ¥199 | サブスクの自動更新 |


## フロー詳細
### ① 診断 → ② メールアドレス
- 診断の回答と `session_id` を D1 に保存し、`session_id` を Cookie に入れる。
- メールアドレスを登録したら③へ進める。ここではまだ結果を見せない。

### ③-1 セールスページを開くと自動で POST /api/stripe/checkout
Checkout Session を作成（`ui_mode: "elements"`, `mode: "subscription"`, `line_items: [{ price: STRIPE_SUBSCRIPTION_PRICE_ID, quantity: 1 }]`, `customer_email`, `metadata.session_id`）
client_secret を返す → Provider に渡して決済フォームを表示
すでに決済済みなら 409 → アップセルページ（判断済みなら結果ページ）へリダイレクト

[サーバー] POST /api/stripe/checkout
stripe.checkout.sessions.create({ ui_mode: "elements", mode: "subscription", ... })
返却: client_secret（とセッションID）
        │  ※ ここで作られるのは「¥199 の月額サブスク」というデータ1件だけ。UIは作らない
        ▼
[ブラウザ] offer-client.tsx
   setClientSecret(json.client_secret)
   <CheckoutElementsProvider clientSecret=...>  ← Stripe.js がセッションに接続
      <ExpressCheckoutElement />   ← 1つめの UI
      <PaymentElement />           ← 2つめの UI
   </CheckoutElementsProvider>

- サブスクの決済で使ったカードは、Stripe が顧客（Customer）のデフォルトの支払い方法として保存する。④のワンクリック購入はこのカードを使う。

### ③-2 ユーザーが支払う
カード: checkout.confirm()
Express: checkout.confirm({ expressCheckoutConfirmEvent })

### ③-3 成功すると Stripe が return_url へリダイレクト
/upsell?checkout_session_id=cs_xxx(&utm…)

### ③-4 verifyAndProcessCheckout()（`/upsell` のサーバー側で実行）
- Stripe API から Checkout Session を取得し、`status === "complete"` と `payment_status === "paid"` を確認
- サブスクの状態（`active`）を確認し、顧客とカードを紐付ける（default payment method に設定されていることを確認）
- DB: `users.plan = 'premium'`、`stripe_subscriptions` を作成（冪等キー `checkout_sub_{session_id}`、既存があれば再利用）
- 決済完了メールを送信（テストでは `tsukasa240129@gmail.com` で決済し、届いたかを Gmail の MCP で確認する）
- 確認できなければ（3D セキュアの処理中など）2 秒間隔で最大 10 回ポーリングし、それでも駄目ならエラー表示

### ④ アップセルページ（¥1,980 の買い切り）
- 表示：買い切り商品の内容・価格（¥1,980・1 回限りの支払い）と、「購入する」「購入しない（結果を見る）」の 2 つのボタン。診断結果はまだ見せない。
- 「購入する」→ POST /api/stripe/upsell
  - サーバーで PaymentIntent を作成して確定する（`amount: 1980`, `currency: "jpy"`, `customer`, `payment_method`（③で保存したデフォルト）, `off_session: true`, `confirm: true`, `metadata: { type: "upsell", session_id }`）。冪等キー `upsell_{session_id}` で二重課金を防ぐ。
  - 成功 → DB の `purchases` に記録し、購入完了メールを送って⑤へ。
  - `requires_action`（3D セキュアが必要）→ client_secret を返し、ブラウザで `stripe.handleNextAction()` を実行する。完了したら⑤へ。
  - カードエラー → エラーを表示し、「購入しないで結果を見る」を出す。
- 「購入しない」→ アップセルを判断済みとして記録し、⑤へ。
- すでに購入済みなら⑤へリダイレクトする。

### ⑤ 結果の表示
premium → 詳細結果をサーバー側で描画して表示（アップセルを購入していれば、その内容も表示する）
未決済 → ③へ戻す
ended（解約済み） → ③へ戻す




## Webhook イベント処理

| イベント | トリガー | 処理内容 |
|---------|---------|---------|
| `checkout.session.completed` | ③のサブスク決済完了 | DB 作成（未作成なら）+ status を `active` に + 決済完了メール送信 |
| `invoice.payment_succeeded` | 月次の請求成功（初回・更新） | status / period を更新 |
| `customer.subscription.updated` | サブスクリプション変更 | status, period, canceled_at を同期 |
| `customer.subscription.deleted` | サブスクリプション削除 | status を `canceled` に更新 |
| `invoice.payment_failed` | 月次課金失敗 | status を `past_due` に更新 |
| `payment_intent.succeeded` | ④のアップセル購入成功（`metadata.type === "upsell"`） | `purchases` に記録（未記録なら）+ 購入完了メール送信 |
| `payment_intent.payment_failed` | ④のアップセル購入失敗 | 失敗を記録する（課金状態は変えない） |

- ブラウザ側の処理（③-4・④）と Webhook のどちらが先に届いても、同じ結果になるようにする（`session_id` / PaymentIntent ID で冪等にする）。
