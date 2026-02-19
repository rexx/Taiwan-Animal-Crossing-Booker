
import { db } from './lib/firestore.js';

export const handleGetReplies = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const cursor = req.query.cursor;

  try {
    let query = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES)
      .where('status', '==', 'active')
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      query = query.startAfter(new Date(decoded.last_created_at));
    }

    const snapshot = await query.get();
    const replies = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at.toDate().toISOString(),
      published_at: doc.data().published_at ? doc.data().published_at.toDate().toISOString() : null,
      reporter_ips: undefined // 安全起見隱藏 IP 列表
    }));

    let next_cursor = null;
    if (replies.length === limit) {
      const last = replies[replies.length - 1];
      next_cursor = Buffer.from(JSON.stringify({ 
        last_created_at: last.created_at 
      })).toString('base64');
    }

    res.json({ replies, next_cursor });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

export const handleGetReply = async (req, res) => {
  const postId = req.url.split('/').pop();
  try {
    const doc = await db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).doc(postId).get();
    if (!doc.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    
    const data = doc.data();
    res.json({
      ...data,
      created_at: data.created_at.toDate().toISOString(),
      published_at: data.published_at ? data.published_at.toDate().toISOString() : null,
      reporter_ips: undefined
    });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};
