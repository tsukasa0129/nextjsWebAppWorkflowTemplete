# Web アプリのメール設定：汎用手順

どの Web アプリにも使えるように、メール設定の手順をまとめる。メール・ホスティング・DB はすべて Cloudflare に統一する前提で書く。

- **送信**：Cloudflare Email Service（Email Sending）。Workers の `send_email` バインディングから送る
- **受信**：Cloudflare Email Routing。受信したメールは **`customer.support.all@gmail.com`** に転送する
- **ホスティング**：Cloudflare Workers（Next.js は OpenNext アダプター `@opennextjs/cloudflare` で載せる）
- **DB**：Cloudflare D1

> 作成: 2026-09-26 / 更新: 2026-09-30（Resend・Supabase から Cloudflare に統一）

---

## 使用ツール
Cloudflare Email Service（Email Sending + Email Routing）

## 0. 最初に決めること

| 項目 | 決めること | 目安 |
|---|---|---|
| メールの種類 | 取引メール（購入完了・ログインなど）とマーケティングメールを分ける | マーケティングメールはオプトインと配信停止が法律で必須 |
| 送信ドメイン | アプリで使用するドメイン。Cloudflare DNS で管理していること（Email Service の必須条件） | 無料ドメインや他社ドメインからは送らない |
| 送信元アドレス | `サービス名 <noreply@example.com>` | 返信を受けたいなら `replyTo` に `support@example.com` を入れる |
| 認証メール | ログイン・確認メール（マジックリンクなど）もアプリから Email Service で送る | 送信処理は 3 章の関数に集約する |
| 窓口アドレス | `support@example.com`。お問い合わせの通知先・フッターに載せる窓口 | Email Routing で `customer.support.all@gmail.com` に転送する |

---

## 1. ドメインの登録（DNS）

ドメインは Cloudflare DNS で管理する。Cloudflare 内で完結するため、送信・受信の DNS レコードは Cloudflare が自動で追加する。

### 1-1. 送信（Email Sending）

1. Cloudflare ダッシュボード → **Compute** → **Email Service** → **Email Sending** → **Onboard Domain** でドメインを選ぶ
2. 次のレコードが自動で追加される

| 種類 | 役割 | 場所 |
|---|---|---|
| MX | バウンスの受け口 | `cf-bounce.example.com` |
| SPF（TXT） | 送信を許可したサーバーを示す | `cf-bounce.example.com` |
| DKIM（TXT） | 署名で改ざんがないことを示す | `cf-bounce` 配下 |
| DMARC（TXT） | SPF・DKIM が失敗したときの扱い | `_dmarc.example.com` |

### 1-2. 受信（Email Routing）

1. **Email Service** → **Email Routing** を有効にする（ルートドメインの MX・SPF が自動で追加される）
2. **Destination Addresses** に `customer.support.all@gmail.com` を追加する
   - Cloudflare から確認メールが届くので、Gmail 側で **Verify email address** を押す。**これはユーザータスク**（Gmail にログインできるのはユーザーだけ）
   - 確認が済むまで、この宛先を使うルーティングルールは無効のまま
3. **Routing Rules** でルールを作る

| Email pattern | Action | Destination |
|---|---|---|
| `support@example.com` | Send to an email | `customer.support.all@gmail.com` |
| `noreply@example.com` | Drop（返信を受け取らない場合）または Send to an email | `customer.support.all@gmail.com` |
| Catch-all（任意） | Send to an email | `customer.support.all@gmail.com` |

- 同じパターンのルールを複数作らない（一覧で先頭のものだけが効く）。
- 受信の前にアプリ側で処理したい場合（問い合わせを DB に保存するなど）は、Action を **Send to a Worker** にし、Worker の `email()` ハンドラー内で `message.forward("customer.support.all@gmail.com")` を呼ぶ。
- Email Routing は**転送専用**で、Gmail から返信すると差出人は Gmail のアドレスになる。独自ドメインから返信したい場合は、アプリの管理画面から 3 章の関数で送る。

### 1-3. 確認と運用

- 反映は通常 5〜15 分、最大 24 時間。
- 確認コマンド：`dig MX example.com`、`dig TXT cf-bounce.example.com`、`dig TXT _dmarc.example.com`
- **DNS を後から触るとき**（サブドメインの追加など）に、これらのレコードを消さない。
- DMARC は最初 `p=none` で様子を見て、届き方が安定したら `quarantine`、`reject` と強める。Gmail・Yahoo は大量に送る送信者に DMARC を必須にしている。
- DMARC を強くしすぎると、Email Routing で転送したメールが Gmail で弾かれることがある。転送後の届き方も確認する。

---

## 2. バインディングと環境変数

Workers では API キーを使わず、`wrangler.jsonc` の `send_email` バインディングで送る。

```jsonc
{
  "send_email": [
    {
      "name": "EMAIL",
      // 送信元を自分のドメインのアドレスだけに絞る
      "allowed_sender_addresses": ["noreply@example.com", "support@example.com"]
    }
  ],
  "vars": {
    "EMAIL_FROM": "サービス名 <noreply@example.com>",
    "SUPPORT_EMAIL": "support@example.com"
  }
}
```

| 変数・バインディング | 内容 | 扱い |
|---|---|---|
| `EMAIL`（バインディング） | 送信用のバインディング | キー不要。`wrangler.jsonc` で定義 |
| `EMAIL_FROM` | `サービス名 <noreply@example.com>` | `vars`（公開してよい値） |
| `SUPPORT_EMAIL` | 窓口アドレス（`support@example.com`）。受信は `customer.support.all@gmail.com` に転送される | `vars` |

- Workers 以外（GitHub Actions のスクリプトなど）から送る場合だけ、REST API（`POST /accounts/{account_id}/email/sending/send`）を **Email Sending: Edit** 権限だけの API トークンで呼ぶ。トークンは `wrangler secret put` か CI のシークレットに入れ、チャットやリポジトリには書かない。
- ステージングは `env.staging` に別の `send_email` バインディングを定義し、`allowed_destination_addresses` でテスト用アドレス（`tsukasa240129@gmail.com`）だけに送れるようにする。
- ローカル開発（`wrangler dev`）では送信がシミュレートされ、内容はコンソールとローカルファイルに出る。実際に送る確認が必要なときだけ `"remote": true` にする。
- 環境変数の一覧（例：`docs/env-variables/env-variables.md`）に、用途・取得元・現在の値（秘密値以外）を残す。

---

## 3. 送信処理を 1 か所にまとめる

アプリのどこからでも、この関数を通して送るようにする。Next.js（OpenNext）からは `getCloudflareContext()` でバインディングを取得する。

```ts
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function sendEmail({ to, subject, html, text, idempotencyKey }: {
  to: string; subject: string; html: string; text: string; idempotencyKey: string;
}) {
  const { env } = getCloudflareContext();
  // ① 未設定なら送らずに処理を続ける（設定前でもアプリは動く）
  if (!env.EMAIL || !env.EMAIL_FROM) {
    console.warn(`[email] skipped: not configured subject=${subject}`);
    return { ok: false as const, error: "NOT_CONFIGURED" };
  }
  // ② 冪等キーで二重送信を防ぐ（D1 の email_logs に UNIQUE 制約）
  const inserted = await env.DB
    .prepare("INSERT INTO email_logs (idempotency_key, created_at) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(idempotencyKey, Date.now())
    .run();
  if (inserted.meta.changes === 0) return { ok: true as const, id: null, duplicated: true };
  // ③ 件名の改行を除く（ヘッダーインジェクション対策）
  const safeSubject = subject.replace(/[\r\n]+/g, " ").trim();
  try {
    const { messageId } = await env.EMAIL.send({
      from: env.EMAIL_FROM, to, subject: safeSubject, html, text,
      replyTo: env.SUPPORT_EMAIL,
    });
    await env.DB.prepare("UPDATE email_logs SET message_id = ?, sent_at = ? WHERE idempotency_key = ?")
      .bind(messageId, Date.now(), idempotencyKey).run();
    return { ok: true as const, id: messageId };
  } catch (e) {
    // ④ ログのアドレスは伏せる（個人情報を残さない）
    const code = (e as { code?: string }).code ?? "SEND_FAILED";
    console.error(`[email] failed to=${mask(to)} err=${code}`);
    // 失敗したら冪等キーを消して再送できるようにする
    await env.DB.prepare("DELETE FROM email_logs WHERE idempotency_key = ?").bind(idempotencyKey).run();
    return { ok: false as const, error: code }; // ⑤ 例外を投げず、呼び出し元の処理を止めない
  }
}
const mask = (e: string) => { const [l, d] = e.split("@"); return d ? `${l.slice(0, 2)}***@${d}` : "***"; };
```

主なエラーコード：`E_SENDER_NOT_VERIFIED`・`E_SENDER_DOMAIN_NOT_AVAILABLE`（ドメイン未登録）、`E_RATE_LIMIT_EXCEEDED`・`E_DAILY_LIMIT_EXCEEDED`（上限）、`E_DELIVERY_FAILED`。

**呼び出すときの決まり**
- **状態が実際に変わったときだけ送る**。例：`UPDATE ... WHERE status = 'answered'` の更新件数（`meta.changes`）が 1 件だったとき。これで再読み込みや Webhook の再送による二重送信を防げる。
- 冪等キーは `種類:対象ID`（例：`purchase-complete:{orderId}`）にする。
- 決済メールは、リダイレクト後の画面ではなく**決済サービスの Webhook を起点**に送る。
- 送信は**レスポンスを返したあと**にする（Next.js の `after()` か `ctx.waitUntil()`。大量に送るなら Cloudflare Queues）。
- 送れたら `xxx_email_sent_at` を D1 に記録しておくと、あとで調べやすい。
- 1 回の送信の宛先は `to`・`cc`・`bcc` の合計 50 件まで、添付を含めて 5 MiB まで。

---

## 4. テンプレート

- React Email で作り、`render()` で HTML とテキストに変換してから `html` / `text` に渡す。**共通レイアウト**を 1 つ用意し、各メールはその中身だけを書く。
- フッターには事業者名と問い合わせ先（`support@example.com`）を入れる（取引メールにも入れる）。
- メール内のリンクは、環境ごとの正しいドメイン（本番・ステージング）から組み立てる。リクエストのホストをそのまま信用せず、許可したドメインの一覧と照合する。
- 結果ページなどへのリンクには、推測できないトークンと署名を付ける。
- **多言語のアプリでは**、件名と本文をユーザーの言語に合わせ、`<html lang>` も切り替える。

---

## 5. 認証メール（マジックリンク・確認メール）

認証は D1 上で動く認証ライブラリ（Better Auth など）で行い、メールは 3 章の関数で送る。

1. 認証ライブラリの `sendMagicLink` / `sendVerificationEmail` などのコールバックから `sendEmail()` を呼ぶ。
2. **Base URL** を環境ごとの本番（`app.example.com`）・ステージング（`staging.example.com`）のドメインにする（`NEXT_PUBLIC_APP_URL`）。localhost のままだと、リンクが壊れる。
3. **Trusted Origins / コールバック URL** に、本番・ステージング・localhost の `/api/auth/**` を登録する。
4. リンクのトークンは短い有効期限（10〜15 分）・1 回限りにし、D1 に保存するのはハッシュだけにする。
5. 同じアドレスへの送信回数を制限する（Workers の Rate Limiting バインディングか D1 のカウンター）。

---

## 6. マーケティングメール（送る場合だけ）

- **同意はオプトインにする**。チェックボックスを用意して初期値はオフにし、同意した日時・文面の版・IP のハッシュを記録する。
- **配信停止**：署名付きリンク（`HMAC(secret, "unsub:" + email)`）を本文に入れる。あわせて `List-Unsubscribe` と `List-Unsubscribe-Post: List-Unsubscribe=One-Click` のヘッダーも `headers` で付ける（Gmail・Yahoo の大量送信者向けの要件）。
- 配信停止された宛先は、Email Service の Suppression（配信停止リスト）と D1 の両方に反映する。
- 取引メールは配信停止の対象外。取引メールに宣伝を混ぜない。
- 日本向けなら特定電子メール法、EU 向けなら GDPR、韓国向けなら情報通信網法も確認する。

---

## 7. 動作確認のチェックリスト

- [ ] Email Sending でドメインが Verified になっている
- [ ] `dig` で MX・SPF・DKIM・DMARC のレコードが見える
- [ ] すべての種類のメールをテスト用のアドレス `tsukasa240129@gmail.com` に送り、**受信トレイに届く**（迷惑メールに入らない）。届いたかは Gmail の MCP（`mcp__Gmail__search_threads` / `mcp__Gmail__get_message`）でエージェントが確認する
- [ ] SPF・DKIM・DMARC がすべて PASS になっている（`mcp__Gmail__get_message` の `RAW` で `Authentication-Results` ヘッダーを見る）
- [ ] 外部のアドレスから `support@example.com` に送ると、`customer.support.all@gmail.com` に届く（送信元は転送先と別のアカウントにする）
- [ ] メール内のリンクが正しいドメイン（本番・ステージング）を開く
- [ ] 同じ操作を 2 回しても、メールは 1 通だけ届く
- [ ] バインディングを外した環境でも、アプリの処理はエラーにならない
- [ ] ログにメールアドレスや本文がそのまま出ていない
- [ ] ステージングで送るのはテスト用のアドレスだけにしている（`allowed_destination_addresses`）

---

## 8. 運用

- **バウンス・苦情**：Email Service の Suppression リストで、以後その宛先には送らないようにする。ドメイン設定の **Drop suppressed recipients** を有効にすると、配信停止中の宛先を除いて残りに送る。
- **送信量**：ダッシュボードの Email Sending の分析で、送信数・バウンス率・上限までの残りを確認する。
- **受信**：`customer.support.all@gmail.com` が確認済みのままか、ルーティングルールが Active かを定期的に確認する。
