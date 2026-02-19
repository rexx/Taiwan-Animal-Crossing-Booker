
import { db } from './lib/firestore.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { threadsApi } from './lib/threads.js';
import { FieldValue } from '@google-cloud/firestore';

export const handlePostReport = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const postId = req.url.split('/').pop();
  // 修正 IP 取得方式
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

  // 1. Rate limit 檢查
  const limit = await checkRateLimit(ip, 'report', req.headers['x-bypass-key']);
  if (!limit.allowed) return res.status(429).json({ error: 'RATE_LIMITED', retry_after: limit.retry_after });

  try {
    const docRef = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).doc(postId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().status !== 'active') {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const data = doc.data();
    // 2. IP 去重
    if (data.reporter_ips && data.reporter_ips.includes(ip)) {
      return res.status(409).json({ error: 'ALREADY_REPORTED' });
    }

    // 3. 原子更新檢舉數
    await docRef.update({
      report_count: FieldValue.increment(1),
      reporter_ips: FieldValue.arrayUnion(ip)
    });

    const updatedDoc = await docRef.get();
    const currentCount = updatedDoc.data().report_count;
    const threshold = parseInt(process.env.REPORT_THRESHOLD || '3');
    let auto_deleted = false;

    // 4. 超過閾值自動刪除
    if (currentCount >= threshold) {
      try {
        await threadsApi.deletePost(postId);
        await docRef.update({
          status: 'deleted',
          deleted_at: new Date()
        });
        auto_deleted = true;
      } catch (e) {
        console.error('自動刪除失敗:', e);
      }
    }

    res.json({ 
      success: true, 
      report_count: currentCount, 
      threshold, 
      auto_deleted 
    });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};
