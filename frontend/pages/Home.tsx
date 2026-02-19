
import React, { useState } from 'react';
import { Send, RefreshCcw } from 'lucide-react';
import { api } from '../lib/api.ts';

interface HomeProps {
  onSent: (id: string) => void;
  notify: (m: string, t?: any) => void;
}

export const Home: React.FC<HomeProps> = ({ onSent, notify }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.match(/^https:\/\/threads\.net\/@[\w.]+\/post\/\d+$/)) {
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-5xl font-black tracking-tight leading-tight">自動回覆證書</h1>
        <p className="text-white/40 text-lg max-w-md mx-auto">貼上目標貼文 URL，機器人將自動前往該處留下指定的證書圖片與文字。</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4">
        <div className="relative group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://threads.net/@user/post/12345..."
            className="w-full bg-[#121212] border border-white/10 rounded-2xl px-6 py-5 text-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url}
          className="w-full bg-white text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCcw className="animate-spin" /> : <Send size={20} />}
          {loading ? '發送中...' : '送出回覆指令'}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-8 pt-8 opacity-40">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border border-white rounded-full flex items-center justify-center">1</div>
          <span className="text-xs font-bold uppercase tracking-widest">輸入網址</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border border-white rounded-full flex items-center justify-center">2</div>
          <span className="text-xs font-bold uppercase tracking-widest">等待30秒</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border border-white rounded-full flex items-center justify-center">3</div>
          <span className="text-xs font-bold uppercase tracking-widest">發布成功</span>
        </div>
      </div>
    </div>
  );
};
