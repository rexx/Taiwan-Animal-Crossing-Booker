
import { db } from './lib/firestore.js';
import { threadsApi } from './lib/threads.js';

export const handleDeleteReply = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).send('Method Not Allowed');

  // 1. 驗證 ADMIN_API_KEY
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const postId = req.query.id || req.url.split('/').pop();
  console.log('[DeleteReply] Parsed postId is:', postId);
  if (!postId || postId === 'deleteReply' || postId === '') {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing postId' });
  }

  try {
    const qs = await db.collection(process.env.FIRESTORE_COLLECTION_REPLIES)
      .where('post_id', '==', postId)
      .limit(1).get();

    if (qs.empty) return res.status(404).json({ error: 'NOT_FOUND' });

    const doc = qs.docs[0];
    const docRef = doc.ref;

    if (doc.data().status === 'deleted') return res.status(409).json({ error: 'ALREADY_DELETED' });

    // 2. 呼叫 Threads API 刪除
    console.log(`[DeleteReply] 正在嘗試從 Threads 刪除貼文: ${postId}`);
    await threadsApi.deletePost(postId);
    console.log(`[DeleteReply] 成功從 Threads 刪除貼文: ${postId}`);

    // 3. 更新 Firestore
    await docRef.update({
      status: 'deleted',
      deleted_at: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('刪除失敗:', err);
    res.status(500).json({ error: 'THREADS_API_ERROR', message: err.message });
  }
};
