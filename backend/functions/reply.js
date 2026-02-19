import { db } from './lib/firestore.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { threadsApi } from './lib/threads.js';

export const handlePostReply = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { reply_to_url } = req.body;
  
  const collectionName = process.env.FIRESTORE_COLLECTION_REPLIES || 'replies';
  
  // 提取 IP 用於速率限制
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  
  // Threads post IDs 是英數組合，且考慮 .net/.com、www、參數與多餘斜線
  // 修改：threads\.(net|com)，並在 ID 後方允許任何字元 (包含 ? 參數)
  const urlRegex = /^https?:\/\/(www\.)?threads\.(net|com)\/@[\w.]+\/post\/([\w\-_]+)([\/\?].*)?$/;
  const match = reply_to_url ? reply_to_url.match(urlRegex) : null;

  if (!match) {
    return res.status(400).json({ 
      error: 'INVALID_URL', 
      message: '請輸入有效的 Threads 貼文連結 (例如: https://www.threads.net/@user/post/ID)' 
    });
  }
  
  const reply_to_id = match[3]; // match[3] 是 ID 部份
  
  // 速率限制檢查
  const limit = await checkRateLimit(ip, 'reply', req.headers['x-bypass-key']);
  if (!limit.allowed) return res.status(429).json({ error: 'RATE_LIMITED', retry_after: limit.retry_after });
  
  // 冪等性檢查：同一篇貼文只回覆一次
  const existing = await db.collection(collectionName)
    .where('reply_to_id', '==', reply_to_id)
    .where('status', '==', 'active')
    .limit(1).get();
    
  if (!existing.empty) {
    const doc = existing.docs[0].data();
    return res.status(409).json({ error: 'ALREADY_REPLIED', post_id: doc.post_id, threads_url: doc.threads_url });
  }

  let container_id = null;
  try {
    // 偵錯日誌：在建立媒體容器前記錄，以便於 Cloud Functions Log 查看
    console.log('[ThreadsBot] 準備建立媒體容器:', { reply_to_id, reply_to_url });
    
    // Step 1: 建立媒體容器
    container_id = await threadsApi.createMediaContainer(reply_to_id);
    const docRef = db.collection(collectionName).doc(container_id);
    
    // 先建立 pending 紀錄
    await docRef.set({ 
      post_id: null, 
      container_id, 
      reply_to_url, 
      reply_to_id, 
      threads_url: null, 
      status: 'pending', 
      trigger_source: 'manual', 
      triggered_by_media_id: null,
      report_count: 0, 
      reporter_ips: [], 
      created_at: new Date(), 
      published_at: null, 
      deleted_at: null
    });

    // Step 2: 等待 30 秒 (Meta 處理圖片時間)
    console.log(`[ThreadsBot] 容器建立成功 (${container_id})，等待 30 秒進行發布...`);
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Step 3: 正式發布
    const post_id = await threadsApi.publishMediaContainer(container_id);
    const username = process.env.THREADS_USERNAME || 'bot';
    const threads_url = `https://www.threads.net/@${username}/post/${post_id}`;
    
    // 更新為 active 狀態
    await docRef.update({ 
      post_id, 
      threads_url, 
      status: 'active', 
      published_at: new Date() 
    });
    
    console.log(`[ThreadsBot] 發布完成: ${threads_url}`);
    res.status(201).json({ success: true, post_id, threads_url, status: 'active' });
  } catch (err) {
    console.error('[ThreadsBot] 發布錯誤:', err);
    // 如果已有 container_id，標記為失敗/刪除
    if (container_id) {
      await db.collection(collectionName).doc(container_id).update({
        status: 'deleted',
        deleted_at: new Date()
      }).catch(console.error);
    }
    res.status(500).json({ error: 'THREADS_API_ERROR', message: err.message });
  }
};