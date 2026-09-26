# Web アプリのメール設定：汎用手順

どの Web アプリにも使えるように、メール設定の手順をまとめる。Origin（このリポジトリ）の設定をもとにしており、サービス名やドメインを差し替えれば別のアプリでも使える。例は Resend と Supabase で書いているが、SendGrid・Postmark・Amazon SES、Firebase・Auth0 などでも同じ流れになる。

> 作成: 2026-09-26。このプロジェクトでの実際の値は、末尾の「このプロジェクトでの対応箇所」を参照。

---

## 使用ツール
RESEND

## 0. 最初に決めること

| 項目 | 決めること | 目安 |
|---|---|---|
| メールの種類 | 取引メール（購入完了・ログインなど）とマーケティングメールを分ける | マーケティングメールはオプトインと配信停止が法律で必須 |
| 送信ドメイン | アプリで使用するドメイン。`example.com` のようなサブドメインでもよい | 無料ドメインや他社ドメインからは送らない |
| 送信元アドレス | `サービス名 <noreply@example.com>` | 返信を受けたいなら `Reply-To` にサポート窓口を入れる |
| 認証メール | ログイン・確認メールを誰が送るか | 認証基盤（Supabase など）の標準の送信元は上限が厳しいので、Custom SMTP にする |
| 窓口アドレス | `support@example.com>`お問い合わせの通知先・フッターに載せる窓口 | 環境変数で持つ |

---

## 1. ドメインの認証（DNS）

送信サービスにドメインを登録し、表示されたレコードを DNS に追加する。

| 種類 | 役割 | 例 |
|---|---|---|
| DKIM（TXT） | 署名で改ざんがないことを示す | `resend._domainkey` → `p=MIGf...` |
| SPF（TXT） | 送信を許可したサーバーを示す | `send` → `v=spf1 include:amazonses.com ~all` |
| MX（Return-Path） | バウンスの受け口 | `send` → `feedback-smtp.<region>.amazonses.com` |
| DMARC（TXT） | SPF・DKIM が失敗したときの扱い | `_dmarc` → `v=DMARC1; p=none; rua=mailto:dmarc@example.com` |

- 値は送信サービスの画面に出たものをそのまま使う。反映には数分から最大 48 時間かかる。
- 確認コマンド：`dig TXT resend._domainkey.example.com`、`dig TXT _dmarc.example.com`
- **ホスティングの DNS を後から触るとき**（独自ドメインの追加など）に、これらのレコードを消さない。
- DMARC は最初 `p=none` で様子を見て、届き方が安定したら `quarantine`、`reject` と強める。Gmail・Yahoo は大量に送る送信者に DMARC を必須にしている。

---

## 2. API キーと環境変数

| 変数 | 内容 | 扱い |
|---|---|---|
| `EMAIL_API_KEY`（例：`RESEND_API_KEY`） | 送信用のキー | 秘密値。サーバー側でだけ読む |
| `EMAIL_FROM`（例：`RESEND_FROM_EMAIL`） | `サービス名 <noreply@example.com>` | サーバー側 |
| `SUPPORT_EMAIL` | お問い合わせの通知先 | サーバー側 |

- キーの権限は**送信だけ**（Sending access）に絞る。可能ならドメインも限定する。
- ホスティング（Vercel など）では Production と Preview に登録し、Sensitive 指定にする。
- キーは発行時にしか表示されない。チャットやリポジトリには書かず、パスワード管理ツールに保管する。
- 環境変数の一覧（例：`docs/env-variables/env-variables.md`）に、用途・取得元・現在の値（秘密値以外）を残す。

---

## 3. 送信処理を 1 か所にまとめる

アプリのどこからでも、この関数を通して送るようにする。

```ts
import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";

export async function sendEmail({ to, subject, react, idempotencyKey }: {
  to: string; subject: string; react: ReactElement; idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  // ① 未設定なら送らずに処理を続ける（開発環境・設定前でもアプリは動く）
  if (!apiKey || !from) {
    console.warn(`[email] skipped: not configured subject=${subject}`);
    return { ok: false as const, error: "NOT_CONFIGURED" };
  }
  // ② 件名の改行を除く（ヘッダーインジェクション対策）
  const safeSubject = subject.replace(/[\r\n]+/g, " ").trim();
  try {
    const { data, error } = await new Resend(apiKey).emails.send(
      { from, to, subject: safeSubject, react },
      idempotencyKey ? { idempotencyKey } : undefined, // ③ 冪等キーで二重送信を防ぐ
    );
    // ④ ログのアドレスは伏せる（個人情報を残さない）
    if (error) { console.error(`[email] failed to=${mask(to)} err=${error.name}`); return { ok: false as const, error: error.name }; }
    return { ok: true as const, id: data?.id ?? null };
  } catch {
    console.error(`[email] failed to=${mask(to)}`);
    return { ok: false as const, error: "SEND_FAILED" }; // ⑤ 例外を投げず、呼び出し元の処理を止めない
  }
}
const mask = (e: string) => { const [l, d] = e.split("@"); return d ? `${l.slice(0, 2)}***@${d}` : "***"; };
```

**呼び出すときの決まり**
- **状態が実際に変わったときだけ送る**。例：`UPDATE ... WHERE status = 'answered'` の更新件数が 1 件だったとき。これで再読み込みや Webhook の再送による二重送信を防げる。
- 冪等キーは `種類:対象ID`（例：`purchase-complete:{orderId}`）にする。
- 決済メールは、リダイレクト後の画面ではなく**決済サービスの Webhook を起点**に送る。
- 送信は**レスポンスを返したあと**にする（Next.js の `after()`、キュー、バックグラウンドジョブなど）。
- 送れたら `xxx_email_sent_at` を DB に記録しておくと、あとで調べやすい。

---

## 4. テンプレート

- React Email や MJML で作る。**共通レイアウト**を 1 つ用意し、各メールはその中身だけを書く。
- フッターには事業者名と問い合わせ先を入れる（取引メールにも入れる）。
- メール内のリンクは、環境ごとの正しいドメイン（本番・ステージング）から組み立てる。リクエストのホストをそのまま信用せず、許可したドメインの一覧と照合する。
- 結果ページなどへのリンクには、推測できないトークンと署名を付ける。
- **多言語のアプリでは**、件名と本文をユーザーの言語に合わせ、`<html lang>` も切り替える。

---

## 5. 認証メール（マジックリンク・確認メール）

Supabase の例。他の認証基盤にも同じ項目がある。

1. **Site URL** を本番のドメインにする。初期値の localhost のままだと、リンクが壊れる。
2. **Redirect URLs** に、本番・ステージング・プレビュー（ワイルドカード）・localhost の `/auth/callback**` を登録する。
3. **テンプレート**のリンクを、アプリのドメインを経由する形にする。例：`{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   - アプリのコールバック側は、`code`（標準の形式）と `token_hash`（上の形式）の両方を受け付けるようにする。
4. **Custom SMTP**：接続先は `smtp.resend.com:465`、ユーザー名は `resend`、パスワードは API キー。送信元はアプリ本体と同じにする。
5. **Rate Limits** の送信上限を、見込みのユーザー数に合わせて上げる。

---

## 6. マーケティングメール（送る場合だけ）

- **同意はオプトインにする**。チェックボックスを用意して初期値はオフにし、同意した日時・文面の版・IP のハッシュを記録する。
- **配信停止**：署名付きリンク（`HMAC(secret, "unsub:" + email)`）を本文に入れる。あわせて `List-Unsubscribe` と `List-Unsubscribe-Post: List-Unsubscribe=One-Click` のヘッダーも付ける（Gmail・Yahoo の大量送信者向けの要件）。
- 配信停止された宛先は、送信サービスの Suppression（配信停止リスト）と自分の DB の両方に反映する。
- 取引メールは配信停止の対象外。取引メールに宣伝を混ぜない。
- 日本向けなら特定電子メール法、EU 向けなら GDPR、韓国向けなら情報通信網法も確認する。

---

## 7. 動作確認のチェックリスト

- [ ] 送信サービスでドメインが Verified になっている
- [ ] `dig` で DKIM・SPF・DMARC のレコードが見える
- [ ] すべての種類のメールをテスト用のアドレスに送り、**受信トレイに届く**（迷惑メールに入らない）
- [ ] Gmail の「メッセージのソースを表示」で SPF・DKIM・DMARC がすべて PASS になっている
- [ ] メール内のリンクが正しいドメイン（本番・ステージング）を開く
- [ ] 同じ操作を 2 回しても、メールは 1 通だけ届く
- [ ] API キーを外した環境でも、アプリの処理はエラーにならない
- [ ] ログにメールアドレスや本文がそのまま出ていない
- [ ] ステージングで送るのはテスト用のアドレスだけにしている

---

## 8. 運用

- **バウンス・苦情**：送信サービスの Webhook（`email.bounced` / `email.complained`）を受け取り、以後その宛先には送らないようにする。