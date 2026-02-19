
import { db } from './lib/firestore.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { threadsApi } from './lib/threads.js';

export const handlePostReply = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { reply_to_url } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  if (!reply_to_url || !reply_to_url.match(/^https:\/\/threads\.net\/@[\w.]+\/post\/\d+$/)) {
    return res.status(400).json({ error: 'INVALID_URL', message: '請輸入有效的 Threads 貼文連結' });
  }
  const limit = await checkRateLimit(ip, 'reply', req.headers['x-bypass-key']);
  if (!limit.allowed) return res.status(429).json({ error: 'RATE_LIMITED', retry_after: limit.retry_after });
  const reply_to_id = reply_to_url.match(/\/post\/(\d+)/)[1];
  const existing = await db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).where('reply_to_id', '==', reply_to_id).where('status', '==', 'active').limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0].data();
    return res.status(409).json({ error: 'ALREADY_REPLIED', post_id: doc.post_id, threads_url: doc.threads_url });
  }
  try {
    const container_id = await threadsApi.createMediaContainer(reply_to_id);
    const docRef = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).doc(container_id);
    await docRef.set({ post_id: null, container_id, reply_to_url, reply_to_id, threads_url: null, status: 'pending', trigger_source: 'manual', report_count: 0, reporter_ips: [], created_at: new Date(), published_at: null });
    await new Promise(resolve => setTimeout(resolve, 30000));
    const post_id = await threadsApi.publishMediaContainer(container_id);
    const threads_url = `https://www.threads.net/post/${post_id}`;
    await docRef.update({ post_id, threads_url, status: 'active', published_at: new Date() });
    res.status(201).json({ success: true, post_id, threads_url, status: 'active' });
  } catch (err) {
    console.error('Threads發布錯誤:', err);
    res.status(500).json({ error: 'THREADS_API_ERROR', message: err.message });
  }
};
