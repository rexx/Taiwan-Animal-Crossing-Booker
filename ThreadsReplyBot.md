# Threads Reply Bot — Spec v6

## Context for AI（給 AI 開發的背景說明）

```
這是一個讓任何人輸入 Meta Threads 貼文 URL 的網站。
後端用「預先授權好的單一 Threads 帳號」（bot 帳號）發出回覆。
每則回覆都會附上同一張固定圖片（存於 GitHub Pages 靜態資源）。
回覆內容（文字）固定由後端決定，前端使用者只需輸入目標 URL。

支援雙向觸發：
  1. 主動：使用者在網站貼上目標 Threads 貼文 URL，手動觸發回覆
  2. 被動：路人在 Threads 上 tag bot 帳號，自動觸發回覆

所有回覆來源永遠是同一個 Threads bot 帳號。
系統需要防止濫用（rate limit + 檢舉自動刪除）。
任何人都可以發文、查看列表、查看單篇。
管理操作（刪除、查看完整資訊）需要 ADMIN_API_KEY。

Tech Stack：
  Frontend：React + Vite (TypeScript)
    - 路由：React Router v7
    - HTTP client：fetch（原生）
    - 部署：GitHub Pages（靜態）
    - CI/CD：GitHub Actions

  Backend：GCP Cloud Functions 2nd gen (Node.js 22)
    - region：asia-east1

  Database：GCP Firestore（原生模式）
  Secrets：GCP Secret Manager
  CDN/防禦：
    - 前端：GitHub Pages 內建 CDN
    - 後端：Cloud Functions URL 直接使用（無自訂 domain）

固定回覆圖片：
  存放：frontend/public/certificate.jpg
  URL：https://rexx.github.io/public/certificate.jpg
  後端從環境變數 REPLY_IMAGE_URL 讀取，每次回覆自動附上，前端不傳遞

固定回覆文字：
  後端從環境變數 REPLY_TEXT 讀取，每次回覆自動附上，前端不傳遞

Threads API 發文兩步流程（重要，所有發文都要走這兩步）：
  Step 1：POST https://graph.threads.net/v1.0/{THREADS_USER_ID}/threads_replies
          Body: { media_type: "IMAGE", text: REPLY_TEXT, image_url: REPLY_IMAGE_URL, reply_to_id }
          說明：這步是在 Meta 伺服器上「預先建立」一個媒體容器（container）。
                Meta 會在背景下載並處理 image_url 的圖片，尚未對外發布任何內容。
          回傳: { id: container_id }
  Step 2：等待 20–30 秒
          說明：Meta 需要時間從 REPLY_IMAGE_URL 拉取並處理圖片。
                若太快進行 Step 3，發布會失敗（container 尚未 ready）。
  Step 3：POST https://graph.threads.net/v1.0/{container_id}/publish
          說明：這步才是真正把回覆文章發布到 Threads 上，對外可見。
          回傳: { id: post_id }
```

***

## ⚠️ 已知限制與政策邊界

```
1. Threads 每帳號每日發文上限約 250 則（以官方文件為準）
2. Webhook Advanced Access 需要 Meta App Review 通過才能收 live 資料
3. 不可對同一貼文重複回覆（Idempotency 保護）
4. 不可用於大量騷擾、廣告 spam（違反 Meta Community Standards）
5. Webhook trigger 不受 IP rate limit，但仍受 Idempotency 保護
6. REPLY_IMAGE_URL 必須公開可存取（Meta 伺服器直接拉取）
```

***

## Environment Variables

```bash
# GCP Secret Manager 儲存（敏感資訊）
THREADS_ACCESS_TOKEN=     # bot 帳號的 Threads long-lived token
THREADS_USER_ID=          # bot 帳號的 Threads user ID
ADMIN_API_KEY=            # 管理 API 的 Bearer token（自訂隨機字串）
WEBHOOK_VERIFY_TOKEN=     # Meta webhook handshake 驗證 token（自訂）
WEBHOOK_APP_SECRET=       # Meta App Secret（驗 HMAC-SHA256 簽章）

# Cloud Functions 環境變數（非敏感）
GCP_PROJECT_ID=
FIRESTORE_COLLECTION_REPLIES=replies
FIRESTORE_COLLECTION_RATE_LIMITS=rate_limits
REPORT_THRESHOLD=3
REPLY_IMAGE_URL=https://rexx.github.io/public/certificate.jpg
REPLY_TEXT=               # 固定回覆文字內容
ALLOWED_ORIGIN=           # GitHub Pages domain，CORS 用
BYPASS_RATE_LIMIT_KEY=    # 開發測試用後門 key（production 留空則停用）

# 前端（GitHub Actions secret）
VITE_API_BASE_URL=        # Cloud Functions URL（含 https://）
```

***

## Auth 策略

```
公開 API（任何人可呼叫，有 rate limit）：
  POST /reply
  POST /report/{post_id}
  GET  /replies
  GET  /replies/{post_id}
  GET  /health

Webhook（Meta 呼叫，需驗 HMAC 簽章）：
  GET  /webhook/threads   → Meta handshake 驗證
  POST /webhook/threads   → 接收 mention 通知

管理 API（只有你可呼叫）：
  DELETE /reply/{post_id}
  GET    /admin/replies

驗證方式：
  管理 API → Header: Authorization: Bearer {ADMIN_API_KEY}
             缺少或不符 → 401
  Webhook  → Header: X-Hub-Signature-256: sha256={HMAC}
             用 WEBHOOK_APP_SECRET 重新計算比對，不符 → 403

Rate limit 後門（開發測試用）：
  任何公開 API 加上 Header: X-Bypass-Key: {BYPASS_RATE_LIMIT_KEY}
  若 BYPASS_RATE_LIMIT_KEY 環境變數不為空且 key 符合 → 跳過 rate limit 檢查
  Production 部署時將 BYPASS_RATE_LIMIT_KEY 設為空字串即自動停用
```

***

## Firestore Schema

```typescript
// Collection: "replies"
// Document ID: container_id（pending 期間）→ 發布後改為 post_id

interface ReplyDocument {
  post_id: string | null;           // Threads 發布後的 media ID（pending 時 null）
  container_id: string;             // Threads step 1 回傳的容器 ID
  reply_to_url: string;             // 使用者輸入的目標 Threads URL
  reply_to_id: string;              // 從 URL 解析出的 post ID
  threads_url: string | null;       // 發布後的 bot 回覆 URL
  status: "pending"                 // 容器建立中，尚未 publish
          | "active"                // 已成功發布
          | "deleted";              // 已刪除（撤回或自動刪除）
  trigger_source: "manual"          // 使用者在網站手動輸入 URL
                | "webhook_mention";// 路人在 Threads tag bot 觸發
  triggered_by_media_id: string | null; // webhook 觸發時來源貼文 ID
  report_count: number;             // 檢舉次數（原子 increment，預設 0）
  reporter_ips: string[];           // 僅後端使用，不回傳前端
  created_at: Timestamp;
  published_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

// Collection: "rate_limits"
// Document ID: {ip}_{endpoint}  e.g. "8.8.8.8_reply"
interface RateLimitDocument {
  count: number;
  window_start: Timestamp;
}

// Firestore Indexes（需手動建立）：
//   複合索引 1：status ASC + created_at DESC
//   複合索引 2：report_count DESC
//   複合索引 3：trigger_source ASC + created_at DESC
```

***

## Rate Limits

```
實作機制：Firestore rate_limits collection

POST /reply：        每 IP 每 10 分鐘 2 次
POST /report：       每 IP 每 10 分鐘 2 次
GET /replies：       不限
GET /replies/:id：   不限
POST /webhook：      不受 IP rate limit（Meta 呼叫）
管理 API：           不限（Auth 保護）

後門（開發測試）：
  Request Header 帶 X-Bypass-Key: {BYPASS_RATE_LIMIT_KEY}
  → 跳過所有 rate limit 檢查
  → BYPASS_RATE_LIMIT_KEY 為空時自動停用此後門

邏輯：
  讀取 rate_limits/{ip}_{endpoint}
  若 now - window_start > 600 秒 → 重置 count = 1
  否則 → increment count
  若 count > 2 → 回傳 429，retry_after = window_end - now（秒）
```

***

## 錯誤碼規範

```
400 BAD_REQUEST        → 欄位格式錯誤
401 UNAUTHORIZED       → 管理 API 缺少或錯誤的 ADMIN_API_KEY
403 FORBIDDEN          → Webhook HMAC 驗證失敗
404 NOT_FOUND          → 找不到指定 post_id
409 CONFLICT           → 重複操作（已回覆 / 已刪除 / 已檢舉）
429 RATE_LIMITED       → 超過 rate limit
500 THREADS_API_ERROR  → Threads API 呼叫失敗
500 INTERNAL_ERROR     → 其他伺服器錯誤
```

***

## API Endpoints（共 9 個）

### 1. `POST /reply`（公開）

**Request Body**
```typescript
{
  reply_to_url: string;  // 必填，regex: /^https:\/\/threads\.net\/@[\w.]+\/post\/\d+$/
  // text 與 image_url 均由後端從環境變數自動注入，前端不傳
}
```

**後端流程**
```
1. 驗證 reply_to_url 格式
2. Rate limit 檢查（IP，可被 X-Bypass-Key 跳過）
3. 解析 reply_to_url → reply_to_id（regex /post\/(\d+)/）
4. Idempotency 檢查：Firestore 查 reply_to_id + status=active → 若存在回 409
5. POST Threads API step 1（text=REPLY_TEXT, image_url=REPLY_IMAGE_URL）→ 取得 container_id
6. 寫入 Firestore（status: "pending", trigger_source: "manual"）
7. 等待 30 秒
8. POST Threads API step 2 publish → 取得 post_id
9. 更新 Firestore（status: "active", post_id, threads_url, published_at）
```

**Response**
```typescript
201: { success: true; post_id: string; threads_url: string; status: "active"; }
400: { error: "INVALID_URL"; message: string; }
409: { error: "ALREADY_REPLIED"; post_id: string; threads_url: string; }
429: { error: "RATE_LIMITED"; retry_after: number; }
500: { error: "THREADS_API_ERROR" | "INTERNAL_ERROR"; message: string; }
```

***

### 2. `DELETE /reply/{post_id}`（管理，需 Auth）

**後端流程**
```
1. 驗證 ADMIN_API_KEY
2. 查 Firestore → 確認存在且 status != "deleted"
3. 呼叫 Threads DELETE API → DELETE /v1.0/{post_id}
4. 更新 Firestore：status: "deleted", deleted_at: now()
```

**Response**
```typescript
200: { success: true; }
401: { error: "UNAUTHORIZED"; }
404: { error: "NOT_FOUND"; }
409: { error: "ALREADY_DELETED"; }
500: { error: "THREADS_API_ERROR" | "INTERNAL_ERROR"; message: string; }
```

***

### 3. `POST /report/{post_id}`（公開）

**Request Body**
```typescript
{
  reason?: "spam" | "harassment" | "misinformation" | "other";
}
```

**後端流程**
```
1. Rate limit 檢查（IP，可被 X-Bypass-Key 跳過）
2. 確認 post_id 存在且 status = "active"
3. IP 去重：若 reporter_ips 已包含此 IP → 回 409
4. Firestore 原子 increment report_count + arrayUnion(ip)
5. 讀取更新後的 report_count
6. 若 report_count >= REPORT_THRESHOLD(3) → 執行刪除流程（同 DELETE）
```

**Response**
```typescript
200: { success: true; report_count: number; threshold: number; auto_deleted: boolean; }
404: { error: "NOT_FOUND"; }
409: { error: "ALREADY_REPORTED"; }
429: { error: "RATE_LIMITED"; retry_after: number; }
```

***

### 4. `GET /webhook/threads`（Meta Handshake）

**Query Params（Meta 送來）**
```
hub.mode = "subscribe"
hub.verify_token = {WEBHOOK_VERIFY_TOKEN}
hub.challenge = "隨機字串"
```

**後端流程**
```
1. 確認 hub.verify_token === WEBHOOK_VERIFY_TOKEN
2. 回傳 hub.challenge（純文字 200）
```

**Response**
```
200: hub.challenge 純文字
403: "Forbidden"
```

***

### 5. `POST /webhook/threads`（接收 Mention 通知）

**Header 驗證**
```
X-Hub-Signature-256: sha256={HMAC-SHA256(payload, WEBHOOK_APP_SECRET)}
不符 → 403
```

**Payload（Meta 送來）**
```typescript
{
  entry: [{
    id: string;
    time: number;
    changes: [{
      field: "mentions";
      value: {
        media_id: string;
        mentioned_media_id: string;
        text: string;
      }
    }]
  }]
}
```

**後端流程**
```
1. 驗證 HMAC 簽章
2. 解析 payload → 取出 media_id
3. 組出 reply_to_url: https://threads.com/post/{media_id}
4. Idempotency 檢查（同 POST /reply）
5. 執行回覆流程，trigger_source: "webhook_mention"
6. 立即回傳 200（Meta 要求，否則會重試）
```

**Response**
```typescript
200: { success: true; }
403: "Forbidden"
```

***

### 6. `GET /replies`（公開）

**Query Params**
```typescript
limit?: number;    // 預設 20，最大 100，最小 1
cursor?: string;   // base64(JSON.stringify({ last_created_at, last_post_id }))
```

**注意：**
- 只回傳 `status = "active"` 的資料
- 依 `created_at DESC` 排序（最新在最上面）

**Response**
```typescript
200: {
  replies: Array<{
    post_id: string;
    reply_to_url: string;
    threads_url: string;
    report_count: number;
    threshold: number;
    status: "active";
    created_at: string;       // ISO 8601
  }>;
  next_cursor: string | null; // null 代表無下一頁
  total: number;
}
```

***

### 7. `GET /replies/{post_id}`（公開）

**Response**
```typescript
200: {
  post_id: string;
  threads_url: string | null;
  reply_to_url: string;
  report_count: number;
  threshold: number;
  status: "pending" | "active" | "deleted";
  created_at: string;
  published_at: string | null;
}
```

***

### 8. `GET /admin/replies`（管理，需 Auth）

**Query Params**
```typescript
status?: "active" | "deleted" | "pending" | "all";         // 預設 "all"
trigger_source?: "manual" | "webhook_mention" | "all";     // 預設 "all"
search?: string;                                           // 關鍵字搜尋
limit?: number;
cursor?: string;
```

**注意：** 依 `created_at DESC` 排序。

**Response**
```typescript
200: {
  replies: Array<{
    post_id: string;
    reply_to_url: string;
    threads_url: string | null;
    report_count: number;
    threshold: number;
    reporter_count: number;
    status: "pending" | "active" | "deleted";
    trigger_source: "manual" | "webhook_mention";
    triggered_by_media_id: string | null;
    created_at: string;
    deleted_at: string | null;
  }>;
  next_cursor: string | null;
  total: number;
}
```

***

### 9. `GET /health`（公開）

**Response**
```typescript
200: { status: "healthy"; version: string; timestamp: string; }
```

***

## 前端頁面（共 4 個）

### 路由清單

| 路由 | 頁面 | 權限 | 對應 API |
|------|------|------|---------|
| `/` | 首頁 / 發文頁 | 公開 | `POST /reply` |
| `/replies` | 回覆列表 | 公開 | `GET /replies` |
| `/replies/:post_id` | 單篇回覆頁 | 公開（管理員有額外操作） | `GET /replies/{post_id}` |
| `/admin` | 管理頁 | 需 ADMIN_API_KEY | `GET /admin/replies` |

### 路由流程

```
/  →（送出成功）→  /replies/:post_id
                         ↑
/replies  →（點任一筆）→  /replies/:post_id
                         ↑
/admin    →（點任一筆）→  /replies/:post_id（+管理操作）
```

### 1. `/`（首頁 / 發文頁）
```
表單欄位：
  reply_to_url  [input text]   必填

行為：
  送出 → POST /reply
  成功 → redirect /replies/{post_id}

錯誤處理（行內顯示）：
  INVALID_URL     → "請輸入有效的 Threads 貼文連結"
  RATE_LIMITED    → "請求太頻繁，請 {retry_after} 秒後再試"
  ALREADY_REPLIED → "此貼文已有回覆" + 附連結
```

### 2. `/replies`（回覆列表）
```
顯示：
  - 呼叫 GET /replies（只顯示 active，created_at DESC）
  - 每筆：reply_to_url, threads_url, report_count/threshold, created_at
  - 點擊任一筆 → /replies/:post_id
  - 頁面底部顯示「載入更多」按鈕
    → 按下才呼叫下一頁（cursor-based）
    → 無下一頁時隱藏按鈕
```

### 3. `/replies/:post_id`（單篇回覆頁）
```
所有人顯示：
  - threads_url 連結按鈕
  - reply_to_url 連結
  - status badge（pending / active / deleted）
  - report_count / threshold
  - [檢舉] 按鈕（POST /report，送出後 disabled + 顯示目前數量）
  - pending 狀態顯示靜態提示文字：「回覆發布中，請稍後手動重新整理」
    （不自動輪詢）

管理員額外顯示（localStorage 有 ADMIN_API_KEY）：
  - reporter_count
  - trigger_source badge（manual / webhook_mention）
  - triggered_by_media_id（若有）
  - [刪除] 按鈕（確認後 DELETE /reply/:post_id）
```

### 4. `/admin`（管理頁）
```
Auth：
  讀取 localStorage ADMIN_API_KEY
  若無 → 顯示輸入框，輸入後存入 localStorage 並 refresh

顯示（GET /admin/replies，created_at DESC）：
  - 篩選：status / trigger_source
  - 搜尋：關鍵字
  - 每筆：reply_to_url, status badge, trigger_source badge,
          report_count/threshold, created_at, [檢視] [刪除]
  - [檢視] → /replies/:post_id
  - [刪除] → 確認 dialog → DELETE /reply/:post_id → 更新列表
  - 頁面底部「載入更多」按鈕（同列表頁，不自動載入）
```

***

## 目錄結構

### Frontend
```
frontend/
├── src/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── RepliesList.tsx
│   │   ├── ReplyDetail.tsx
│   │   └── Admin.tsx
│   ├── components/
│   │   ├── ReplyForm.tsx
│   │   ├── ReplyCard.tsx
│   │   ├── ReportButton.tsx
│   │   └── StatusBadge.tsx
│   ├── lib/
│   │   ├── api.ts          # 所有 API 呼叫封裝
│   │   └── auth.ts         # ADMIN_API_KEY localStorage 管理
│   ├── App.tsx             # React Router 路由設定
│   └── main.tsx
├── public/
│   ├── certificate.jpg     # 固定回覆圖片
│   └── 404.html            # SPA fallback（build 後 cp index.html）
├── .env.local              # VITE_API_BASE_URL=...
├── vite.config.ts          # base: '/repo-name/'（非 user page 時）
├── .github/
│   └── workflows/
│       └── deploy.yml
└── package.json
```

### Backend
```
backend/
├── functions/
│   ├── index.js            # 匯出所有 9 個 function
│   ├── reply.js            # POST /reply
│   ├── deleteReply.js      # DELETE /reply/:post_id
│   ├── report.js           # POST /report/:post_id
│   ├── getReplies.js       # GET /replies（公開）
│   ├── getReply.js         # GET /replies/:post_id（公開）
│   ├── adminReplies.js     # GET /admin/replies（管理）
│   ├── webhook.js          # GET+POST /webhook/threads
│   ├── health.js           # GET /health
│   └── lib/
│       ├── threads.js      # Threads API client（兩步發布、刪除）
│       ├── firestore.js    # Firestore CRUD
│       └── rateLimit.js    # Rate limit 邏輯（含 bypass 後門）
├── .env.local
└── package.json
```

***

## 費用估算

```
GitHub Pages：        $0
GitHub Actions：      $0
GCP Cloud Functions： $0（每月 200 萬次免費）
GCP Firestore：       $0（免費額度內）
GCP Secret Manager：  $0（5 個 secrets）
Cloudflare Proxy：    $0（若之後想加）

每月費用：$0
每年費用：$0
```

***

## Deploy Checklist

```
GitHub：
  ✅ 建立 repo（monorepo：frontend/ + backend/）
  ✅ 將 certificate.jpg 放入 frontend/public/
  ✅ Settings → Pages → Source: GitHub Actions
  ✅ Actions secret：VITE_API_BASE_URL

GCP：
  ✅ 建立 GCP Project
  ✅ 啟用 APIs：Cloud Functions, Firestore, Secret Manager
  ✅ Secret Manager 新增 5 個 secrets
  ✅ Firestore 建立 3 個複合索引
  ✅ Cloud Functions CORS 設定：允許 GitHub Pages domain（ALLOWED_ORIGIN）
  ✅ 環境變數設定：REPLY_IMAGE_URL, REPLY_TEXT, REPORT_THRESHOLD,
                   ALLOWED_ORIGIN, BYPASS_RATE_LIMIT_KEY（開發期間）
  ✅ Deploy 9 個 Cloud Functions（region: asia-east1）
  ✅ 上線前將 BYPASS_RATE_LIMIT_KEY 設為空字串

Meta / Threads：
  ✅ Meta Developer App 建立
  ✅ 權限申請：threads_basic, threads_content_publish,
               threads_manage_replies, threads_delete
  ✅ Webhook 設定：callback URL + verify token + 訂閱 mentions
  ✅ Advanced Access 申請（Webhook live data）
  ✅ Long-lived token 存入 Secret Manager
```