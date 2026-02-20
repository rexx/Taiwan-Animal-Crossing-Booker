
import { db } from './lib/firestore.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { threadsApi } from './lib/threads.js';

export const handlePostReply = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { reply_to_url } = req.body;
  
  const collectionName = process.env.FIRESTORE_COLLECTION_REPLIES || 'replies';
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  
  const urlRegex = /^https?:\/\/(www\.)?threads\.(net|com)\/@[\w.]+\/post\/([\w\-_]+)([\/\?].*)?$/;
  const match = reply_to_url ? reply_to_url.match(urlRegex) : null;

  if (!match) {
    return res.status(400).json({ 
      error: 'INVALID_URL', 
      message: '請輸入有效的 Threads 貼文連結' 
    });
  }
  
  const reply_to_id = match[3];
  
  // 速率限制
  const limit = await checkRateLimit(ip, 'reply', req.headers['x-bypass-key']);
  if (!limit.allowed) return res.status(429).json({ error: 'RATE_LIMITED', retry_after: limit.retry_after });
  
  // 冪等性
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
    container_id = await threadsApi.createMediaContainer(reply_to_id);
    const docRef = db.collection(collectionName).doc(container_id);
    
    await docRef.set({ 
      post_id: null, 
      container_id, 
      reply_to_url, 
      reply_to_id, 
      threads_url: null, 
      status: 'pending', 
      trigger_source: 'manual', 
      report_count: 0, 
      reporter_ips: [], 
      created_at: new Date(), 
      published_at: null, 
      deleted_at: null
    });

    // 等待 30 秒 (Meta 處理圖片)
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const post_id = await threadsApi.publishMediaContainer(container_id);
    const username = process.env.THREADS_USERNAME || 'bot';
    const threads_url = `https://www.threads.net/@${username}/post/${post_id}`;
    
    await docRef.update({ 
      post_id, 
      threads_url, 
      status: 'active', 
      published_at: new Date() 
    });
    
    res.status(201).json({ success: true, post_id, threads_url, status: 'active' });
  } catch (err) {
    console.error('[ThreadsBot] 發布過程發生錯誤:', err);
    if (container_id) {
      await db.collection(collectionName).doc(container_id).update({
        status: 'deleted',
        deleted_at: new Date()
      }).catch(() => {});
    }
    res.status(500).json({ error: 'THREADS_API_ERROR', message: err.message });
  }
};
