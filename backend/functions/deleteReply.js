
import { db } from './lib/firestore.js';
import { threadsApi } from './lib/threads.js';

export const handleDeleteReply = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).send('Method Not Allowed');
  
  // 1. 驗證 ADMIN_API_KEY
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const postId = req.url.split('/').pop();
  if (!postId) return res.status(400).json({ error: 'BAD_REQUEST' });

  try {
    const docRef = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).doc(postId);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    if (doc.data().status === 'deleted') return res.status(409).json({ error: 'ALREADY_DELETED' });

    // 2. 呼叫 Threads API 刪除
    await threadsApi.deletePost(postId);

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
