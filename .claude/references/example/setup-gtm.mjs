/**
 * GTM 自動設定スクリプト — IQテストアプリ
 *
 * 使用方法:
 *   node setup-gtm.mjs
 *
 * 前提条件:
 *   1. Google Cloud Project で Tag Manager API を有効化済み
 *   2. OAuth 2.0 クライアントIDを作成済み（リダイレクトURI: http://localhost:3939/oauth2callback）
 *   3. GTM アカウントを作成済み（https://tagmanager.google.com）
 *   4. 環境変数を設定済み:
 *      - GA4_AND_GTM_OAUTH_CLIENT_PATH: OAuthクライアントJSONファイルのパス
 *      - GA4_AND_GTM_OAUTH_TOKEN_PATH: トークン保存先のパス
 */

import { google } from "googleapis";
import fs from "fs";
import http from "http";
import { URL } from "url";
import readline from "readline";

// ============================================================
// 定数
// ============================================================
const SCOPES = [
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

const OAUTH_CALLBACK_PORT = 3939;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}/oauth2callback`;

const API_BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

/** QPS 0.25 → リクエスト間に最低 4 秒待つ */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const API_WAIT_MS = 4000;

// ============================================================
// Data Layer 変数定義
// ============================================================
const DL_VARIABLES = [
  "screen_id",
  "session_id",
  "is_resumed",
  "question_number",
  "question_category",
  "question_difficulty",
  "answer_time_ms",
  "is_skipped",
  "answered_count",
  "skipped_count",
  "total_time_ms",
  "currency",
  "value",
  "timer_remaining_sec",
  "cta_location",
  "transaction_id",
  "fail_reason",
  "iq_score",
  "test_status",
  "subscription_status",
];

// ============================================================
// Custom Event トリガー定義
// ============================================================
const CUSTOM_EVENTS = [
  "test_start",
  "question_view",
  "question_answer",
  "test_complete",
  "generate_lead",
  "preview_view",
  "cta_click",
  "begin_checkout",
  "purchase",
  "checkout_fail",
  "result_view",
];

// ============================================================
// GA4 Event タグ定義（イベント名 → パラメーター名リスト）
// ============================================================
const EVENT_TAG_PARAMS = {
  test_start: ["session_id", "is_resumed"],
  question_view: [
    "session_id",
    "question_number",
    "question_category",
    "question_difficulty",
  ],
  question_answer: [
    "session_id",
    "question_number",
    "question_category",
    "question_difficulty",
    "answer_time_ms",
    "is_skipped",
  ],
  test_complete: [
    "session_id",
    "answered_count",
    "skipped_count",
    "total_time_ms",
  ],
  generate_lead: ["session_id", "currency", "value"],
  preview_view: ["session_id", "timer_remaining_sec"],
  cta_click: ["session_id", "cta_location", "timer_remaining_sec"],
  begin_checkout: ["session_id", "currency", "value"],
  purchase: ["session_id", "transaction_id", "currency", "value"],
  checkout_fail: ["session_id", "fail_reason"],
  result_view: ["session_id", "iq_score"],
};

// ============================================================
// ユーティリティ
// ============================================================

/**
 * readline で 1 行入力を受け取る
 */
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 番号選択入力を受け取る
 */
async function askChoice(question, maxIndex) {
  while (true) {
    const ans = await ask(question);
    const num = parseInt(ans, 10);
    if (!isNaN(num) && num >= 0 && num <= maxIndex) return num;
    console.log(`  0〜${maxIndex} の番号を入力してください。`);
  }
}

/**
 * Yes/No 入力を受け取る
 */
async function askYesNo(question) {
  while (true) {
    const ans = (await ask(`${question} (y/n): `)).toLowerCase();
    if (ans === "y" || ans === "yes") return true;
    if (ans === "n" || ans === "no") return false;
    console.log("  y または n を入力してください。");
  }
}

/**
 * GTM API v2 への汎用リクエスト（レート制限対応）
 */
async function apiRequest(auth, method, url, body = undefined) {
  const headers = {
    Authorization: `Bearer ${(await auth.getAccessToken()).token}`,
    "Content-Type": "application/json",
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  // レート制限待機
  await sleep(API_WAIT_MS);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ============================================================
// Step 1: OAuth 認証
// ============================================================
async function authenticate() {
  console.log("\n[Step 1/13] OAuth 認証を実行中...");

  const clientPath = process.env.GA4_AND_GTM_OAUTH_CLIENT_DESKTOP_PATH;
  const tokenPath = process.env.GTM_OAUTH_TOKEN_DESKTOP_PATH;

  if (!clientPath) {
    throw new Error(
      "環境変数 GA4_AND_GTM_OAUTH_CLIENT_PATH が設定されていません。"
    );
  }
  if (!tokenPath) {
    throw new Error(
      "環境変数 GA4_AND_GTM_OAUTH_TOKEN_PATH が設定されていません。"
    );
  }

  const credentials = JSON.parse(fs.readFileSync(clientPath, "utf-8"));
  const { client_id, client_secret } =
    credentials.installed || credentials.web || {};

  if (!client_id || !client_secret) {
    throw new Error("OAuthクライアントJSONの形式が不正です。");
  }

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    OAUTH_REDIRECT_URI
  );

  // 既存トークンがあればロード
  if (fs.existsSync(tokenPath)) {
    try {
      const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
      oauth2Client.setCredentials(token);

      // トークンの更新イベントで自動保存
      oauth2Client.on("tokens", (newTokens) => {
        const merged = { ...token, ...newTokens };
        fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
        console.log("  トークンを更新・保存しました。");
      });

      // アクセストークンの有効性を確認（必要なら自動リフレッシュ）
      await oauth2Client.getAccessToken();
      console.log("  既存トークンで認証しました。");
      return oauth2Client;
    } catch (e) {
      console.log(`  既存トークンの読み込みに失敗しました: ${e.message}`);
      console.log("  ブラウザで再認証します...");
    }
  }

  // ブラウザで OAuth 認証フロー
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n  以下のURLをブラウザで開いてください:");
  console.log(`  ${authUrl}\n`);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://localhost:${OAUTH_CALLBACK_PORT}`);
        if (reqUrl.pathname === "/oauth2callback") {
          const authCode = reqUrl.searchParams.get("code");
          if (authCode) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<h1>認証が完了しました。このタブを閉じてください。</h1>"
            );
            server.close();
            resolve(authCode);
          } else {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end("<h1>認証コードが取得できませんでした。</h1>");
            server.close();
            reject(new Error("認証コードが取得できませんでした。"));
          }
        }
      } catch (err) {
        reject(err);
      }
    });
    server.listen(OAUTH_CALLBACK_PORT, () => {
      console.log(
        `  コールバックサーバーをポート ${OAUTH_CALLBACK_PORT} で待機中...`
      );
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log("  トークンを保存しました。");

  oauth2Client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
    console.log("  トークンを更新・保存しました。");
  });

  console.log("  認証が完了しました。");
  return oauth2Client;
}

// ============================================================
// Step 2: アカウント選択
// ============================================================
async function selectAccount(auth) {
  console.log("\n[Step 2/13] GTM アカウントを取得中...");

  const data = await apiRequest(auth, "GET", `${API_BASE}/accounts`);
  const accounts = data.account || [];

  if (accounts.length === 0) {
    throw new Error(
      "GTM アカウントが見つかりません。先に https://tagmanager.google.com でアカウントを作成してください。"
    );
  }

  console.log("\n  GTM アカウント一覧:");
  accounts.forEach((acc, i) => {
    console.log(`    [${i}] ${acc.name} (ID: ${acc.accountId})`);
  });

  const choice = await askChoice(
    `\n  使用するアカウント番号を選択 (0-${accounts.length - 1}): `,
    accounts.length - 1
  );

  const selected = accounts[choice];
  console.log(`  → アカウント "${selected.name}" を選択しました。`);
  return selected;
}

// ============================================================
// Step 3: コンテナ選択 or 作成
// ============================================================
async function selectOrCreateContainer(auth, account) {
  console.log("\n[Step 3/13] コンテナを取得中...");

  const accountPath = account.path; // accounts/{accountId}
  const data = await apiRequest(
    auth,
    "GET",
    `${API_BASE}/${accountPath}/containers`
  );
  const containers = data.container || [];

  console.log("\n  コンテナ一覧:");
  containers.forEach((c, i) => {
    console.log(`    [${i}] ${c.name} (ID: ${c.containerId})`);
  });
  console.log(`    [${containers.length}] 新規作成 (iq-test-app)`);

  const choice = await askChoice(
    `\n  使用するコンテナ番号を選択 (0-${containers.length}): `,
    containers.length
  );

  if (choice < containers.length) {
    const selected = containers[choice];
    console.log(`  → コンテナ "${selected.name}" を選択しました。`);
    return selected;
  }

  // 新規作成
  console.log('  コンテナ "iq-test-app" を新規作成中...');
  const newContainer = await apiRequest(
    auth,
    "POST",
    `${API_BASE}/${accountPath}/containers`,
    {
      name: "iq-test-app",
      usageContext: ["web"],
    }
  );
  console.log(
    `  → コンテナ "${newContainer.name}" を作成しました (ID: ${newContainer.containerId})。`
  );
  return newContainer;
}

// ============================================================
// Step 4: ワークスペース選択 or 作成
// ============================================================
async function selectOrCreateWorkspace(auth, container) {
  console.log("\n[Step 4/13] ワークスペースを取得中...");

  const containerPath = container.path; // accounts/{id}/containers/{id}
  const data = await apiRequest(
    auth,
    "GET",
    `${API_BASE}/${containerPath}/workspaces`
  );
  const workspaces = data.workspace || [];

  const WORKSPACE_NAME = "GA4 Setup";
  const existing = workspaces.find((ws) => ws.name === WORKSPACE_NAME);

  if (existing) {
    console.log(
      `  → 既存ワークスペース "${WORKSPACE_NAME}" を再利用します (ID: ${existing.workspaceId})。`
    );
    return existing;
  }

  console.log(`  ワークスペース "${WORKSPACE_NAME}" を新規作成中...`);
  const newWorkspace = await apiRequest(
    auth,
    "POST",
    `${API_BASE}/${containerPath}/workspaces`,
    { name: WORKSPACE_NAME }
  );
  console.log(
    `  → ワークスペース "${newWorkspace.name}" を作成しました (ID: ${newWorkspace.workspaceId})。`
  );
  return newWorkspace;
}

// ============================================================
// Step 5: 既存リソースの一括取得
// ============================================================
async function fetchExistingResources(auth, workspace) {
  console.log("\n[Step 5/13] 既存リソースを一括取得中...");

  const wsPath = workspace.path;

  // タグ
  let existingTags = {};
  try {
    const tagsData = await apiRequest(
      auth,
      "GET",
      `${API_BASE}/${wsPath}/tags`
    );
    for (const tag of tagsData.tag || []) {
      existingTags[tag.name] = tag;
    }
    console.log(`  → 既存タグ: ${Object.keys(existingTags).length} 件`);
  } catch (e) {
    console.log(`  タグ取得エラー（空の可能性あり）: ${e.message}`);
  }

  // 変数
  let existingVariables = {};
  try {
    const varsData = await apiRequest(
      auth,
      "GET",
      `${API_BASE}/${wsPath}/variables`
    );
    for (const v of varsData.variable || []) {
      existingVariables[v.name] = v;
    }
    console.log(`  → 既存変数: ${Object.keys(existingVariables).length} 件`);
  } catch (e) {
    console.log(`  変数取得エラー（空の可能性あり）: ${e.message}`);
  }

  // トリガー
  let existingTriggers = {};
  try {
    const triggersData = await apiRequest(
      auth,
      "GET",
      `${API_BASE}/${wsPath}/triggers`
    );
    for (const t of triggersData.trigger || []) {
      existingTriggers[t.name] = t;
    }
    console.log(
      `  → 既存トリガー: ${Object.keys(existingTriggers).length} 件`
    );
  } catch (e) {
    console.log(`  トリガー取得エラー（空の可能性あり）: ${e.message}`);
  }

  return { existingTags, existingVariables, existingTriggers };
}

// ============================================================
// Step 6: 組み込み変数の有効化
// ============================================================
async function enableBuiltInVariables(auth, workspace) {
  console.log("\n[Step 6/13] 組み込み変数を有効化中...");

  const wsPath = workspace.path;
  const builtInTypes = ["event", "pageUrl", "pagePath", "referrer"];

  try {
    const typeParam = builtInTypes.map((t) => `type=${t}`).join("&");
    await apiRequest(
      auth,
      "POST",
      `${API_BASE}/${wsPath}/built_in_variables?${typeParam}`
    );
    console.log(
      `  → 組み込み変数を有効化しました: ${builtInTypes.join(", ")}`
    );
  } catch (e) {
    console.log(
      `  組み込み変数の有効化をスキップしました（既に有効の可能性）: ${e.message}`
    );
  }
}

// ============================================================
// Step 7: Google tag（GA4設定タグ）の作成
// ============================================================
async function createGA4ConfigTag(auth, workspace, existingTags) {
  console.log("\n[Step 7/13] GA4 設定タグ（Google tag）を作成中...");

  const TAG_NAME = "GA4 - Config";
  const wsPath = workspace.path;

  if (existingTags[TAG_NAME]) {
    console.log(`  → タグ "${TAG_NAME}" は既に存在するためスキップします。`);
    return existingTags[TAG_NAME];
  }

  const measurementId = await ask(
    "  GA4 測定 ID を入力してください（例: G-XXXXXXXXXX）: "
  );

  const tagBody = {
    name: TAG_NAME,
    type: "gaawc",
    parameter: [
      {
        type: "template",
        key: "measurementId",
        value: measurementId,
      },
      {
        type: "list",
        key: "userProperties",
        list: [
          {
            type: "map",
            map: [
              {
                type: "template",
                key: "name",
                value: "test_status",
              },
              {
                type: "template",
                key: "value",
                value: "{{DLV - test_status}}",
              },
            ],
          },
          {
            type: "map",
            map: [
              {
                type: "template",
                key: "name",
                value: "subscription_status",
              },
              {
                type: "template",
                key: "value",
                value: "{{DLV - subscription_status}}",
              },
            ],
          },
        ],
      },
    ],
    firingTriggerId: ["2147479553"], // Initialization - All Pages
  };

  const created = await apiRequest(
    auth,
    "POST",
    `${API_BASE}/${wsPath}/tags`,
    tagBody
  );
  console.log(
    `  → タグ "${created.name}" を作成しました (ID: ${created.tagId})。`
  );
  return created;
}

// ============================================================
// Step 8: Data Layer 変数の作成
// ============================================================
async function createDataLayerVariables(auth, workspace, existingVariables) {
  console.log("\n[Step 8/13] Data Layer 変数を作成中...");

  const wsPath = workspace.path;
  const total = DL_VARIABLES.length;
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const varName = DL_VARIABLES[i];
    const dlvName = `DLV - ${varName}`;

    console.log(
      `  [Step 8/13] Data Layer変数を作成中...（${i + 1}/${total}）`
    );

    if (existingVariables[dlvName]) {
      console.log(`    → "${dlvName}" は既に存在するためスキップ。`);
      skipped++;
      continue;
    }

    const varBody = {
      name: dlvName,
      type: "v",
      parameter: [
        { type: "integer", key: "dataLayerVersion", value: "2" },
        { type: "boolean", key: "setDefaultValue", value: "false" },
        { type: "template", key: "name", value: varName },
      ],
    };

    try {
      const result = await apiRequest(
        auth,
        "POST",
        `${API_BASE}/${wsPath}/variables`,
        varBody
      );
      existingVariables[dlvName] = result;
      created++;
      console.log(
        `    → "${result.name}" を作成しました (ID: ${result.variableId})。`
      );
    } catch (e) {
      console.error(`    ✗ "${dlvName}" の作成に失敗: ${e.message}`);
    }
  }

  console.log(
    `  → 完了: 作成 ${created} 件, スキップ ${skipped} 件, 合計 ${total} 件`
  );
}

// ============================================================
// Step 9: Custom Event トリガーの作成
// ============================================================
async function createCustomEventTriggers(auth, workspace, existingTriggers) {
  console.log("\n[Step 9/13] Custom Event トリガーを作成中...");

  const wsPath = workspace.path;
  const total = CUSTOM_EVENTS.length;
  let created = 0;
  let skipped = 0;

  /** トリガー名 → triggerId のマッピング */
  const triggerIdMap = {};

  for (let i = 0; i < total; i++) {
    const eventName = CUSTOM_EVENTS[i];
    const triggerName = `CE - ${eventName}`;

    console.log(
      `  [Step 9/13] Custom Event トリガーを作成中...（${i + 1}/${total}）`
    );

    if (existingTriggers[triggerName]) {
      console.log(`    → "${triggerName}" は既に存在するためスキップ。`);
      triggerIdMap[eventName] = existingTriggers[triggerName].triggerId;
      skipped++;
      continue;
    }

    const triggerBody = {
      name: triggerName,
      type: "customEvent",
      customEventFilter: [
        {
          type: "equals",
          parameter: [
            { type: "template", key: "arg0", value: "{{_event}}" },
            { type: "template", key: "arg1", value: eventName },
          ],
        },
      ],
    };

    try {
      const result = await apiRequest(
        auth,
        "POST",
        `${API_BASE}/${wsPath}/triggers`,
        triggerBody
      );
      existingTriggers[triggerName] = result;
      triggerIdMap[eventName] = result.triggerId;
      created++;
      console.log(
        `    → "${result.name}" を作成しました (ID: ${result.triggerId})。`
      );
    } catch (e) {
      console.error(`    ✗ "${triggerName}" の作成に失敗: ${e.message}`);
    }
  }

  console.log(
    `  → 完了: 作成 ${created} 件, スキップ ${skipped} 件, 合計 ${total} 件`
  );
  return triggerIdMap;
}

// ============================================================
// Step 10: GA4 Event タグの作成
// ============================================================
async function createGA4EventTags(
  auth,
  workspace,
  existingTags,
  triggerIdMap,
  configTag
) {
  console.log("\n[Step 10/13] GA4 Event タグを作成中...");

  const wsPath = workspace.path;
  const eventNames = Object.keys(EVENT_TAG_PARAMS);
  const total = eventNames.length;
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const eventName = eventNames[i];
    const tagName = `GA4 - Event - ${eventName}`;
    const params = EVENT_TAG_PARAMS[eventName];

    console.log(
      `  [Step 10/13] GA4 Event タグを作成中...（${i + 1}/${total}）`
    );

    if (existingTags[tagName]) {
      console.log(`    → "${tagName}" は既に存在するためスキップ。`);
      skipped++;
      continue;
    }

    const triggerId = triggerIdMap[eventName];
    if (!triggerId) {
      console.error(
        `    ✗ "${tagName}" のトリガーIDが見つかりません。スキップします。`
      );
      continue;
    }

    // eventParameters リスト構築
    const eventParametersList = params.map((paramName) => ({
      type: "map",
      map: [
        { type: "template", key: "name", value: paramName },
        { type: "template", key: "value", value: `{{DLV - ${paramName}}}` },
      ],
    }));

    const tagBody = {
      name: tagName,
      type: "gaawe",
      parameter: [
        {
          type: "tag_reference",
          key: "measurementId",
          value: configTag.name || "GA4 - Config",
        },
        {
          type: "template",
          key: "eventName",
          value: eventName,
        },
        {
          type: "list",
          key: "eventParameters",
          list: eventParametersList,
        },
      ],
      firingTriggerId: [triggerId],
      tagFiringOption: "ONCE_PER_EVENT",
    };

    try {
      const result = await apiRequest(
        auth,
        "POST",
        `${API_BASE}/${wsPath}/tags`,
        tagBody
      );
      existingTags[tagName] = result;
      created++;
      console.log(
        `    → "${result.name}" を作成しました (ID: ${result.tagId})。`
      );
    } catch (e) {
      console.error(`    ✗ "${tagName}" の作成に失敗: ${e.message}`);
    }
  }

  console.log(
    `  → 完了: 作成 ${created} 件, スキップ ${skipped} 件, 合計 ${total} 件`
  );
}

// ============================================================
// Step 11: バージョン作成
// ============================================================
async function createVersion(auth, workspace) {
  console.log("\n[Step 11/13] バージョンを作成中...");

  const wsPath = workspace.path;

  try {
    const versionData = await apiRequest(
      auth,
      "POST",
      `${API_BASE}/${wsPath}:create_version`,
      {
        name: "v1.0 - GA4 Initial Setup",
        notes:
          "GA4 Google tag + 11 custom event tags + triggers + DL variables",
      }
    );

    const version =
      versionData.containerVersion || versionData.compilerError
        ? versionData
        : versionData;

    if (versionData.compilerError) {
      console.log("  ⚠ コンパイラエラーが検出されました:");
      console.log(
        `    ${JSON.stringify(versionData.compilerError, null, 2)}`
      );
    }

    if (versionData.containerVersion) {
      console.log(
        `  → バージョン "${versionData.containerVersion.name}" を作成しました (ID: ${versionData.containerVersion.containerVersionId})。`
      );
      return versionData.containerVersion;
    }

    console.log("  → バージョンレスポンス:", JSON.stringify(versionData, null, 2));
    return versionData;
  } catch (e) {
    console.error(`  ✗ バージョン作成に失敗: ${e.message}`);
    return null;
  }
}

// ============================================================
// Step 12: 公開（ユーザー確認後）
// ============================================================
async function publishVersion(auth, version) {
  console.log("\n[Step 12/13] バージョンの公開...");

  if (!version || !version.path) {
    console.log(
      "  バージョン情報がないため公開をスキップします。GTM 管理画面から手動で公開してください。"
    );
    return;
  }

  const shouldPublish = await askYesNo(
    "  バージョンを公開しますか？（GTM Preview で確認してから手動公開も可能です）"
  );

  if (!shouldPublish) {
    console.log(
      "  → 公開をスキップしました。GTM 管理画面から手動で公開してください。"
    );
    return;
  }

  try {
    const result = await apiRequest(
      auth,
      "POST",
      `${API_BASE}/${version.path}:publish`
    );
    console.log("  → バージョンを公開しました。");
    if (result.containerVersion) {
      console.log(
        `    バージョンID: ${result.containerVersion.containerVersionId}`
      );
    }
  } catch (e) {
    console.error(`  ✗ 公開に失敗しました: ${e.message}`);
    console.log("  GTM 管理画面から手動で公開してください。");
  }
}

// ============================================================
// Step 13: スニペット取得
// ============================================================
async function getSnippet(auth, container) {
  console.log("\n[Step 13/13] GTM スニペットを取得中...");

  const containerPath = container.path;

  try {
    // environments を取得して snippet を得る
    const data = await apiRequest(
      auth,
      "GET",
      `${API_BASE}/${containerPath}/environments`
    );

    const environments = data.environment || [];
    // Live 環境を探す
    const liveEnv = environments.find(
      (env) => env.type === "live" || env.type === "latest"
    );

    if (liveEnv && liveEnv.tagManagerUrl) {
      console.log("\n  GTM 管理画面URL:");
      console.log(`  ${liveEnv.tagManagerUrl}`);
    }

    // コンテナIDからスニペットを手動構築
    const gtmId = container.publicId || `GTM-${container.containerId}`;
    console.log("\n  ========================================");
    console.log("  GTM スニペット（<head> 内のできるだけ上部に貼り付け）:");
    console.log("  ========================================");
    console.log(`
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->
`);
    console.log(
      "  ========================================================"
    );
    console.log(
      "  GTM スニペット（<body> 開始直後に貼り付け）:"
    );
    console.log(
      "  ========================================================"
    );
    console.log(`
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`);
  } catch (e) {
    console.error(`  スニペット取得に失敗: ${e.message}`);
    console.log(
      "  GTM 管理画面からスニペットを取得してください: https://tagmanager.google.com"
    );
  }
}

// ============================================================
// メイン実行
// ============================================================
async function main() {
  console.log("====================================================");
  console.log("  GTM 自動設定スクリプト — IQテストアプリ");
  console.log("====================================================");

  try {
    // Step 1: 認証
    const auth = await authenticate();

    // Step 2: アカウント選択
    const account = await selectAccount(auth);

    // Step 3: コンテナ選択 or 作成
    const container = await selectOrCreateContainer(auth, account);

    // Step 4: ワークスペース選択 or 作成
    const workspace = await selectOrCreateWorkspace(auth, container);

    // Step 5: 既存リソースの一括取得
    const { existingTags, existingVariables, existingTriggers } =
      await fetchExistingResources(auth, workspace);

    // Step 6: 組み込み変数の有効化
    await enableBuiltInVariables(auth, workspace);

    // Step 7: GA4 設定タグの作成
    const configTag = await createGA4ConfigTag(auth, workspace, existingTags);

    // Step 8: Data Layer 変数の作成
    await createDataLayerVariables(auth, workspace, existingVariables);

    // Step 9: Custom Event トリガーの作成
    const triggerIdMap = await createCustomEventTriggers(
      auth,
      workspace,
      existingTriggers
    );

    // Step 10: GA4 Event タグの作成
    await createGA4EventTags(
      auth,
      workspace,
      existingTags,
      triggerIdMap,
      configTag
    );

    // Step 11: バージョン作成
    const version = await createVersion(auth, workspace);

    // Step 12: 公開
    await publishVersion(auth, version);

    // Step 13: スニペット取得
    await getSnippet(auth, container);

    console.log("\n====================================================");
    console.log("  すべてのステップが完了しました。");
    console.log("====================================================\n");
  } catch (e) {
    console.error(`\n致命的エラー: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
