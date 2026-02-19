
import crypto from 'crypto';
import { db } from './lib/firestore.js';
import { threadsApi } from './lib/threads.js';

export const handleWebhookThreads = async (req, res) => {
  // 1. GET: Meta Handshake
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // 2. POST: 接收 Mention
  if (req.method === 'POST') {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return res.status(403).send('Forbidden');

    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_APP_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    if (signature !== digest) return res.status(403).send('Forbidden');

    // 異步處理以立即回傳 200 給 Meta
    processMention(req.body).catch(console.error);
    return res.status(200).json({ success: true });
  }

  res.status(405).send('Method Not Allowed');
};

async function processMention(payload) {
  const changes = payload.entry?.[0]?.changes;
  if (!changes || changes[0].field !== 'mentions') return;

  const { media_id } = changes[0].value;
  const reply_to_url = `https://threads.net/post/${media_id}`;
  
  // 檢查是否已回覆 (Idempotency)
  const existing = await db.collection(process.env.FIRESTORE_COLLECTION_REPLIES)
    .where('reply_to_id', '==', media_id)
    .where('status', '==', 'active')
    .limit(1).get();

  if (!existing.empty) return;

  // 執行回覆流程
  try {
    const container_id = await threadsApi.createMediaContainer(media_id);
    const docRef = db.collection(process.env.FIRESTORE_COLLECTION_REPLIES).doc(container_id);
    
    await docRef.set({
      post_id: null,
      container_id,
      reply_to_url,
      reply_to_id: media_id,
      status: 'pending',
      trigger_source: 'webhook_mention',
      created_at: new Date()
    });

    await new Promise(r => setTimeout(r, 30000));
    const post_id = await threadsApi.publishMediaContainer(container_id);
    const threads_url = `https://www.threads.net/post/${post_id}`;
    
    await docRef.update({
      post_id,
      threads_url,
      status: 'active',
      published_at: new Date()
    });
  } catch (err) {
    console.error('Webhook 回覆失敗:', err);
  }
}
