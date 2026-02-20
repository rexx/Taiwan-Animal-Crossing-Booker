
export const threadsApi = {
  /**
   * 將 Threads 的 shortcode (例如 URL 中的 ID) 轉換為 API 所需的數字 ID。
   * 受限於 Threads API，目前僅能透過搜尋機器人自身貼文列表來匹配轉換。
   * 
   * @param {string} shortcode 貼文的短網址代碼 (e.g. DU7J9o1EThx)
   * @returns {Promise<string>} 數字 ID
   */
  async getMediaIdByShortcode(shortcode) {
    // 1. 如果輸入已經是純數字，直接視為已轉換的 ID
    if (/^\d+$/.test(shortcode)) {
      return shortcode;
    }

    // 2. 呼叫 /me/threads 獲取機器人自己的貼文列表以進行匹配
    const url = `https://graph.threads.net/v1.0/me/threads`;
    const params = new URLSearchParams({
      fields: 'id,permalink',
      limit: '50',
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
        // 如果無法轉換且不是數字，尝试直接返回 shortcode (部分 API 版本可能支持)
        return shortcode;
      }

      const match = data.data.find(item => 
        item.permalink && item.permalink.includes(`/post/${shortcode}`)
      );

      if (!match) {
        // 找不到匹配時，返回原始 shortcode 嘗試讓 API 處理
        return shortcode;
      }

      return match.id;
    } catch (err) {
      console.warn('[ThreadsAPI] Shortcode 轉換失敗，嘗試直接使用原始 ID:', shortcode);
      return shortcode;
    }
  },

  /**
   * 建立媒體容器。
   * 修正：Threads API 建立回覆與貼文均使用 /threads 端點。
   */
  async createMediaContainer(replyToIdOrShortcode) {
    const replyToId = await this.getMediaIdByShortcode(replyToIdOrShortcode);
    
    // 修正：Threads API 使用 /threads 而非 /threads_replies
    const url = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`;
    const params = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: process.env.REPLY_IMAGE_URL,
      text: process.env.REPLY_TEXT,
      reply_to_id: replyToId,
      access_token: process.env.THREADS_ACCESS_TOKEN
    });

    console.log(`[ThreadsAPI] 正在建立媒體容器，目標 ID: ${replyToId}`);
    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    
    if (data.error) {
      console.error('[ThreadsAPI] createMediaContainer 錯誤:', data.error);
      throw new Error(data.error.message);
    }
    
    return data.id;
  },

  async publishMediaContainer(containerId) {
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
