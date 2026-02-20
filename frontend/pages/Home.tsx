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
        <h1 className="text-6xl font-serif font-bold tracking-tight text-ink">動森島脆友證書</h1>
        <p className="text-ink/60 text-xl max-w-lg mx-auto font-medium">恭喜您完成任務！貼上目標貼文 URL，機器人將自動前往該處留下指定的證書圖片與文字。</p>
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
          {loading ? '發送中...' : '送出回覆指令'}
        </button>
      </form>

      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-center gap-3 text-accent uppercase tracking-[0.2em] text-sm font-bold mb-2">
          <Eye size={18} /> 證書預覽
        </div>
        <div className="bg-white border-4 border-tan rounded-[2.5rem] overflow-hidden shadow-2xl transition-transform hover:scale-[1.01] p-4">
          <div className="certificate-border rounded-[1.5rem] overflow-hidden">
            <img 
              src={CERTIFICATE_IMAGE} 
              alt="Certificate Preview" 
              className="w-full h-auto block rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/f5f2ed/5d4037?text=Image+Loading...';
              }}
            />
          </div>
          <div className="mt-4 px-4 py-3 bg-paper rounded-2xl text-xs text-ink/40 font-mono break-all">
            {CERTIFICATE_IMAGE}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-12 pt-12">
        <div className="flex flex-col items-center gap-4 group">
          <div className="w-14 h-14 border-2 border-accent rounded-full flex items-center justify-center text-accent font-serif font-bold text-xl group-hover:bg-accent group-hover:text-white transition-all">01</div>
          <span className="text-sm font-bold text-ink/60 uppercase tracking-widest">輸入網址</span>
        </div>
        <div className="flex flex-col items-center gap-4 group">
          <div className="w-14 h-14 border-2 border-accent rounded-full flex items-center justify-center text-accent font-serif font-bold text-xl group-hover:bg-accent group-hover:text-white transition-all">02</div>
          <span className="text-sm font-bold text-ink/60 uppercase tracking-widest">等待30秒</span>
        </div>
        <div className="flex flex-col items-center gap-4 group">
          <div className="w-14 h-14 border-2 border-accent rounded-full flex items-center justify-center text-accent font-serif font-bold text-xl group-hover:bg-accent group-hover:text-white transition-all">03</div>
          <span className="text-sm font-bold text-ink/60 uppercase tracking-widest">發布成功</span>
        </div>
      </div>
    </div>
  );
};