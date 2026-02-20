
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
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

export const api = {
  async postReply(url: string) {
    const res = await fetch(`${API_BASE_URL}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_to_url: url })
    });
    return res.json();
  },

  async getReplies(limit = 20, cursor?: string) {
    const url = new URL(`${API_BASE_URL}/getReplies`);
    url.searchParams.append('limit', limit.toString());
    if (cursor) url.searchParams.append('cursor', cursor);
    const res = await fetch(url.toString());
    return res.json();
  },

  async getReply(postId: string) {
    const res = await fetch(`${API_BASE_URL}/getReply/${postId}`);
    return res.json();
  },

  async reportReply(postId: string, reason = 'other') {
    const res = await fetch(`${API_BASE_URL}/report/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return res.json();
  },

  async deleteReply(postId: string, apiKey: string) {
    const res = await fetch(`${API_BASE_URL}/deleteReply/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return res.json();
  },

  async adminGetReplies(apiKey: string, filters: any = {}) {
    const url = new URL(`${API_BASE_URL}/adminReplies`);
    Object.keys(filters).forEach(key => url.searchParams.append(key, filters[key]));
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return res.json();
  }
};
