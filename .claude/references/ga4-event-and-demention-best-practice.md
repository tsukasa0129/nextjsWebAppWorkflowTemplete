# GA4 イベント設計・ユーザープロパティ・イベントパラメーター・ディメンション設計 ベストプラクティス
以下のベストプラクティスに従って
最終更新日: 2026-05-14  
対象: GA4（Google Analytics 4）標準プロパティを前提。Google Analytics 360 は一部上限が異なる。
計測タグの実装はGTMにて行います

---

## 1. 設計の基本方針

GA4の設計は、まず「何を意思決定したいか」から逆算する。イベントやパラメーターを先に増やすのではなく、以下の順で設計する。

1. 分析・施策の目的を定義する
2. 目的に必要なユーザー行動をイベント化する
3. 行動の文脈をイベントパラメーターで補足する
4. ユーザーの安定した属性をユーザープロパティで管理する
5. レポートや探索で使うものだけをカスタムディメンション・カスタム指標に登録する
6. BigQueryでしか使わない高粒度データは、GA4 UIのカスタム定義に登録しない選択肢も検討する

GA4では、イベントパラメーターやユーザープロパティを送信しただけでは通常レポートで自由に使えるわけではない。GA4 UIで分析・広告利用したい場合は、カスタムディメンションまたはカスタム指標として登録する。登録後、利用可能になるまで24〜48時間程度かかることがある。

**参考ソース**

- Google Analytics Help: About custom dimensions and metrics  
  https://support.google.com/analytics/answer/14240153
- Google for Developers: Set up events  
  https://developers.google.com/analytics/devguides/collection/ga4/events

---

## 2. イベント設計の優先順位

GA4のイベントは、以下の優先順位で設計する。

### 2.1 自動収集イベントを確認する

まず、GA4が自動で収集するイベントを確認する。すでに収集されているイベントを重複して実装しない。

例:

- `page_view`
- `session_start`
- `first_visit`
- `user_engagement`

**参考ソース**

- Google Analytics Help: Automatically collected events  
  https://support.google.com/analytics/answer/9234069

### 2.2 拡張計測イベントを確認する

Webデータストリームでは、拡張計測によりスクロール、離脱クリック、サイト内検索、動画エンゲージメント、ファイルダウンロードなどをコード変更なしで計測できる場合がある。

拡張計測を有効化する前に、収集されるイベントとパラメーターを確認し、PII（個人を特定できる情報）がURLや検索語句などに含まれないようにする。

**参考ソース**

- Google Analytics Help: Enhanced measurement events  
  https://support.google.com/analytics/answer/9216061

### 2.3 推奨イベントを優先する

GA4には業種・用途別の推奨イベントがある。該当する行動がある場合は、独自イベント名よりも推奨イベント名と推奨パラメーターを優先する。

例:

- EC: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`
- リード獲得: `generate_lead`
- ログイン・登録: `login`, `sign_up`
- 検索: `search`

推奨イベントを使うことで、GA4の標準レポート、広告連携、将来的な機能対応との互換性を保ちやすい。

**参考ソース**

- Google for Developers: Recommended events  
  https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- Google Analytics Help: Recommended events  
  https://support.google.com/analytics/answer/9267735

### 2.4 それでも足りない場合だけカスタムイベントを作る

自動収集・拡張計測・推奨イベントで表現できない行動のみ、カスタムイベントとして設計する。

良い例:

- `signup_newsletter`
- `submit_contact_form`
- `click_pricing_cta`
- `complete_onboarding_step`

避けたい例:

- `click`
- `button_click`
- `event_1`
- `test_event`
- `lp_cv_20240514`

イベント名は「何が起きたか」を動詞 + 目的語で表す。キャンペーン名、日付、ID、A/Bテスト名など、変動しやすい情報はイベント名に入れず、イベントパラメーターに分離する。

---

## 3. イベント命名ルール

### 3.1 命名規則

推奨ルール:

- 小文字のスネークケースに統一する
- 先頭は英字にする
- スペース、ハイフン、記号を使わない
- 大文字小文字の違いで別イベントになるため、大文字は使わない
- 意味が重複するイベント名を作らない
- 40文字以内に収める

例:

| 良いイベント名 | 悪いイベント名 | 理由 |
|---|---|---|
| `submit_contact_form` | `Submit Contact Form` | スペース・大文字を含む |
| `click_pricing_cta` | `click-pricing-cta` | ハイフンを含む |
| `complete_onboarding_step` | `onboarding_step_202405` | 日付・期間をイベント名に含む |
| `generate_lead` | `lead_cv` | 推奨イベントがある場合は推奨名を優先 |

### 3.2 Googleのルール

Googleのイベント名ルールでは、イベント名は大文字小文字を区別し、先頭は文字、使用できる文字は文字・数字・アンダースコアで、スペースは使わない。また、予約済みの接頭辞やイベント名は使えない。

**参考ソース**

- Google Analytics Help: Event naming rules  
  https://support.google.com/analytics/answer/13316687

---

## 4. イベントパラメーター設計

イベントパラメーターは「そのイベントがどのような文脈で発生したか」を表す。

### 4.1 パラメーターに入れるべき情報

- クリック対象の種類
- CTAの位置
- フォーム種別
- コンテンツカテゴリ
- 検索条件
- エラー種別
- ステップ番号
- 商品・プラン・機能カテゴリ
- 成功・失敗ステータス

例:

```js
gtag('event', 'submit_contact_form', {
  form_id: 'contact_main',
  form_type: 'inquiry',
  form_location: 'footer',
  result: 'success'
});
```

### 4.2 パラメーターに入れない方がよい情報

- メールアドレス
- 電話番号
- 氏名
- 住所
- ユーザー名
- 具体的な問い合わせ本文
- セッションID
- リクエストID
- タイムスタンプ
- URLクエリに含まれる個人情報
- 値の種類が非常に多い一意ID

Googleは、GAにPIIを送信しないよう求めている。メールアドレス、電話番号、社会保障番号などはPIIの例として挙げられている。また、URLやページタイトル、検索ボックス、フォーム入力値にPIIが混入しやすい点にも注意する。

**参考ソース**

- Google Analytics Help: Best practices to avoid sending Personally Identifiable Information  
  https://support.google.com/analytics/answer/6366371
- Google Analytics Help: Understanding PII in Google's contracts and policies  
  https://support.google.com/analytics/answer/7686480

### 4.3 パラメーター命名ルール

推奨ルール:

- 小文字のスネークケース
- 意味が明確な名前
- イベントをまたいで同じ意味なら同じ名前を使う
- 同じ名前で別の意味を持たせない
- Booleanは `is_` または値を `true` / `false` に統一する
- カテゴリ値は英数字・スネークケースなどに正規化する

例:

| 用途 | 推奨パラメーター名 | 値の例 |
|---|---|---|
| CTAの位置 | `cta_location` | `hero`, `footer`, `pricing_card` |
| CTAの種類 | `cta_type` | `primary`, `secondary`, `text_link` |
| フォーム種別 | `form_type` | `contact`, `document_request`, `trial` |
| 結果 | `result` | `success`, `failure` |
| エラー種別 | `error_type` | `validation`, `network`, `server` |
| ステップ | `step_number` | `1`, `2`, `3` |
| コンテンツ種別 | `content_type` | `article`, `case_study`, `whitepaper` |

### 4.4 イベントパラメーターの上限

標準プロパティでは、イベントパラメーターは1イベントあたり25個まで。イベントパラメーター名は40文字まで、イベントパラメーター値は原則100文字まで。例外として、`page_title` は300文字、`page_referrer` は420文字、`page_location` は1,000文字まで。

**参考ソース**

- Google Analytics Help: Event collection limits  
  https://support.google.com/analytics/answer/9267744

---

## 5. ユーザープロパティ設計

ユーザープロパティは「ユーザーに紐づく比較的安定した属性」を表す。イベントのたびに変わる行動文脈は、ユーザープロパティではなくイベントパラメーターにする。

### 5.1 ユーザープロパティに向いている情報

- 会員ランク
- 契約プラン
- ログイン状態
- 顧客種別
- 利用言語
- 初回登録チャネルの分類
- B2B/B2C区分
- 業種カテゴリ
- 会社規模カテゴリ

例:

```js
gtag('set', 'user_properties', {
  account_type: 'free',
  customer_segment: 'smb',
  login_status: 'logged_in'
});
```

### 5.2 ユーザープロパティに向かない情報

- ページURL
- クリックしたボタン
- 直近の検索語句
- セッションごとの状態
- 一意のユーザーIDそのもの
- メールアドレス、電話番号、氏名などのPII
- 毎回変わる時刻・タイムスタンプ

ユーザーIDを分析したい場合でも、User IDをカスタムディメンションとして登録するのは避ける。高カーディナリティになりやすく、レポート品質に悪影響を与える可能性がある。ユーザー識別にはGA4のUser-ID機能を使う。

**参考ソース**

- Google Analytics Help: Best practices for User-ID  
  https://support.google.com/analytics/answer/12675187
- Google Analytics Help: Measure activity across platforms with User-ID  
  https://support.google.com/analytics/answer/9213390

### 5.3 ユーザープロパティの上限

標準プロパティでは、ユーザープロパティはプロパティあたり25個まで。ユーザープロパティ名は24文字まで、値は36文字まで。

**参考ソース**

- Google Analytics Help: Event collection limits  
  https://support.google.com/analytics/answer/9267744

---

## 6. カスタムディメンション・カスタム指標の設計

### 6.1 スコープの選び方

| スコープ | 元データ | 使いどころ |
|---|---|---|
| ユーザースコープ | ユーザープロパティ | 会員ランク、契約プラン、顧客種別など |
| イベントスコープ | イベントパラメーター | CTA位置、フォーム種別、検索条件、エラー種別など |
| アイテムスコープ | ecommerceイベントの `items` 配列内パラメーター | 商品色、サイズ、ブランド独自カテゴリなど |
| カスタム指標 | 数値イベントパラメーター | 金額、回数、スコア、所要時間など |

カテゴリ値やラベルはカスタムディメンション、数値として集計したい値はカスタム指標にする。

**参考ソース**

- Google Analytics Help: About custom dimensions and metrics  
  https://support.google.com/analytics/answer/14240153
- Google Analytics Help: Create item-scoped custom dimensions  
  https://support.google.com/analytics/answer/14239695

### 6.2 カスタム定義の上限

標準プロパティの主な上限:

| 種別 | 標準プロパティ上限 | 360上限 |
|---|---:|---:|
| ユーザースコープ カスタムディメンション | 25 | 100 |
| イベントスコープ カスタムディメンション | 50 | 125 |
| アイテムスコープ カスタムディメンション | 10 | 25 |
| カスタム指標 | 50 | 125 |
| 計算指標 | 5 | 50 |

上限に近づいたら、重複定義・使われていない定義・既存ディメンションで代替できる定義を整理する。削除後に新規追加できるまで48時間待つ必要がある場合がある。

**参考ソース**

- Google Analytics Help: About custom dimensions and metrics  
  https://support.google.com/analytics/answer/14240153
- Google Analytics Help: Configuration limits  
  https://support.google.com/analytics/answer/12229528

### 6.3 カスタムディメンションに登録すべきもの

- GA4 UIのレポートや探索で頻繁に使う
- セグメント・オーディエンス条件に使う
- 広告連携・リマーケティングに使う
- 値の種類が管理可能
- 事業KPIと紐づく

### 6.4 登録しない選択肢を検討すべきもの

- ユーザーID
- セッションID
- リクエストID
- タイムスタンプ
- URL全文
- 検索語句全文
- フリーテキスト
- エラー詳細メッセージ全文
- 1ユーザー・1イベントごとにほぼ一意になる値

高カーディナリティのデータをどうしても保持したい場合は、イベントパラメーターやユーザープロパティとして送信しつつ、GA4 UIのカスタムディメンションには登録せず、BigQuery、オーディエンス、セグメントなどでの利用を検討する。

**参考ソース**

- Google Analytics Help: About the (other) row  
  https://support.google.com/analytics/answer/13331684
- Google Analytics Help: Cardinality  
  https://support.google.com/analytics/answer/12226705

---

## 7. 高カーディナリティ対策

高カーディナリティとは、ディメンションの値の種類が非常に多い状態を指す。GA4では、500種類を超える値を持つディメンションは高カーディナリティと考える目安が示されている。高カーディナリティのディメンションは、レポートで `(other)` 行に集約されるリスクを高める。

### 7.1 避けるべき設計

| 避ける設計 | 理由 | 代替 |
|---|---|---|
| `user_id` をカスタムディメンション登録 | ほぼ一意で高カーディナリティ | User-ID機能 |
| `session_id` を登録 | セッションごとに一意 | BigQueryで分析 |
| `timestamp` を登録 | 値が増え続ける | GA4標準の時刻ディメンション |
| URL全文を登録 | URL数・パラメーター数が多い | URLを正規化、カテゴリ化 |
| 検索語句全文を登録 | ロングテール化しやすい | 検索カテゴリ、検索結果有無 |
| エラーメッセージ全文 | 種類が爆発しやすい | `error_type`, `error_code` |

### 7.2 推奨対策

- 値をカテゴリ化する
- IDではなく種別を送る
- テキスト全文ではなく分類ラベルを送る
- URLクエリを除去・正規化する
- カスタムディメンション登録前に想定ユニーク数を確認する
- 既存ディメンションで代替できないか確認する
- レポート用途がない値はGA4 UIに登録しない

---

## 8. ECイベント設計

ECサイトや課金導線では、GA4の推奨ECイベントを優先する。

代表的なイベント:

| 行動 | 推奨イベント |
|---|---|
| 商品一覧表示 | `view_item_list` |
| 商品詳細表示 | `view_item` |
| カート追加 | `add_to_cart` |
| カート削除 | `remove_from_cart` |
| 購入手続き開始 | `begin_checkout` |
| 支払い情報追加 | `add_payment_info` |
| 配送情報追加 | `add_shipping_info` |
| 購入完了 | `purchase` |
| 返金 | `refund` |

商品単位の情報は、イベント直下のパラメーターではなく、`items` 配列に入れる。色、サイズ、独自カテゴリなど、商品単位の独自属性を分析したい場合は、アイテムスコープのカスタムディメンションを検討する。

**参考ソース**

- Google for Developers: Measure ecommerce  
  https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google for Developers: Recommended events  
  https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- Google Analytics Help: Create item-scoped custom dimensions  
  https://support.google.com/analytics/answer/14239695

---

## 9. キーイベント設計

GA4では、重要なイベントをキーイベントとしてマークする。キーイベントは、事業成果または重要なマイクロコンバージョンに限定する。

例:

| 種別 | イベント例 |
|---|---|
| 成果 | `purchase`, `generate_lead`, `sign_up` |
| 商談・問い合わせ | `submit_contact_form`, `book_demo` |
| 重要なマイクロCV | `begin_checkout`, `start_trial`, `download_whitepaper` |

避けるべき設計:

- ほぼすべてのクリックをキーイベントにする
- ページビューを大量にキーイベント化する
- 成果と関係が薄いイベントをキーイベント化する
- 同じ成果を複数イベントで重複してキーイベント化する

---

## 10. 実装・検証フロー

### 10.1 実装前

- 計測目的を整理する
- イベント一覧を作る
- 各イベントの発火条件を定義する
- パラメーター名・値の仕様を決める
- ユーザープロパティを定義する
- カスタムディメンション登録対象を決める
- PII混入リスクを確認する
- 高カーディナリティリスクを確認する
- 命名規則・予約語違反がないか確認する

### 10.2 実装時

- GTMまたはgtag.jsでイベントを送信する
- 同一イベントが二重発火しないよう確認する
- SPAではページビュー・履歴変更の扱いを確認する
- 同意管理を導入している場合は、Consent Modeやタグ発火条件を確認する
- 本番環境とステージング環境を分けて検証する

### 10.3 実装後

- Realtimeでイベント発火を確認する
- DebugViewでパラメーターを確認する
- 必要なパラメーターをカスタムディメンション・カスタム指標に登録する
- 登録後24〜48時間後に探索で利用できるか確認する
- `(not set)`、`(other)`、重複イベント、想定外の値を確認する
- 1〜2週間後に実データでユニーク値数とレポート品質を確認する

**参考ソース**

- Google for Developers: Set up events  
  https://developers.google.com/analytics/devguides/collection/ga4/events
- Google Analytics Help: About custom dimensions and metrics  
  https://support.google.com/analytics/answer/14240153

---

## 11. イベント設計テンプレート

以下の表をスプレッドシートなどで管理する。

| 項目 | 内容 |
|---|---|
| イベント名 | `submit_contact_form` |
| イベント種別 | 推奨 / カスタム |
| 目的 | 問い合わせフォーム送信を計測 |
| 発火条件 | フォーム送信成功時 |
| キーイベント | Yes / No |
| 送信タイミング | 成功レスポンス受信後 |
| 重複防止条件 | 同一送信IDでは1回のみ |
| 関連ページ | `/contact/` |
| 実装方法 | GTM / gtag.js / Firebase |
| 検証方法 | DebugView, Realtime |
| オーナー | マーケ / 開発 / 分析 |
| 備考 | バリデーションエラー時は別イベント |

### パラメーター設計テンプレート

| イベント名 | パラメーター名 | 型 | 必須 | 値の例 | カスタム定義 | スコープ | 注意点 |
|---|---|---|---|---|---|---|---|
| `submit_contact_form` | `form_type` | string | Yes | `contact` | Yes | Event | 値は定義済みリストから選択 |
| `submit_contact_form` | `form_location` | string | No | `footer` | Yes | Event | 高カーディナリティ化しない |
| `submit_contact_form` | `result` | string | Yes | `success` | Yes | Event | `success` / `failure` に統一 |
| `submit_contact_form` | `error_type` | string | No | `validation` | No | Event | エラー全文は送らない |

### ユーザープロパティ設計テンプレート

| プロパティ名 | 型 | 値の例 | 更新タイミング | カスタム定義 | 注意点 |
|---|---|---|---|---|---|
| `account_type` | string | `free`, `paid` | ログイン時・プラン変更時 | Yes | PIIを含めない |
| `customer_segment` | string | `smb`, `enterprise` | ログイン時 | Yes | 値をカテゴリ化 |
| `login_status` | string | `logged_in`, `guest` | ページ表示時 | Yes | セッション状態と混同しない |

---

## 12. レビュー用チェックリスト

### イベント

- [ ] 自動収集イベントと重複していない
- [ ] 拡張計測イベントと重複していない
- [ ] 推奨イベントで表現できる場合は推奨イベントを使っている
- [ ] イベント名が小文字スネークケースになっている
- [ ] イベント名に日付、ID、キャンペーン名、テスト名を含めていない
- [ ] イベント名が40文字以内
- [ ] イベント名が予約語・予約接頭辞に該当しない
- [ ] 二重発火しない条件を定義している

### イベントパラメーター

- [ ] 1イベント25個以内
- [ ] パラメーター名が40文字以内
- [ ] 値が原則100文字以内
- [ ] 同じ意味のパラメーター名をイベント横断で統一している
- [ ] ID・タイムスタンプ・自由入力文を安易に送っていない
- [ ] 高カーディナリティになりそうな値をカテゴリ化している
- [ ] PIIが含まれていない

### ユーザープロパティ

- [ ] プロパティあたり25個以内
- [ ] 名前が24文字以内
- [ ] 値が36文字以内
- [ ] 比較的安定したユーザー属性だけを設定している
- [ ] ユーザーIDそのものをカスタムディメンション登録していない
- [ ] PIIが含まれていない

### カスタムディメンション・カスタム指標

- [ ] 既存ディメンション・指標で代替できない
- [ ] レポート、探索、オーディエンス、広告連携で使う目的がある
- [ ] 高カーディナリティではない
- [ ] スコープが正しい
- [ ] 重複定義していない
- [ ] 上限に余裕がある
- [ ] BigQueryだけで使う値をむやみに登録していない

---

## 13. 参考ソース一覧

- Google Analytics Help: About custom dimensions and metrics  
  https://support.google.com/analytics/answer/14240153
- Google Analytics Help: Event collection limits  
  https://support.google.com/analytics/answer/9267744
- Google Analytics Help: Configuration limits  
  https://support.google.com/analytics/answer/12229528
- Google Analytics Help: Event naming rules  
  https://support.google.com/analytics/answer/13316687
- Google Analytics Help: Automatically collected events  
  https://support.google.com/analytics/answer/9234069
- Google Analytics Help: Enhanced measurement events  
  https://support.google.com/analytics/answer/9216061
- Google Analytics Help: Recommended events  
  https://support.google.com/analytics/answer/9267735
- Google Analytics Help: Custom events  
  https://support.google.com/analytics/answer/12229021
- Google Analytics Help: About the (other) row  
  https://support.google.com/analytics/answer/13331684
- Google Analytics Help: Cardinality  
  https://support.google.com/analytics/answer/12226705
- Google Analytics Help: Best practices to avoid sending Personally Identifiable Information  
  https://support.google.com/analytics/answer/6366371
- Google Analytics Help: Understanding PII in Google's contracts and policies  
  https://support.google.com/analytics/answer/7686480
- Google Analytics Help: Best practices for User-ID  
  https://support.google.com/analytics/answer/12675187
- Google Analytics Help: Measure activity across platforms with User-ID  
  https://support.google.com/analytics/answer/9213390
- Google for Developers: Set up events  
  https://developers.google.com/analytics/devguides/collection/ga4/events
- Google for Developers: Set up event parameters  
  https://developers.google.com/analytics/devguides/collection/ga4/event-parameters
- Google for Developers: Recommended events  
  https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- Google for Developers: Measure ecommerce  
  https://developers.google.com/analytics/devguides/collection/ga4/ecommerce

---

## 14. 運用ルール案

- イベント追加は、目的・発火条件・パラメーター・カスタム定義要否を記載したうえでレビューする
- 命名規則に反するイベント・パラメーターは実装しない
- PII混入の可能性がある値は送信前に除去またはマスキングする
- カスタムディメンションは月1回棚卸しする
- `(other)` が出た場合は、高カーディナリティのカスタムディメンションを優先的に見直す
- 新規イベントはDebugViewで検証してから本番反映する
- 設計書と実装内容がズレた場合は、実装ではなく設計書を正として修正する
















