/**
 * GA4 Admin API セットアップスクリプト — IQテストアプリ
 *
 * 機能:
 *   1. GA4 アカウント選択
 *   2. プロパティ選択（なければ新規作成）
 *   3. データストリーム確認（なければ新規作成）
 *   4. デフォルト設定（Googleシグナル有効化、データ保持14ヶ月）
 *   5. キーイベント作成
 *   6. カスタムディメンション作成（イベントスコープ + ユーザースコープ）
 *   7. カスタム指標作成
 *   8. サマリー出力
 *
 * 前提:
 *   - npm install googleapis
 *   - GCP プロジェクトで OAuth 2.0 クライアントを作成済み
 *   - 承認済みリダイレクト URI に http://localhost:3939/oauth2callback を設定済み
 *
 * 使い方:
 *   node docs/functional-requirements/analytics/scripts/setup-ga4.mjs
 */

import { google } from 'googleapis';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CALLBACK_PORT = 3939;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit',
];

const OAUTH_CLIENT_PATH =
  process.env.GA4_AND_GTM_OAUTH_CLIENT_DESKTOP_PATH ||
  path.join(__dirname, 'oauth-client.json');

const TOKEN_PATH =
  process.env.GA4_OAUTH_TOKEN_DESKTOP_PATH ||
  path.join(__dirname, '.ga4-token.json');

// ---------------------------------------------------------------------------
// IQテストアプリ用設定値
// ---------------------------------------------------------------------------

const KEY_EVENTS = [
  { eventName: 'generate_lead', countingMethod: 'ONCE_PER_EVENT' },
  { eventName: 'begin_checkout', countingMethod: 'ONCE_PER_EVENT' },
  { eventName: 'purchase', countingMethod: 'ONCE_PER_EVENT' },
];

const CUSTOM_DIMENSIONS_EVENT = [
  { parameterName: 'screen_id', displayName: '画面ID', description: 'アプリ画面の識別子（U-001〜U-010）' },
  { parameterName: 'question_number', displayName: '問題番号', description: 'テスト問題の番号（1〜30）' },
  { parameterName: 'question_category', displayName: '問題カテゴリ', description: 'figure_reasoning / numerical_sequence / pattern_reasoning / spatial_recognition / logical_reasoning / numerical_reasoning' },
  { parameterName: 'question_difficulty', displayName: '問題難易度', description: 'easy / medium / hard / very_hard' },
  { parameterName: 'cta_location', displayName: 'CTA位置', description: 'CTAボタンの配置位置（top / bottom / floating）' },
  { parameterName: 'is_skipped', displayName: 'スキップフラグ', description: '問題をスキップしたかどうか' },
  { parameterName: 'is_resumed', displayName: '再開フラグ', description: 'テストを途中再開したかどうか' },
  { parameterName: 'fail_reason', displayName: '失敗理由', description: '決済失敗の理由（user_canceled等）' },
];

const CUSTOM_DIMENSIONS_USER = [
  { parameterName: 'test_status', displayName: 'テスト状態', description: 'not_started / completed / paid' },
  { parameterName: 'subscription_status', displayName: 'サブスク状態', description: 'none / trialing / active / canceled' },
];

const CUSTOM_METRICS = [
  { parameterName: 'answer_time_ms', displayName: '回答時間(ms)', description: '問題の回答にかかった時間（ミリ秒）', measurementUnit: 'MILLISECONDS' },
  { parameterName: 'total_time_ms', displayName: 'テスト所要時間(ms)', description: 'テスト全体の所要時間（ミリ秒）', measurementUnit: 'MILLISECONDS' },
  { parameterName: 'timer_remaining_sec', displayName: 'タイマー残り秒数', description: 'カウントダウンタイマーの残り秒数', measurementUnit: 'STANDARD' },
  { parameterName: 'iq_score', displayName: 'IQスコア', description: 'テスト結果のIQスコア（70〜150）', measurementUnit: 'STANDARD' },
];

const DEFAULT_PROPERTY_NAME = 'IQテストアプリ';
const DEFAULT_TIMEZONE = 'Asia/Tokyo';
const DEFAULT_CURRENCY = 'JPY';
const DEFAULT_STREAM_NAME = 'IQテストアプリ Web';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/** API レートリミット対策: 呼び出し間に 1200ms 待機する */
function rateLimitedCall(fn) {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }, 1200);
  });
}

/** readline で対話入力を受け付ける */
function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** 番号選択式のプロンプト */
async function selectFromList(items, labelFn, message) {
  console.log('');
  items.forEach((item, i) => {
    console.log(`  [${i + 1}] ${labelFn(item)}`);
  });
  console.log('');
  const answer = await askQuestion(message);
  const idx = parseInt(answer, 10) - 1;
  if (idx < 0 || idx >= items.length) {
    console.error('無効な選択です。終了します。');
    process.exit(1);
  }
  return items[idx];
}

// ---------------------------------------------------------------------------
// OAuth 2.0 認証
// ---------------------------------------------------------------------------

async function authorize() {
  // OAuth クライアント JSON 読み込み
  if (!fs.existsSync(OAUTH_CLIENT_PATH)) {
    console.error(`OAuth クライアント JSON が見つかりません: ${OAUTH_CLIENT_PATH}`);
    console.error('環境変数 GA4_AND_GTM_OAUTH_CLIENT_PATH を設定するか、スクリプトと同じディレクトリに oauth-client.json を配置してください。');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(OAUTH_CLIENT_PATH, 'utf-8'));
  const { client_id, client_secret } = credentials.installed || credentials.web || {};

  if (!client_id || !client_secret) {
    console.error('OAuth クライアント JSON に client_id / client_secret が含まれていません。');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  // 既存トークンがあればそれを使う
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);

    // トークンが期限切れなら自動リフレッシュ
    oauth2Client.on('tokens', (tokens) => {
      const merged = { ...token, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      console.log('トークンを更新しました。');
    });

    return oauth2Client;
  }

  // 新規認証フロー
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n以下の URL をブラウザで開いて認証してください:\n');
  console.log(authUrl);
  console.log('\n認証後、自動的にコールバックを受信します...\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname === '/oauth2callback') {
        const authCode = url.searchParams.get('code');
        if (authCode) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>認証が完了しました。このタブを閉じてください。</h1>');
          server.close();
          resolve(authCode);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>認証コードが取得できませんでした。</h1>');
          server.close();
          reject(new Error('認証コードが取得できませんでした。'));
        }
      }
    });
    server.listen(CALLBACK_PORT, () => {
      console.log(`コールバックサーバーをポート ${CALLBACK_PORT} で起動しました...`);
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`トークンを保存しました: ${TOKEN_PATH}`);

  return oauth2Client;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log(' GA4 Admin API セットアップ — IQテストアプリ');
  console.log('='.repeat(60));

  // --- 認証 ---
  const auth = await authorize();
  const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });

  // =========================================================================
  // Step 1: アカウント選択
  // =========================================================================
  console.log('\n--- Step 1: GA4 アカウント一覧を取得 ---');

  const accountsRes = await rateLimitedCall(() =>
    analyticsAdmin.accounts.list(),
  );
  const accounts = accountsRes.data.accounts || [];

  if (accounts.length === 0) {
    console.error('GA4 アカウントが見つかりません。');
    process.exit(1);
  }

  const selectedAccount = await selectFromList(
    accounts,
    (a) => `${a.displayName} (${a.name})`,
    'アカウント番号を選択してください: ',
  );
  console.log(`選択されたアカウント: ${selectedAccount.displayName}`);

  // =========================================================================
  // Step 2: プロパティ選択（なければ新規作成提案）
  // =========================================================================
  console.log('\n--- Step 2: プロパティ一覧を取得 ---');

  const propertiesRes = await rateLimitedCall(() =>
    analyticsAdmin.properties.list({
      filter: `parent:${selectedAccount.name}`,
    }),
  );
  let properties = propertiesRes.data.properties || [];

  let selectedProperty;

  if (properties.length === 0) {
    console.log('プロパティが見つかりません。');
    const createAnswer = await askQuestion(
      `新しいプロパティ「${DEFAULT_PROPERTY_NAME}」を作成しますか？ (y/n): `,
    );
    if (createAnswer.toLowerCase() !== 'y') {
      console.log('プロパティ作成をスキップしました。終了します。');
      process.exit(0);
    }

    const createRes = await rateLimitedCall(() =>
      analyticsAdmin.properties.create({
        requestBody: {
          parent: selectedAccount.name,
          displayName: DEFAULT_PROPERTY_NAME,
          timeZone: DEFAULT_TIMEZONE,
          currencyCode: DEFAULT_CURRENCY,
          industryCategory: 'TECHNOLOGY',
        },
      }),
    );
    selectedProperty = createRes.data;
    console.log(`プロパティを作成しました: ${selectedProperty.displayName} (${selectedProperty.name})`);
  } else {
    // 新規作成の選択肢も追加
    const createOption = {
      displayName: `[新規作成] ${DEFAULT_PROPERTY_NAME}`,
      name: '__CREATE_NEW__',
    };
    const choices = [...properties, createOption];

    const chosen = await selectFromList(
      choices,
      (p) => `${p.displayName} (${p.name})`,
      'プロパティ番号を選択してください: ',
    );

    if (chosen.name === '__CREATE_NEW__') {
      const createRes = await rateLimitedCall(() =>
        analyticsAdmin.properties.create({
          requestBody: {
            parent: selectedAccount.name,
            displayName: DEFAULT_PROPERTY_NAME,
            timeZone: DEFAULT_TIMEZONE,
            currencyCode: DEFAULT_CURRENCY,
            industryCategory: 'TECHNOLOGY',
          },
        }),
      );
      selectedProperty = createRes.data;
      console.log(`プロパティを作成しました: ${selectedProperty.displayName} (${selectedProperty.name})`);
    } else {
      selectedProperty = chosen;
      console.log(`選択されたプロパティ: ${selectedProperty.displayName}`);
    }
  }

  const propertyName = selectedProperty.name; // e.g. "properties/123456789"

  // =========================================================================
  // Step 3: データストリーム確認（なければ新規作成提案）
  // =========================================================================
  console.log('\n--- Step 3: データストリームを確認 ---');

  const streamsRes = await rateLimitedCall(() =>
    analyticsAdmin.properties.dataStreams.list({ parent: propertyName }),
  );
  let streams = streamsRes.data.dataStreams || [];

  let selectedStream;

  if (streams.length === 0) {
    console.log('データストリームが見つかりません。');
    const siteUrl = await askQuestion(
      'Web データストリームの URL を入力してください (例: https://iq-test.example.com): ',
    );
    const createStreamRes = await rateLimitedCall(() =>
      analyticsAdmin.properties.dataStreams.create({
        parent: propertyName,
        requestBody: {
          type: 'WEB_DATA_STREAM',
          displayName: DEFAULT_STREAM_NAME,
          webStreamData: {
            defaultUri: siteUrl,
          },
        },
      }),
    );
    selectedStream = createStreamRes.data;
    console.log(`データストリームを作成しました: ${selectedStream.displayName}`);
    if (selectedStream.webStreamData) {
      console.log(`  測定 ID: ${selectedStream.webStreamData.measurementId}`);
    }
  } else {
    // 新規作成の選択肢も追加
    const createOption = {
      displayName: `[新規作成] ${DEFAULT_STREAM_NAME}`,
      name: '__CREATE_NEW__',
    };
    const choices = [...streams, createOption];

    const chosen = await selectFromList(
      choices,
      (s) => {
        const mid = s.webStreamData?.measurementId || '';
        return `${s.displayName}${mid ? ` (${mid})` : ''} [${s.name || ''}]`;
      },
      'データストリーム番号を選択してください: ',
    );

    if (chosen.name === '__CREATE_NEW__') {
      const siteUrl = await askQuestion(
        'Web データストリームの URL を入力してください (例: https://iq-test.example.com): ',
      );
      const createStreamRes = await rateLimitedCall(() =>
        analyticsAdmin.properties.dataStreams.create({
          parent: propertyName,
          requestBody: {
            type: 'WEB_DATA_STREAM',
            displayName: DEFAULT_STREAM_NAME,
            webStreamData: {
              defaultUri: siteUrl,
            },
          },
        },
        ),
      );
      selectedStream = createStreamRes.data;
      console.log(`データストリームを作成しました: ${selectedStream.displayName}`);
      if (selectedStream.webStreamData) {
        console.log(`  測定 ID: ${selectedStream.webStreamData.measurementId}`);
      }
    } else {
      selectedStream = chosen;
      console.log(`選択されたデータストリーム: ${selectedStream.displayName}`);
      if (selectedStream.webStreamData) {
        console.log(`  測定 ID: ${selectedStream.webStreamData.measurementId}`);
      }
    }
  }

  // =========================================================================
  // Step 3.5: デフォルト設定（Googleシグナル有効化 & データ保持14ヶ月）
  // =========================================================================
  console.log('\n--- Step 3.5: デフォルト設定を適用 ---');

  // Google シグナル有効化
  try {
    await rateLimitedCall(() =>
      analyticsAdmin.properties.updateGoogleSignalsSettings({
        name: `${propertyName}/googleSignalsSettings`,
        updateMask: 'state',
        requestBody: {
          state: 'GOOGLE_SIGNALS_ENABLED',
        },
      }),
    );
    console.log('  Google シグナルを有効化しました。');
  } catch (err) {
    if (err.code === 404 || err.message?.includes('not found')) {
      console.log('  Google シグナル設定 API が v1beta では未対応のためスキップしました。');
      console.log('  -> GA4 管理画面から手動で有効化してください。');
    } else {
      console.warn(`  Google シグナル有効化に失敗しました: ${err.message}`);
    }
  }

  // データ保持期間を14ヶ月に設定
  try {
    await rateLimitedCall(() =>
      analyticsAdmin.properties.updateDataRetentionSettings({
        name: `${propertyName}/dataRetentionSettings`,
        updateMask: 'eventDataRetention,resetUserDataOnNewActivity',
        requestBody: {
          eventDataRetention: 'FOURTEEN_MONTHS',
          resetUserDataOnNewActivity: true,
        },
      }),
    );
    console.log('  イベントデータ保持期間を14ヶ月に設定しました。');
  } catch (err) {
    if (err.code === 404 || err.message?.includes('not found')) {
      console.log('  データ保持設定 API が v1beta では未対応のためスキップしました。');
      console.log('  -> GA4 管理画面から手動で14ヶ月に設定してください。');
    } else {
      console.warn(`  データ保持期間の設定に失敗しました: ${err.message}`);
    }
  }

  // =========================================================================
  // Step 4: キーイベント — 既存確認
  // =========================================================================
  console.log('\n--- Step 4: キーイベント一覧を取得 ---');

  const keyEventsRes = await rateLimitedCall(() =>
    analyticsAdmin.properties.keyEvents.list({ parent: propertyName }),
  );
  const existingKeyEvents = (keyEventsRes.data.keyEvents || []).map(
    (ke) => ke.eventName,
  );
  console.log(`  既存キーイベント: ${existingKeyEvents.length > 0 ? existingKeyEvents.join(', ') : '(なし)'}`);

  // =========================================================================
  // Step 5: キーイベント — 不足分を作成
  // =========================================================================
  console.log('\n--- Step 5: キーイベントを作成 ---');

  const keyEventResults = [];
  for (const ke of KEY_EVENTS) {
    if (existingKeyEvents.includes(ke.eventName)) {
      console.log(`  [SKIP] ${ke.eventName} — 既に存在`);
      keyEventResults.push({ eventName: ke.eventName, status: 'already_exists' });
      continue;
    }
    try {
      await rateLimitedCall(() =>
        analyticsAdmin.properties.keyEvents.create({
          parent: propertyName,
          requestBody: {
            eventName: ke.eventName,
            countingMethod: ke.countingMethod,
          },
        }),
      );
      console.log(`  [CREATED] ${ke.eventName}`);
      keyEventResults.push({ eventName: ke.eventName, status: 'created' });
    } catch (err) {
      console.error(`  [ERROR] ${ke.eventName}: ${err.message}`);
      keyEventResults.push({ eventName: ke.eventName, status: 'error', error: err.message });
    }
  }

  // =========================================================================
  // Step 6: カスタムディメンション — 既存確認（ページネーション対応）
  // =========================================================================
  console.log('\n--- Step 6: カスタムディメンション一覧を取得 ---');

  let existingDimensions = [];
  let pageToken = undefined;

  do {
    const dimRes = await rateLimitedCall(() =>
      analyticsAdmin.properties.customDimensions.list({
        parent: propertyName,
        pageSize: 200,
        ...(pageToken ? { pageToken } : {}),
      }),
    );
    const dims = dimRes.data.customDimensions || [];
    existingDimensions = existingDimensions.concat(dims);
    pageToken = dimRes.data.nextPageToken;
  } while (pageToken);

  const existingDimParamNames = existingDimensions.map((d) => d.parameterName);
  console.log(`  既存カスタムディメンション数: ${existingDimensions.length}`);

  // =========================================================================
  // Step 7: カスタムディメンション — 不足分を作成
  // =========================================================================
  console.log('\n--- Step 7: カスタムディメンションを作成 ---');

  const dimResults = [];

  // イベントスコープ
  console.log('  [イベントスコープ]');
  for (const dim of CUSTOM_DIMENSIONS_EVENT) {
    if (existingDimParamNames.includes(dim.parameterName)) {
      console.log(`    [SKIP] ${dim.parameterName} — 既に存在`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'EVENT', status: 'already_exists' });
      continue;
    }
    try {
      await rateLimitedCall(() =>
        analyticsAdmin.properties.customDimensions.create({
          parent: propertyName,
          requestBody: {
            parameterName: dim.parameterName,
            displayName: dim.displayName,
            description: dim.description,
            scope: 'EVENT',
          },
        }),
      );
      console.log(`    [CREATED] ${dim.parameterName}`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'EVENT', status: 'created' });
    } catch (err) {
      console.error(`    [ERROR] ${dim.parameterName}: ${err.message}`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'EVENT', status: 'error', error: err.message });
    }
  }

  // ユーザースコープ
  console.log('  [ユーザースコープ]');
  for (const dim of CUSTOM_DIMENSIONS_USER) {
    if (existingDimParamNames.includes(dim.parameterName)) {
      console.log(`    [SKIP] ${dim.parameterName} — 既に存在`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'USER', status: 'already_exists' });
      continue;
    }
    try {
      await rateLimitedCall(() =>
        analyticsAdmin.properties.customDimensions.create({
          parent: propertyName,
          requestBody: {
            parameterName: dim.parameterName,
            displayName: dim.displayName,
            description: dim.description,
            scope: 'USER',
          },
        }),
      );
      console.log(`    [CREATED] ${dim.parameterName}`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'USER', status: 'created' });
    } catch (err) {
      console.error(`    [ERROR] ${dim.parameterName}: ${err.message}`);
      dimResults.push({ parameterName: dim.parameterName, scope: 'USER', status: 'error', error: err.message });
    }
  }

  // =========================================================================
  // Step 7.5: カスタム指標 — 既存確認 & 不足分を作成
  // =========================================================================
  console.log('\n--- Step 7.5: カスタム指標を確認・作成 ---');

  let existingMetrics = [];
  let metricsPageToken = undefined;

  do {
    const metRes = await rateLimitedCall(() =>
      analyticsAdmin.properties.customMetrics.list({
        parent: propertyName,
        pageSize: 200,
        ...(metricsPageToken ? { pageToken: metricsPageToken } : {}),
      }),
    );
    const mets = metRes.data.customMetrics || [];
    existingMetrics = existingMetrics.concat(mets);
    metricsPageToken = metRes.data.nextPageToken;
  } while (metricsPageToken);

  const existingMetricParamNames = existingMetrics.map((m) => m.parameterName);
  console.log(`  既存カスタム指標数: ${existingMetrics.length}`);

  const metricResults = [];
  for (const met of CUSTOM_METRICS) {
    if (existingMetricParamNames.includes(met.parameterName)) {
      console.log(`  [SKIP] ${met.parameterName} — 既に存在`);
      metricResults.push({ parameterName: met.parameterName, status: 'already_exists' });
      continue;
    }
    try {
      await rateLimitedCall(() =>
        analyticsAdmin.properties.customMetrics.create({
          parent: propertyName,
          requestBody: {
            parameterName: met.parameterName,
            displayName: met.displayName,
            description: met.description,
            measurementUnit: met.measurementUnit,
            scope: 'EVENT',
          },
        }),
      );
      console.log(`  [CREATED] ${met.parameterName}`);
      metricResults.push({ parameterName: met.parameterName, status: 'created' });
    } catch (err) {
      console.error(`  [ERROR] ${met.parameterName}: ${err.message}`);
      metricResults.push({ parameterName: met.parameterName, status: 'error', error: err.message });
    }
  }

  // =========================================================================
  // Step 8: サマリー出力
  // =========================================================================
  console.log('\n');
  console.log('='.repeat(60));
  console.log(' セットアップ完了サマリー');
  console.log('='.repeat(60));
  console.log('');
  console.log(`  アカウント     : ${selectedAccount.displayName} (${selectedAccount.name})`);
  console.log(`  プロパティ     : ${selectedProperty.displayName} (${propertyName})`);
  console.log(`  データストリーム : ${selectedStream.displayName}${selectedStream.webStreamData?.measurementId ? ` (${selectedStream.webStreamData.measurementId})` : ''}`);
  console.log('');

  console.log('  --- キーイベント ---');
  for (const r of keyEventResults) {
    const icon = r.status === 'created' ? '+' : r.status === 'already_exists' ? '=' : 'x';
    console.log(`    [${icon}] ${r.eventName} — ${r.status}`);
  }
  console.log('');

  console.log('  --- カスタムディメンション ---');
  for (const r of dimResults) {
    const icon = r.status === 'created' ? '+' : r.status === 'already_exists' ? '=' : 'x';
    console.log(`    [${icon}] ${r.parameterName} (${r.scope}) — ${r.status}`);
  }
  console.log('');

  console.log('  --- カスタム指標 ---');
  for (const r of metricResults) {
    const icon = r.status === 'created' ? '+' : r.status === 'already_exists' ? '=' : 'x';
    console.log(`    [${icon}] ${r.parameterName} — ${r.status}`);
  }
  console.log('');

  console.log('  凡例: [+] 新規作成  [=] 既存スキップ  [x] エラー');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('次のステップ:');
  console.log('  GTM セットアップを実行:');
  console.log('  node docs/functional-requirements/analytics/scripts/setup-gtm.mjs');
  console.log('');
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
});
