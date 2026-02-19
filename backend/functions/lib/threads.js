
export const threadsApi = {
  /**
   * 將 Threads 的 shortcode (例如 URL 中的 ID) 轉換為 API 所需的數字 ID。
   * 受限於 Threads API，目前僅能透過搜尋機器人自身貼文列表來匹配轉換。
   * 
   * @param {string} shortcode 貼文的短網址代碼 (e.g. DU7J9o1EThx)
   * @returns {Promise<string>} 數字 ID
   */
  async getMediaIdByShortcode(shortcode) {
    // 1. 如果輸入已經是純數字，直接視為已轉換的 ID (例如來自 Webhook 的資料)
    if (/^\d+$/.test(shortcode)) {
      return shortcode;
    }

    // 2. 呼叫 /me/threads 獲取機器人自己的貼文列表以進行匹配
    // 使用 /me/threads 可以獲取授權帳號發布的所有貼文
    const url = `https://graph.threads.net/v1.0/me/threads`;
    const params = new URLSearchParams({
      fields: 'id,permalink',
      limit: '50', // 搜尋最近 50 則貼文以增加匹配機率
      access_token: process.env.THREADS_ACCESS_TOKEN
    });

    try {
      const res = await fetch(`${url}?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        console.error('[ThreadsAPI] 獲取貼文列表失敗:', data.error);
        throw new Error(`獲取貼文列表失敗: ${data.error.message}`);
      }

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('API 回傳格式不符合預期');
      }

      // 3. 在列表中尋找 permalink 包含該 shortcode 的項目
      // permalink 格式通常為 https://www.threads.net/@user/post/SHORTCODE
      const match = data.data.find(item => 
        item.permalink && item.permalink.includes(`/post/${shortcode}`)
      );

      if (!match) {
        // 如果找不到，代表這可能不是機器人自己的貼文，或者該貼文不在最近的 50 則內
        throw new Error(`無法將短網址代碼 "${shortcode}" 轉換為數字 ID。請確保目標貼文是機器人發布的，或提供直接的數字 ID。`);
      }

      return match.id;
    } catch (err) {
      console.error('[ThreadsAPI] Shortcode 轉換過程出錯:', err);
      throw err;
    }
  },

  /**
   * 建立媒體容器。
   * @param {string} replyToIdOrShortcode 目標貼文的 ID 或 Shortcode
   */
  async createMediaContainer(replyToIdOrShortcode) {
    // 內部自動呼叫轉換邏輯：支援傳入數字 ID 或 URL 中的 shortcode
    const replyToId = await this.getMediaIdByShortcode(replyToIdOrShortcode);
    
    const url = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_replies`;
    const params = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: process.env.REPLY_IMAGE_URL,
      text: process.env.REPLY_TEXT,
      reply_to_id: replyToId,
      access_token: process.env.THREADS_ACCESS_TOKEN
    });

    console.log(`[ThreadsAPI] 正在建立媒體容器，目標數字 ID: ${replyToId}`);
    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    
    if (data.error) {
      console.error('[ThreadsAPI] createMediaContainer 錯誤:', data.error);
      throw new Error(data.error.message);
    }
    
    return data.id;
  },

  async publishMediaContainer(containerId) {
    // Step 3: POST https://graph.threads.net/v1.0/{container_id}/publish
    const url = `https://graph.threads.net/v1.0/${containerId}/publish`;
    const params = new URLSearchParams({
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  },

  async deletePost(postId) {
    const url = `https://graph.threads.net/v1.0/${postId}`;
    const params = new URLSearchParams({
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.success;
  }
};
