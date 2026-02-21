# Threads Reply Bot — Spec v8

## Context for AI（給 AI 開發的背景說明）

- 這是一個讓 Meta Threads 使用者透過「@tag bot 帳號」觸發自動回覆的系統。
- 後端用「預先授權好的單一 Threads 帳號」（bot 帳號）發出回覆。
- 每則回覆都會附上同一張固定圖片（存於 GitHub Pages 靜態資源）。
- 回覆內容（文字）固定由後端決定。

- ⚠️ 主要觸發路徑：使用者在貼文中 @tag bot 帳號 → Webhook 通知 → bot 自動回覆到 mention 的 parent
- ❌ 已廢棄路徑：使用者輸入 URL → 後端查 media id → 發回覆（技術上行不通，見下方說明）

- Tech Stack：
  - Frontend：React + Vite (TypeScript)
    - 路由：React Router v7
    - HTTP client：fetch（原生）
    - 部署：GitHub Pages（靜態）
    - CI/CD：GitHub Actions

  - Backend：GCP Cloud Functions 2nd gen (Node.js 22)
    - region：asia-east1
    - 已部署並驗證可運作的 Cloud Run service name：postreply

  - Database：GCP Firestore（原生模式，asia-east1，已建立）
  - Secrets：GCP Secret Manager


***

## ⚠️ 已驗證的重要 Threads API 行為（實測修正）

1. reply_to_id 必須是數字 ID，不能用 shortcode
   - Threads URL 的 /post/DU7J9o1EThx 是 shortcode，API 不接受
   - 官方 API 沒有提供「shortcode → media id」的直接轉換端點
   - 數字 ID 只能透過以下方式取得：
     - a) 自己帳號的貼文：GET /me/threads?fields=id,permalink（只能查自己）
     - b) Webhook mention payload（直接帶 id）← 這是唯一可靠的公開貼文來源

2. URL 輸入路徑為何行不通：
   - 官方 API 沒有「給 shortcode 回傳任意公開貼文 media id」的端點
   - Keyword Search 可間接查到，但：
     * 速率限制：500 次 / 7 天（不適合用戶觸發）
     * 搜尋結果不精確，無法保證找到正確貼文
     * 不適合做為 production 觸發機制
   - 結論：URL 輸入路徑技術上不可靠，已廢棄

3. Threads API 正確 Endpoints（已實測）：
   - Step 1：POST https://graph.threads.net/v1.0/{THREADS_USER_ID}/threads
      - Params: media_type, text, image_url, reply_to_id, access_token
      - 回傳: { id: container_id }

   - Step 2：等待 30 秒（Meta 處理圖片需要時間）

   - Step 3：POST https://graph.threads.net/v1.0/{THREADS_USER_ID}/threads_publish
      - Params: creation_id=container_id, access_token
      - 回傳: { id: post_id }

   ❌ 錯誤 endpoint（不存在）：
      /{THREADS_USER_ID}/threads_replies  → 會回傳 NOT_FOUND
      /{container_id}/publish             → 會回傳 NOT_FOUND

4. THREADS_USER_ID 必須是數字 ID（如 2522614479705xxxx），不能是 username
   - 取得方式：GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=...

5. Webhook mention payload 直接包含目標貼文的數字 media id
   - 這是唯一不需要 shortcode 轉換就能拿到他人貼文 media id 的官方方式
   - payload 範例：{ id: "8901234", shortcode: "Pp", text: "hey @bot ...", username: "user123", ... }

6. 從 mention 貼文往上查父層：
   - GET /{media-id}?fields=id,text,root_post,replied_to
   - root_post.id  → 整串 thread 的最頂層貼文 media id
   - replied_to.id → 直接 parent（上一層）media id
   - 兩個 field 只在 reply 上出現；若不存在，表示該貼文本身就是 root

7. Bot 回覆策略：回覆到 mention 的直接 parent
   - mention 在 reply 裡 → 回覆到 replied_to.id（mention 的 parent）
   - mention 本身是 root → fallback 回覆到 mention 本身


***

## ⚠️ 已知限制

1. Threads 每帳號每日發文上限約 250 則
2. Webhook Advanced Access 需要 Meta App Review 通過才能收 live 資料
   - 未通過前只能收到 sandbox 帳號的通知
3. 不可對同一貼文重複回覆（Idempotency 保護）
4. Webhook trigger 不受 IP rate limit，但仍受 Idempotency 保護
5. REPLY_IMAGE_URL 必須公開可存取（Meta 伺服器直接拉取）
6. Webhook mentions 只有被 tag 的帳號是公開帳號才會觸發
7. 使用者必須主動 @tag bot，bot 無法主動偵測任意貼文
8. 惡意用戶可大量 @tag bot 消耗每日發文配額（250 則/日）
   - 保護機制：每個 username 每日觸發上限由 USER_DAILY_LIMIT env var 控制（預設 5）
   - 超過限制：靜默略過（回傳 200，不發文，記 log）


***

## GCP 專案資訊

Project ID：taiwan-animal-crossing-booker
Region：asia-east1
Firestore Database：(default)，已建立，FIRESTORE_NATIVE

Secret Manager（已建立）：
  THREADS_ACCESS_TOKEN    → bot 帳號的 long-lived token
  THREADS_USER_ID         → bot 帳號的數字 ID（已更新為正確數字 ID）
  ADMIN_API_KEY           → 管理 API Bearer token
  BYPASS_RATE_LIMIT_KEY   → 測試用後門 key
  WEBHOOK_VERIFY_TOKEN    → Meta webhook handshake token
  WEBHOOK_APP_SECRET      → Meta App Secret（驗 HMAC-SHA256）

Cloud Run Service（已部署）：
  https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net

***

## Environment Variables

# GCP Secret Manager（敏感資訊）
THREADS_ACCESS_TOKEN      # bot 帳號的 Threads long-lived token
THREADS_USER_ID           # bot 帳號的數字 ID（非 username）
ADMIN_API_KEY             # 管理 API Bearer token
WEBHOOK_VERIFY_TOKEN      # Meta webhook handshake 驗證 token
WEBHOOK_APP_SECRET        # Meta App Secret（HMAC-SHA256）
BYPASS_RATE_LIMIT_KEY     # 測試用後門（production 設為空字串停用）

# Cloud Functions 環境變數（非敏感）
GCP_PROJECT_ID=taiwan-animal-crossing-booker
FIRESTORE_COLLECTION_REPLIES=replies
FIRESTORE_COLLECTION_RATE_LIMITS=rate_limits
FIRESTORE_COLLECTION_USER_LIMITS=user_daily_limits
REPORT_THRESHOLD=3
USER_DAILY_LIMIT=5        # 每個 username 每日最多觸發次數（超過靜默略過，記 log）
REPLY_IMAGE_URL=https://rexx.github.io/public/certificate.jpg   # 注意：含 /public/
REPLY_TEXT=               # 固定回覆文字
ALLOWED_ORIGIN=https://rexx.github.io
THREADS_USERNAME=omawari.san.b.tw   # 用於組 threads_url

# 前端（GitHub Actions secret）
VITE_API_BASE_URL=        # Cloud Functions base URL


***

## threads.js 已驗證實作（核心邏輯）

export const threadsApi = {

  // 查詢 mention 的直接 parent（replied_to.id）
  // 若 mention 本身是 root（無 replied_to），回傳 mention 自己的 id
  async getParentMediaId(mediaId) {
    const res = await fetch(
      `https://graph.threads.net/v1.0/${mediaId}?fields=id,replied_to&access_token=${process.env.THREADS_ACCESS_TOKEN}`
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    // 有 replied_to 代表是 reply，取 parent；否則就是 root，回傳自己
    return data.replied_to?.id ?? data.id;
  },

  // 查詢並遞增 user 每日觸發次數，超過上限回傳 false
  async checkAndIncrementUserLimit(username) {
    const limit = parseInt(process.env.USER_DAILY_LIMIT ?? '5', 10);
    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
    const ref = db.collection(process.env.FIRESTORE_COLLECTION_USER_LIMITS)
                  .doc(`${username}_${today}`);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const count = doc.exists ? doc.data().count : 0;
      if (count >= limit) return false;
      t.set(ref, { count: count + 1, username, date: today }, { merge: true });
      return true;
    });
  },

  // Step 1：建立媒體容器（reply_to_id 必須是數字 ID）
  async createMediaContainer(replyToId) {
    const url = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`;
    const params = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: process.env.REPLY_IMAGE_URL,
      text: process.env.REPLY_TEXT,
      reply_to_id: replyToId,
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;  // container_id
  },

  // Step 3：發布（等待 30 秒後呼叫）
  async publishMediaContainer(containerId) {
    const url = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_publish`;
    const params = new URLSearchParams({
      creation_id: containerId,   // 注意：參數名是 creation_id
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;  // post_id
  },

  async deletePost(postId) {
    const url = `https://graph.threads.net/v1.0/${postId}`;
    const params = new URLSearchParams({ access_token: process.env.THREADS_ACCESS_TOKEN });
    const res = await fetch(`${url}?${params}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.success;
  }
};

> ⚠️ 舊版的 `getMediaIdByShortcode()` 和 `getRootMediaId()` 已移除。現在改為回覆到 parent（不是 root）。


***

## Webhook 主流程

1. 使用者在任意貼文（或回覆）中 @tag bot 帳號

2. Meta 推送 POST /webhook/threads，payload 帶有：
   {
     "id": "<mention 所在貼文的 media id>",   ← 數字 ID，直接可用
     "username": "<tagging_user>",
     "text": "...",
     "shortcode": "...",
     "permalink": "..."
   }

3. 後端驗證 HMAC-SHA256（X-Hub-Signature-256）

4. Idempotency check：document ID = triggered_by_media_id
   - 用 Firestore get(triggered_by_media_id) 直接查（不需 query）
   - 已存在 → 直接回傳 200，不重複處理

5. User 每日觸發次數檢查：checkAndIncrementUserLimit(username)
   - 超過 USER_DAILY_LIMIT → 靜默略過，記 log，回傳 200
   - log 格式：{ event: "user_limit_exceeded", username, date, limit: USER_DAILY_LIMIT }

6. 查 mention 的直接 parent：getParentMediaId(mentionMediaId)
   - 有 replied_to.id → replyToId = replied_to.id（mention 的 parent）
   - 無 replied_to → replyToId = mentionMediaId（mention 本身是 root，fallback）

7. createMediaContainer(replyToId) → container_id

8. 寫入 Firestore（status: "pending", document ID = triggered_by_media_id）

9. 等待 30 秒

10. publishMediaContainer(container_id) → post_id

11. 更新 Firestore（status: "active", post_id, published_at）


***

## Auth 策略

公開 API（rate limit 保護）：
  POST /report/{post_id}
  GET  /replies
  GET  /replies/{post_id}

Webhook（Meta 呼叫，HMAC 驗證）：
  GET  /webhook/threads   → handshake
  POST /webhook/threads   → mention 通知（主要觸發路徑）

管理 API（Bearer token）：
  DELETE /reply/{post_id}
  GET    /admin/replies

Rate limit 後門：
  Header: X-Bypass-Key: {BYPASS_RATE_LIMIT_KEY}
  → 跳過 rate limit，BYPASS_RATE_LIMIT_KEY 為空時自動停用

❌ 已移除：
  POST /reply   → URL 輸入路徑已廢棄
  GET  /health  → Cloud Functions 為 managed service，GCP Console / Cloud Logging 直接觀察


***

## Firestore Schema

// Collection: "replies"
// Document ID: triggered_by_media_id（mention 所在貼文的 media id，同時保證 Idempotency）
interface ReplyDocument {
  post_id: string | null;            // 發佈後的 bot 回覆 media id（pending 時為 null）
  container_id: string;              // 草稿容器 ID
  reply_to_media_id: string;         // bot 實際回覆的目標 media id（mention 的 parent）
  reply_to_shortcode: string | null; // 從 webhook payload 的 shortcode 欄位取得（可選）
  reply_to_permalink: string | null; // 從 webhook payload 的 permalink 欄位取得（可選）
  threads_url: string | null;        // https://www.threads.net/@{THREADS_USERNAME}/post/{post_id}
  status: "pending" | "active" | "deleted";
  trigger_source: "webhook_mention"; // URL 輸入路徑已廢棄，只剩此值
  triggered_by_media_id: string;     // mention 所在的那則貼文 media id（= document ID，冗餘存一份）
  triggered_by_username: string;     // 觸發用戶的 username（用於 log 追蹤）
  report_count: number;
  reporter_ips: string[];
  created_at: Timestamp;
  published_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

// Collection: "rate_limits"
// Document ID: {ip}_{endpoint}
interface RateLimitDocument {
  count: number;
  window_start: Timestamp;
}

// Collection: "user_daily_limits"
// Document ID: {username}_{YYYY-MM-DD}
interface UserDailyLimitDocument {
  username: string;
  date: string;              // YYYY-MM-DD
  count: number;
}

// Firestore Indexes（需手動建立）：
//   複合索引 1：status ASC + created_at DESC
//   複合索引 2：report_count DESC
//   複合索引 3：trigger_source ASC + created_at DESC
//   複合索引 4：triggered_by_username ASC + created_at DESC（用於查詢特定用戶觸發記錄）


***

## Rate Limits

POST /report：     每 IP 每 10 分鐘 2 次
GET endpoints：    不限
Webhook：          不受 IP rate limit，但有 user daily limit（USER_DAILY_LIMIT）
管理 API：         不限

❌ 已移除：
  POST /reply 的 rate limit（端點已廢棄）


***

## 錯誤碼

401 UNAUTHORIZED       → 缺少或錯誤的 ADMIN_API_KEY
403 FORBIDDEN          → Webhook HMAC 驗證失敗
404 NOT_FOUND          → 找不到指定 post_id
409 ALREADY_REPLIED    → 同一 triggered_by_media_id 已處理（Idempotency）
409 ALREADY_REPORTED   → 同一 IP 已檢舉
429 RATE_LIMITED       → 超過 rate limit，附 retry_after（秒）
500 THREADS_API_ERROR  → Threads API 呼叫失敗
500 INTERNAL_ERROR     → 其他錯誤

❌ 已移除：
  400 INVALID_URL      → URL 輸入路徑已廢棄


***

## Deploy 指令

# webhook handler（主要入口，timeout > 60s）
gcloud functions deploy webhookThreads \
  --gen2 --runtime=nodejs22 --region=asia-east1 \
  --source=. --entry-point=webhookThreads \
  --trigger-http --allow-unauthenticated \
  --memory=512Mi --timeout=120s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
FIRESTORE_COLLECTION_USER_LIMITS=user_daily_limits,\
USER_DAILY_LIMIT=5,\
REPLY_IMAGE_URL=https://rexx.github.io/public/certificate.jpg,\
REPLY_TEXT=testing,\
THREADS_USERNAME=omawari.san.b.tw \
  --set-secrets THREADS_ACCESS_TOKEN=THREADS_ACCESS_TOKEN:latest,\
THREADS_USER_ID=THREADS_USER_ID:latest,\
WEBHOOK_VERIFY_TOKEN=WEBHOOK_VERIFY_TOKEN:latest,\
WEBHOOK_APP_SECRET=WEBHOOK_APP_SECRET:latest

# 其餘 functions 類似，調整 entry-point 和相關 env vars


***

## 目前完成狀態

✅ GCP Project 建立
✅ Firestore Database 建立（asia-east1，native mode）
✅ Secret Manager 6 個 secrets 建立
✅ postReply Cloud Function 部署並驗證可運作
✅ Threads API 兩步發布流程（createContainer + publish）實測成功
✅ 架構決策：改為 Webhook mentions 主路徑，廢棄 URL 輸入路徑
✅ 回覆策略：回覆到 mention 的 parent（不是 root）
✅ User daily limit 防濫用機制設計
✅ Idempotency 改用 document ID = triggered_by_media_id（更高效）

🔲 Webhook handler 完整實作（handleWebhook Cloud Function）
🔲 其餘 Cloud Functions 待部署（deleteReply, getReplies, getReply, adminReplies, report）
🔲 Firestore 複合索引建立
🔲 Frontend 改版（移除 URL 輸入介面，改為說明頁：「請在 Threads 貼文中 @tag @omawari.san.b.tw」）
🔲 GitHub Pages 部署
🔲 Threads Webhook 設定（Meta App Dashboard）
🔲 Meta App Review（Advanced Access）申請


***

## 附錄：Threads API 的 ID 關係整理

### 各種 ID 的定義

- **post id（= threads media id）**  
  已發佈貼文在 Graph Threads 的主鍵 ID（純數字）。後續操作都用這個 ID。

- **short code（shortcode）**  
  貼文在公開 URL 裡的短碼，例如 `https://www.threads.net/@user/post/ABC123` 裡的 `ABC123`。  
  方便人類閱讀和分享，但 API 不接受用它做 `reply_to_id`。

- **container id（Media Container ID）**  
  發文前先建立「容器」，API 回傳容器 ID，之後用它發布成真正的貼文。  
  發布後就拿到 post id / media id，不再用 container id。

- **media id**  
  就是 post id，已發佈貼文的媒體物件 ID。

- **reply_to_id**  
  建立回覆時的參數，指定要回的貼文的 media id（必須是數字 ID）。

### 關係流程

1. **發文前**：建立 container → 得到 container id
2. **發布時**：用 container id 呼叫 `/threads_publish` → 產生 media id（post id）
3. **URL 前端**：media 有 shortcode，組成 permalink 供網頁訪問
4. **做回覆**：新建 container，body 加 `reply_to_id = 目標 media id`，publish 後這則 reply 也有自己的 media id
5. **查對話樹**：用某個 media id 為起點，呼叫 `/replies` 或 `/conversation` 撈整串 thread

### shortcode 無法直接對應 media id 的原因

- **兩套系統**：shortcode 給前端 URL routing，media id 是後端資料庫主鍵
- **隱私保護**：防止大規模爬蟲，官方 API 不開放任意查詢
- **API 設計哲學**：以「自己帳號」為中心，非操作任意公開帳號的平台

### 從 URL 拿到 media id 的唯一官方方法

**Webhook mentions**：使用者 @tag bot 帳號 → Webhook payload 直接帶 `id`（media id）  
這是取得他人公開貼文 media id 最可靠的官方途徑。


***

## 視覺化範例：Bot 回覆到 Parent

A (root 貼文)
  └── B (reply)
        └── C (reply，使用者在此 @tag bot)   ← Webhook 收到 C 的 media id
              
Bot 回覆到 B（C 的 parent），不是 A（root）也不是 C 本身

若使用者直接在 A @tag bot（A 沒有 parent）：
  Bot fallback 回覆到 A 本身