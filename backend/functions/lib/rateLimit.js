
import { db } from './firestore.js';
export const checkRateLimit = async (ip, endpoint, bypassKey) => {
  if (process.env.BYPASS_RATE_LIMIT_KEY && bypassKey === process.env.BYPASS_RATE_LIMIT_KEY) {
    return { allowed: true };
  }
  const docId = `${ip.replace(/\./g, '_')}_${endpoint}`;
  const docRef = db.collection(process.env.FIRESTORE_COLLECTION_RATE_LIMITS).doc(docId);
  const doc = await docRef.get();
  const now = new Date();
  const windowSize = 600;
  if (!doc.exists) {
    await docRef.set({ count: 1, window_start: now });
    return { allowed: true };
  }
  const data = doc.data();
  const startTime = data.window_start.toDate();
  const diff = (now.getTime() - startTime.getTime()) / 1000;
  if (diff > windowSize) {
    await docRef.update({ count: 1, window_start: now });
    return { allowed: true };
  }
  if (data.count >= 2) {
    return { allowed: false, retry_after: Math.ceil(windowSize - diff) };
  }
  await docRef.update({ count: data.count + 1 });
  return { allowed: true };
};
