import crypto from 'crypto';
import { db } from './lib/firestore.js';
import { threadsApi } from './lib/threads.js';

export const handleWebhookThreads = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return res.status(403).send('Forbidden');

    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_APP_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    if (signature !== digest) return res.status(403).send('Forbidden');

    // 異步處理，不阻塞 Webhook 回傳
    processMention(req.body).catch(console.error);
    return res.status(200).json({ success: true });
  }

  res.status(405).send('Method Not Allowed');
};

async function processMention(payload) {
  const changes = payload.entry?.[0]?.changes;
  if (!changes || changes[0].field !== 'mentions') return;

  const { media_id } = changes[0].value;
  const reply_to_url = `https://threads.com/post/${media_id}`;
  const collectionName = process.env.FIRESTORE_COLLECTION_REPLIES || 'replies';
  
  const existing = await db.collection(collectionName)
    .where('reply_to_id', '==', media_id)
    .where('status', '==', 'active')
    .limit(1).get();

  if (!existing.empty) return;

  let container_id = null;
  try {
    console.log('[Webhook] 接收到 Mention:', { media_id });
    
    container_id = await threadsApi.createMediaContainer(media_id);
    const docRef = db.collection(collectionName).doc(container_id);
    
    await docRef.set({
      post_id: null,
      container_id,
      reply_to_url,
      reply_to_id: media_id,
      status: 'pending',
      trigger_source: 'webhook_mention',
      triggered_by_media_id: media_id,
      report_count: 0,
      reporter_ips: [],
      created_at: new Date(),
      published_at: null,
      deleted_at: null
    });

    await new Promise(r => setTimeout(r, 30000));
    const post_id = await threadsApi.publishMediaContainer(container_id);
    const username = process.env.THREADS_USERNAME || 'bot';
    
    await docRef.update({
      post_id,
      threads_url: `https://threads.com/@${username}/post/${post_id}`,
      status: 'active',
      published_at: new Date()
    });
    console.log('[Webhook] 自動回覆成功');
  } catch (err) {
    console.error('[Webhook] 處理失敗:', err);
    if (container_id) {
      await db.collection(collectionName).doc(container_id).update({
        status: 'deleted',
        deleted_at: new Date()
      }).catch(() => {});
    }
  }
}