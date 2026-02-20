import React, { useState } from 'react';
import { Send, RefreshCcw, Eye } from 'lucide-react';
import { api } from '../lib/api.ts';

interface HomeProps {
  onSent: (id: string) => void;
  notify: (m: string, t?: any) => void;
}

export const Home: React.FC<HomeProps> = ({ onSent, notify }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const CERTIFICATE_IMAGE = 'https://rexx.github.io/public/certificate.jpg';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 更新正規表示式：支援 threads.net 或 threads.com，並處理 ID 後方的參數
    const urlRegex = /^https?:\/\/(www\.)?threads\.(net|com)\/@[\w.]+\/post\/[\w\-_]+([\/\?].*)?$/;
    if (!url.match(urlRegex)) {
      notify('請輸入有效的 Threads 貼文連結', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.postReply(url);
      if (res.error === 'ALREADY_REPLIED') {
        notify('此貼文已有回覆', 'error');
        onSent(res.post_id);
      } else if (res.error === 'RATE_LIMITED') {
        notify(`請求太頻繁，請 ${res.retry_after} 秒後再試`, 'error');
      } else if (res.success) {
        notify('回覆指令已發送！');
        onSent(res.post_id);
      } else {
        notify(res.message || '發生錯誤', 'error');
      }
    } catch (e) {
      console.warn("API 呼叫失敗，請確認 VITE_API_BASE_URL 已設定。");
      notify('API 尚未連線，目前為模擬環境', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-12 py-10">
      <div className="space-y-6">
        <p className="text-ink/60 text-xl max-w-lg mx-auto font-medium">貼上目標貼文 URL，我們將前往該處留下證書。</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-6">
        <div className="relative group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://threads.net/@user/post/..."
            className="w-full bg-white border-2 border-tan rounded-3xl px-8 py-6 text-xl focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all placeholder:text-ink/20 shadow-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url}
          className="w-full bg-accent text-white font-bold py-6 rounded-3xl flex items-center justify-center gap-3 hover:bg-accent-dark hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 shadow-md text-xl"
        >
          {loading ? <RefreshCcw className="animate-spin" /> : <Send size={24} />}
          {loading ? '發送中...' : '頒發證書'}
        </button>
      </form>

    </div>
  );
};