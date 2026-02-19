
export const threadsApi = {
  async createMediaContainer(replyToId) {
    const url = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_replies`;
    const params = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: process.env.REPLY_IMAGE_URL,
      text: process.env.REPLY_TEXT,
      reply_to_id: replyToId,
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  },
  async publishMediaContainer(containerId) {
    // 根據 Spec Step 3: POST https://graph.threads.net/v1.0/{container_id}/publish
    const url = `https://graph.threads.net/v1.0/${containerId}/publish`;
    const params = new URLSearchParams({
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  },
  async deletePost(postId) {
    const url = `https://graph.threads.net/v1.0/${postId}`;
    const params = new URLSearchParams({
      access_token: process.env.THREADS_ACCESS_TOKEN
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.success;
  }
};
