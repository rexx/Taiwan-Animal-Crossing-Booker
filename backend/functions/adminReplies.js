
import { db } from './lib/firestore.js';

export const handleAdminGetReplies = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const { status, trigger_source, limit = 20, cursor } = req.query;

  try {
    let query = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).orderBy('created_at', 'desc');

    if (status && status !== 'all') query = query.where('status', '==', status);
    if (trigger_source && trigger_source !== 'all') query = query.where('trigger_source', '==', trigger_source);

    query = query.limit(parseInt(limit));
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      query = query.startAfter(new Date(decoded.last_created_at));
    }

    const snapshot = await query.get();
    const replies = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        ...d,
        created_at: d.created_at.toDate().toISOString(),
        published_at: d.published_at ? d.published_at.toDate().toISOString() : null,
        deleted_at: d.deleted_at ? d.deleted_at.toDate().toISOString() : null,
        reporter_count: d.reporter_ips ? d.reporter_ips.length : 0
      };
    });

    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};
