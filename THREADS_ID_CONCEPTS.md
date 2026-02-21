# Threads API 與關聯 ID 概念解析

在 Threads Reply Bot 的開發與實作中，我們頻繁接觸到多種不同名稱的 ID。由於 Threads API 的設計分為「建立容器」與「發布」兩階段，加上網址中使用的 ID 與 API 內部使用的 ID 不同，這裡將它們的關係與用途整理如下：

## 1. Shortcode (短網址代碼)
*   **來源：** 通常存在於 Threads 貼文的 URL 中。
*   **範例：** 網址 `https://www.threads.net/@user/post/DU96_efEdSq` 中的 `DU96_efEdSq` 就是 Shortcode。
*   **用途：** 這是給一般使用者看、用來分享的英數混合短代碼。在我們的系統中，使用者輸入 `reply_to_url` 時，我們會使用正則表達式把這段 Shortcode 提取出來。

## 2. Post ID (已發布貼文 ID)
*   **來源：** Threads 發文機制的第二步（POST `/threads_publish`）回傳的 ID。
*   **官方名稱：** Meta 官方文件稱之為 **Threads Media ID** 或 **Threads ID**。
*   **特性：** 這是已發布內容在 Threads 平台上的唯一純數字識別碼。
*   **用途：** 這是與 Threads 世界溝通最重要、最持久的 ID。舉凡刪除貼文、讀取貼文數據、或是組合分享網址 `https://www.threads.net/@user/post/{post_id}` 通通都是使用這個 ID。

## 3. Container ID (媒體容器 ID)
*   **來源：** Threads 發文機制的第一步（POST `/threads`）回傳。
*   **範例：** `18024339533633146`
*   **用途：** 這是一個臨時容器 ID。Meta 規定上傳圖片或文字回覆時，必須先建立容器，等待系統處理完畢後才能發布。
*   **在我們系統的意義：** 這是我們最先拿到的一個獨特 ID，因此把它作為 Firestore 資料庫中 `replies` 集合的 **Document ID**。

---

## 總結發布流程與 ID 變化軌跡

1. 使用者送出 `reply_to_url` $\rightarrow$ 擷取出 **Shortcode**。
2. 系統透過 `getPostIdByShortcode` 將 Shortcode 轉為數字形式的 **Post ID** (若目標貼文非機器人發布，則通常直接使用擷取到的代碼)。
3. 呼叫建立容器 API $\rightarrow$ 取得 **Container ID**。
4. 在發布前的 30 秒等待期，使用 **Container ID** 作為 Key 建立 Firestore 紀錄（狀態為 `pending`）。
5. 呼叫發布 API（輸入 Container ID） $\rightarrow$ 取得最終正式的 **Post ID**。
6. 將 **Post ID** 更新回資料庫紀錄（狀態轉為 `active`）。

---

## 我們的 API 詳細 ID 軌跡 (Input/Output/Internal)

這裡詳細展開每支 API 在「外部輸入輸出」與「內部呼叫 Threads API」時使用的 ID 變化：

### 1. Post Reply API (`/reply`) - 建立回覆
這是轉換最複雜的流程，涉及三個階段。
*   **外部 Input**: `reply_to_url` (內含 **Shortcode**)
*   **內部系統**: 從網址擷取出 **Shortcode**。
*   **內部 Threads API 呼叫**:
    1.  `createMediaContainer(shortcode)` $\rightarrow$ 內轉為 **Media ID** $\rightarrow$ 回傳 **Container ID**。
    2.  `publishMediaContainer(containerId)` $\rightarrow$ 帶入 **Container ID** $\rightarrow$ 回傳 **Post ID**。
*   **外部 Output**: `post_id` (**Post ID**) 與發布網址。

### 2. Get Reply API (`/getReply/:id`) - 讀取詳情
*   **外部 Input**: URL Path 中的 `:id` (預期為 **Container ID**)
*   **原因**: 因為本系統目前將 **Container ID** 作為 Firestore 資料庫的 **Document ID**。
*   **內部 Threads API**: 無（僅與資料庫互動）。
*   **外部 Output**: 完整 JSON 物件，內含 **Container ID** 與 **Post ID** 等欄位。

### 3. Delete Reply API (`/deleteReply/:id`) - 刪除回覆
*   **外部 Input**: URL Path 或參數 `id` (預期為 **Post ID**)
*   **內部系統**:
    1.  使用傳入的 **Post ID** 在資料庫執行搜尋：`where('post_id', '==', postId)`。
    2.  若找到紀錄，則執行刪除。
*   **內部 Threads API 呼叫**:
    *   `deletePost(postId)` $\rightarrow$ 帶入 **Post ID** 直接刪除外部貼文。
*   **外部 Output**: `success: true`。

---

## ID 軌跡總結對照表

| API 功能 (CRUD) | 外部輸入 (Input) | 內部 Threads API 呼叫 | 外部回傳 (Output) |
| :--- | :--- | :--- | :--- |
| **Create** (`/reply`) | **Shortcode** (網址) | 轉 **Media ID** $\rightarrow$ **Container ID** $\rightarrow$ **Post ID** | **Post ID** |
| **Read** (`/getReply`) | **Container ID** | (無) | **Container ID** + **Post ID** |
| **Update** (`/report`) | **Container ID** | (自動觸發 delete 時用 Post ID) | 更新後狀態 |
| **Delete** (`/deleteReply`) | **Post ID** | **Post ID** | 成功狀態 |

**⚠️ 注意事項：**
目前系統存在 **ID 不對稱性**。讀取 (Read) 需要傳入系統內部的 `Container ID`，但刪除 (Delete) 卻是使用外部公開的 `Post ID`。建議未來統一支援以 `Post ID` 作為所有公開介面的檢索鍵。
