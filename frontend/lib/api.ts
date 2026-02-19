
/**
 * Mock API 系統 - 讓前端能在沒有後端的情況下運作
 */

export type ReplyStatus = "pending" | "active" | "deleted";
export type TriggerSource = "manual" | "webhook_mention";

export interface Reply {
  post_id: string | null;
  container_id?: string;
  reply_to_url: string;
  reply_to_id: string;
  threads_url: string | null;
  status: ReplyStatus;
  report_count: number;
  threshold: number;
  created_at: string;
  published_at?: string | null;
  trigger_source?: TriggerSource;
  reporter_ips?: string[];
}

const STORAGE_KEY = 'MOCK_THREADS_REPLIES';
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

// 初始化 Mock 資料
const getMockStore = (): Reply[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  
  const initial: Reply[] = [
    {
      post_id: '123456789',
      reply_to_id: '1',
      reply_to_url: 'https://threads.net/@zuck/post/1',
      threads_url: 'https://threads.net/@bot/post/reply_1',
      status: 'active',
      report_count: 0,
      threshold: 3,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      trigger_source: 'manual'
    },
    {
      post_id: '987654321',
      reply_to_id: '2',
      reply_to_url: 'https://threads.net/@mosseri/post/2',
      threads_url: 'https://threads.net/@bot/post/reply_2',
      status: 'active',
      report_count: 2,
      threshold: 3,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      trigger_source: 'webhook_mention'
    }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const saveMockStore = (replies: Reply[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(replies));
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const api = {
  async postReply(url: string) {
    if (API_BASE_URL) {
      const res = await fetch(`${API_BASE_URL}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_to_url: url })
      });
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(800);
    const store = getMockStore();
    const reply_to_id = url.match(/\/post\/(\d+)/)?.[1] || Math.random().toString();
    
    if (store.find(r => r.reply_to_id === reply_to_id && r.status === 'active')) {
      return { error: 'ALREADY_REPLIED', post_id: '123456789', threads_url: '#' };
    }

    const newPostId = Math.floor(Math.random() * 1000000000).toString();
    const newReply: Reply = {
      post_id: newPostId,
      reply_to_id,
      reply_to_url: url,
      threads_url: `https://www.threads.net/post/${newPostId}`,
      status: 'pending', // 模擬初始為 pending
      report_count: 0,
      threshold: 3,
      created_at: new Date().toISOString(),
      trigger_source: 'manual'
    };

    saveMockStore([newReply, ...store]);
    
    // 模擬後端 5 秒後自動轉為 active
    setTimeout(() => {
      const currentStore = getMockStore();
      const idx = currentStore.findIndex(r => r.post_id === newPostId);
      if (idx !== -1) {
        currentStore[idx].status = 'active';
        currentStore[idx].published_at = new Date().toISOString();
        saveMockStore(currentStore);
      }
    }, 5000);

    return { success: true, post_id: newPostId, status: 'active' };
  },

  async getReplies(limit = 20, cursor?: string) {
    if (API_BASE_URL) {
      const url = new URL(`${API_BASE_URL}/replies`);
      url.searchParams.append('limit', limit.toString());
      if (cursor) url.searchParams.append('cursor', cursor);
      const res = await fetch(url.toString());
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(500);
    const activeReplies = getMockStore().filter(r => r.status === 'active');
    return { replies: activeReplies, total: activeReplies.length };
  },

  async getReply(postId: string) {
    if (API_BASE_URL) {
      const res = await fetch(`${API_BASE_URL}/replies/${postId}`);
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(300);
    const reply = getMockStore().find(r => r.post_id === postId);
    if (!reply) return { error: 'NOT_FOUND' };
    return reply;
  },

  async reportReply(postId: string, reason = 'other') {
    if (API_BASE_URL) {
      const res = await fetch(`${API_BASE_URL}/report/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(500);
    const store = getMockStore();
    const idx = store.findIndex(r => r.post_id === postId);
    if (idx === -1) return { error: 'NOT_FOUND' };

    store[idx].report_count += 1;
    let auto_deleted = false;
    if (store[idx].report_count >= store[idx].threshold) {
      store[idx].status = 'deleted';
      auto_deleted = true;
    }
    saveMockStore(store);
    return { success: true, report_count: store[idx].report_count, threshold: 3, auto_deleted };
  },

  async deleteReply(postId: string, apiKey: string) {
    if (API_BASE_URL) {
      const res = await fetch(`${API_BASE_URL}/reply/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(500);
    const store = getMockStore();
    const idx = store.findIndex(r => r.post_id === postId);
    if (idx === -1) return { error: 'NOT_FOUND' };

    store[idx].status = 'deleted';
    saveMockStore(store);
    return { success: true };
  },

  async adminGetReplies(apiKey: string, filters: any = {}) {
    if (API_BASE_URL) {
      const url = new URL(`${API_BASE_URL}/admin/replies`);
      Object.keys(filters).forEach(key => url.searchParams.append(key, filters[key]));
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.json();
    }

    // --- Mock Implementation ---
    await delay(600);
    let store = getMockStore();
    if (filters.status && filters.status !== 'all') {
      store = store.filter(r => r.status === filters.status);
    }
    return { replies: store, total: store.length };
  }
};
